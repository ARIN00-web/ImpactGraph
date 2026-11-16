import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { analyses, documents, evidence, findings, chunks, repositories, fileDependencies } from "@/db/schema";
import { requireUser } from "@/lib/auth";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let user;
  try { user = await requireUser(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const [analysis] = await db.select({ analysis: analyses }).from(analyses).innerJoin(repositories, eq(repositories.id, analyses.repositoryId)).where(and(eq(analyses.id, id), eq(repositories.userId, user.id))).limit(1);
  if (!analysis) return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
  const analysisRow = analysis.analysis;
  const [repository] = await db.select({ owner: repositories.owner, name: repositories.name, defaultBranch: repositories.defaultBranch }).from(repositories).where(eq(repositories.id, analysisRow.repositoryId)).limit(1);

  const rows = await db.select({
    finding: findings,
    evidence: evidence,
    document: { path: documents.path, title: documents.title, sha: documents.sha, metadata: documents.metadata },
    chunk: { content: chunks.content, startLine: chunks.startLine, endLine: chunks.endLine, chunkType: chunks.chunkType, symbolName: chunks.symbolName },
  })
    .from(findings)
    .leftJoin(evidence, eq(evidence.findingId, findings.id))
    .leftJoin(documents, eq(documents.id, evidence.documentId))
    .leftJoin(chunks, eq(chunks.id, evidence.chunkId))
    .where(eq(findings.analysisId, id));

  const grouped = new Map<string, { finding: typeof rows[number]["finding"]; evidence: unknown[] }>();
  for (const row of rows) {
    const existing = grouped.get(row.finding.id) ?? { finding: row.finding, evidence: [] };
    if (row.evidence) existing.evidence.push({ ...row.evidence, document: row.document, chunk: row.chunk });
    grouped.set(row.finding.id, existing);
  }

  const details = analysisRow.reviewDetails as { changedPaths?: unknown } | null;
  const savedPaths = Array.isArray(details?.changedPaths) ? details.changedPaths.filter((path): path is string => typeof path === "string") : null;
  const changedPaths = savedPaths ?? (analysisRow.inputType === "pr" && analysisRow.inputText?.includes("Changed files:")
    ? analysisRow.inputText.split("Changed files:")[1].split(/\r?\n/).map((path) => path.trim()).filter(Boolean)
    : []);
  const indexedChangedDocuments = changedPaths.length > 0
    ? await db.select({ path: documents.path }).from(documents).where(and(
      eq(documents.repositoryId, analysisRow.repositoryId),
      eq(documents.currentRevision, true),
      inArray(documents.path, changedPaths),
    ))
    : [];
  const indexedChangedPaths = new Set(indexedChangedDocuments.map((document) => document.path).filter((path): path is string => Boolean(path)));
  const unindexedPaths = changedPaths.filter((path) => !indexedChangedPaths.has(path));

  const allDependencies = changedPaths.length > 0
    ? await db.select({ sourcePath: fileDependencies.sourcePath, importedPath: fileDependencies.importedPath })
      .from(fileDependencies)
      .where(eq(fileDependencies.repositoryId, analysisRow.repositoryId))
    : [];
  const importersByDependency = new Map<string, typeof allDependencies>();
  for (const edge of allDependencies) {
    const importers = importersByDependency.get(edge.importedPath) ?? [];
    importers.push(edge);
    importersByDependency.set(edge.importedPath, importers);
  }

  const impactDepth = new Map(changedPaths.map((path) => [path, 0]));
  const graphDependencies: typeof allDependencies = [];
  let frontier = [...new Set(changedPaths)];
  for (let depth = 1; depth <= 4 && frontier.length > 0 && impactDepth.size < 60; depth += 1) {
    const next = new Set<string>();
    for (const dependencyPath of frontier) {
      for (const edge of importersByDependency.get(dependencyPath) ?? []) {
        const existingDepth = impactDepth.get(edge.sourcePath);
        if (existingDepth === undefined && impactDepth.size < 60) {
          impactDepth.set(edge.sourcePath, depth);
          next.add(edge.sourcePath);
        }
        if (impactDepth.get(edge.sourcePath) === depth) {
          graphDependencies.push(edge);
        }
      }
    }
    frontier = [...next];
  }

  return NextResponse.json({ analysis: analysisRow, repository, findings: [...grouped.values()], dependencies: graphDependencies, changedPaths, unindexedPaths });
}
