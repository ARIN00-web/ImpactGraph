import { NextResponse } from "next/server";
import { and, count, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { chunks, documents, repositories } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import {
  getGitHubRepository,
  parseGitHubUrl,
} from "@/lib/github";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    let body: Record<string, unknown>;
    try { body = await request.json() as Record<string, unknown>; } catch { return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 }); }
    const url = body?.url;

    if (typeof url !== "string" || !url.trim()) {
      return NextResponse.json(
        { error: "GitHub repository URL is required" },
        { status: 400 }
      );
    }

    const { owner, repo, normalizedUrl } = parseGitHubUrl(url);

    let githubRepository;

    try {
      githubRepository = await getGitHubRepository(owner, repo);
    } catch (error: unknown) {
      const status =
        typeof error === "object" &&
        error !== null &&
        "status" in error
          ? Number(error.status)
          : undefined;

      if (status === 404) {
        return NextResponse.json(
          { error: "GitHub repository does not exist" },
          { status: 404 }
        );
      }

      throw error;
    }

    if (githubRepository.private) {
      return NextResponse.json(
        { error: "Only public repositories are supported" },
        { status: 400 }
      );
    }

    const existingRepository = await db
      .select()
      .from(repositories)
      .where(
        and(
          eq(repositories.owner, owner),
          eq(repositories.name, repo),
          eq(repositories.userId, user.id)
        )
      )
      .limit(1);

    if (existingRepository.length > 0) {
      return NextResponse.json(
        {
          error: "Repository is already connected",
          repository: existingRepository[0],
        },
        { status: 409 }
      );
    }

    const [repository] = await db
      .insert(repositories)
      .values({
        userId: user.id,
        owner,
        name: repo,
        githubUrl: normalizedUrl,
        defaultBranch: githubRepository.default_branch,
        indexingStatus: "pending",
        indexedFileCount: 0,
      })
      .returning();

    return NextResponse.json(repository, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("POST /api/repositories failed:", error);

    return NextResponse.json(
      { error: "Failed to connect repository" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const user = await requireUser();
    const repositoryList = await db
      .select()
      .from(repositories)
      .where(eq(repositories.userId, user.id))
      .limit(100);

    const enriched = await Promise.all(repositoryList.map(async (repository) => {
      const [chunkTotals] = await db.select({ total: count(chunks.id) }).from(chunks).innerJoin(documents, eq(chunks.documentId, documents.id)).where(eq(documents.repositoryId, repository.id));
      const [pendingTotals] = await db.select({ total: count(chunks.id) }).from(chunks).innerJoin(documents, eq(chunks.documentId, documents.id)).where(and(eq(documents.repositoryId, repository.id), isNull(chunks.embedding)));
      return { ...repository, chunkCount: Number(chunkTotals?.total ?? 0), embeddingPendingCount: Number(pendingTotals?.total ?? 0) };
    }));
    return NextResponse.json(enriched);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("GET /api/repositories failed:", error);

    return NextResponse.json(
      { error: "Failed to fetch repositories" },
      { status: 500 }
    );
  }
}
