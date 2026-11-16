import { NextResponse } from "next/server";
import { and, eq, inArray, notInArray, or } from "drizzle-orm";

import { db } from "@/db";
import {
  chunks,
  documents,
  fileDependencies,
  repositories,
} from "@/db/schema";

import { analyzeSourceFile } from "@/lib/static-analysis";
import { generateChunks } from "@/lib/chunking";

import {
  getRepositoryTree,
  getFileContent,
} from "@/lib/github";

import {
  classifyFile,
  isAllowedFile,
} from "@/lib/ingestion";
import { syncHistoricalDocuments } from "@/lib/historical-ingestion";
import { requireUser } from "@/lib/auth";

const FILE_BATCH_SIZE = 75;
const FILE_WORKER_COUNT = 6;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let ownerUserId: string | null = null;
  try {
    const user = await requireUser();
    ownerUserId = user.id;
    const { id } = await params;

    const [repository] = await db
      .select()
      .from(repositories)
      .where(and(eq(repositories.id, id), eq(repositories.userId, user.id)))
      .limit(1);

    if (!repository) {
      return NextResponse.json(
        { error: "Repository not found" },
        { status: 404 }
      );
    }

    if (repository.indexingStatus === "ready") {
      const historical = await syncHistoricalDocuments(
        id,
        repository.owner,
        repository.name
      );

      return NextResponse.json({
        done: true,
        progress: 100,
        ...historical,
      });
    }

    const owner = repository.owner;
    const repo = repository.name;
    const branch =
      repository.defaultBranch ?? "main";

    await db
      .update(repositories)
      .set({
        indexingStatus: "indexing",
      })
      .where(eq(repositories.id, id));

    const tree = await getRepositoryTree(
      owner,
      repo,
      branch
    );

    const allFiles = tree
      .filter((item) => item.type === "blob")
      .filter((item) => item.path)
      .filter((item) =>
        isAllowedFile(item.path!));
    const files = allFiles.slice(0, 3000);

    const knownPaths = new Set(
      files
        .map((file) => file.path)
        .filter(
          (path): path is string =>
            Boolean(path)
        )
    );

    const cursor = Number(
      repository.indexingCursor ?? "0"
    );

    const batch = files.slice(
      cursor,
      cursor + FILE_BATCH_SIZE
    );

    let nextFileIndex = 0;

    async function processNextFile() {
      while (nextFileIndex < batch.length) {
        const file = batch[nextFileIndex];
        nextFileIndex += 1;

      if (!file.path || !file.sha) {
        continue;
      }

      const contentData =
        await getFileContent(
          owner,
          repo,
          file.path,
          branch
        );

      if (
        !Array.isArray(contentData) &&
        contentData.type === "file" &&
        contentData.encoding === "base64" &&
        contentData.content !== undefined
      ) {
        const content = Buffer.from(
          contentData.content,
          "base64"
        ).toString("utf-8");

        const [existingDocument] = await db
          .select({ id: documents.id })
          .from(documents)
          .where(and(
            eq(documents.repositoryId, id),
            eq(documents.externalId, file.path),
            eq(documents.sha, file.sha),
            eq(documents.currentRevision, true)
          ))
          .limit(1);
        if (existingDocument) {
          continue;
        }

        await db
          .update(documents)
          .set({ currentRevision: false })
          .where(and(
            eq(documents.repositoryId, id),
            eq(documents.externalId, file.path),
            eq(documents.currentRevision, true),
          ));

        await db
          .delete(fileDependencies)
          .where(and(eq(fileDependencies.repositoryId, id), eq(fileDependencies.sourcePath, file.path)));

        const staticAnalysis =
          analyzeSourceFile(
            file.path,
            content,
            knownPaths
          );

        for (const dependency of staticAnalysis.imports) {
          await db
            .insert(fileDependencies)
            .values({
              repositoryId: id,
              sourcePath:
                dependency.sourcePath,
              importedPath:
                dependency.importedPath,
            });
        }

        const documentType =
          classifyFile(file.path);

        const [document] = await db
          .insert(documents)
          .values({
            repositoryId: id,
            type: documentType,
            externalId: file.path,
            path: file.path,
            title:
              file.path.split("/").pop() ??
              file.path,
            content,
            sha: file.sha,
            metadata: {
              language:
                file.path.split(".").pop() ??
                null,
            },
            currentRevision: true,
          })
          .returning();

        const generatedChunks =
          generateChunks({
            documentType,
            path: file.path,
            title:
              file.path.split("/").pop() ??
              file.path,
            content,
            analysis: staticAnalysis,
          });

        if (generatedChunks.length > 0) {
          await db
            .insert(chunks)
            .values(
                generatedChunks.map(
                  (chunk) => ({
                    documentId:
                      document.id,
                    content: chunk.content,
                    chunkType:
                      chunk.chunkType,
                    symbolName:
                      chunk.symbolName ??
                      null,
                    startLine:
                      chunk.startLine ??
                      null,
                    endLine:
                      chunk.endLine ??
                      null,
                    metadata:
                      chunk.metadata ??
                      null,
                  })
                )
              );

        }
      }
      }
    }

    await Promise.all(
      Array.from(
        { length: Math.min(FILE_WORKER_COUNT, batch.length) },
        () => processNextFile()
      )
    );

    // Embeddings are generated by the resumable /embed backfill endpoint.

    const nextCursor =
      cursor + batch.length;

    const done =
      nextCursor >= files.length;

    if (done) {
      if (allFiles.length === files.length) {
        await db.update(documents).set({ currentRevision: false }).where(and(
          eq(documents.repositoryId, id),
          inArray(documents.type, ["source", "test", "documentation"]),
          notInArray(documents.externalId, [...knownPaths, ""]),
          eq(documents.currentRevision, true),
        ));
        await db.delete(fileDependencies).where(and(
          eq(fileDependencies.repositoryId, id),
          or(notInArray(fileDependencies.sourcePath, [...knownPaths]), notInArray(fileDependencies.importedPath, [...knownPaths])),
        ));
      }
      await syncHistoricalDocuments(id, owner, repo);
    }

    await db
      .update(repositories)
      .set({
        indexingCursor:
          String(nextCursor),
        indexedFileCount:
          nextCursor,
        indexingStatus:
          done
            ? "ready"
            : "indexing",
        lastIndexedAt:
          done
            ? new Date()
            : null,
      })
      .where(and(eq(repositories.id, id), eq(repositories.userId, user.id)));

    return NextResponse.json({
      done,
      progress:
        files.length === 0
          ? 100
          : Math.round(
              (nextCursor /
                files.length) *
                100
            ),
      indexedFiles: nextCursor,
      totalFiles: files.length,
    });
  } catch (error) {
    console.error(
      "Indexing failed:",
      error
    );

    const { id } = await params;

    if (ownerUserId) {
      await db
        .update(repositories)
        .set({ indexingStatus: "pending" })
        .where(and(eq(repositories.id, id), eq(repositories.userId, ownerUserId)));
    }

    return NextResponse.json(
      {
        error:
          "Failed to index repository",
      },
      { status: 500 }
    );
  }
}

