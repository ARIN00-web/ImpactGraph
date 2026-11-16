import { and, asc, count, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { documents, evalCases, evalRuns } from "@/db/schema";
import { analyzeChange } from "@/lib/analysis";
import { verifyFinding } from "@/lib/grounding";
import { getPullRequestFiles } from "@/lib/github";
import { retrieveRelevantChunks } from "@/lib/retrieval";
import { calculateRecallAtK, calculateReciprocalRank } from "@/lib/evaluation-metrics";

const CASE_BATCH_SIZE = 5;
const MAX_CASES = 50;

function normalizePath(path: string) {
  return path.replace(/^\/+/, "").toLowerCase();
}

function rankedFiles(chunks: Awaited<ReturnType<typeof retrieveRelevantChunks>>) {
  return [...new Set(chunks.map((chunk) => chunk.path).filter((path): path is string => Boolean(path)).map(normalizePath))];
}

export async function createEvaluationRun(repositoryId: string) {
  const [total] = await db
    .select({ total: count(documents.id) })
    .from(documents)
    .where(and(eq(documents.repositoryId, repositoryId), eq(documents.type, "pull_request")));

  const totalCases = Math.min(Number(total.total), MAX_CASES);
  const [run] = await db.insert(evalRuns).values({ repositoryId, totalCases, status: "running" }).returning();
  return run;
}

export async function processEvaluationBatch(runId: string) {
  const [run] = await db.select().from(evalRuns).where(eq(evalRuns.id, runId)).limit(1);
  if (!run) throw new Error("Evaluation run not found");

  const prs = await db
    .select({ externalId: documents.externalId, title: documents.title, content: documents.content })
    .from(documents)
    .where(and(eq(documents.repositoryId, run.repositoryId), eq(documents.type, "pull_request")))
    .orderBy(asc(documents.createdAt))
    .limit(MAX_CASES);

  const ownerRepo = await db.execute<{ owner: string; name: string }>(sql`
    SELECT owner, name FROM repositories WHERE id = ${run.repositoryId}
  `);
  const repository = ownerRepo[0];
  if (!repository) throw new Error("Repository not found");

  const batch = prs.slice(run.cursor, run.cursor + CASE_BATCH_SIZE);
  const existingCases = await db.select({ prNumber: evalCases.prNumber }).from(evalCases).where(eq(evalCases.evalRunId, run.id));
  const existingPrNumbers = new Set(existingCases.map((item) => item.prNumber));

  for (const pr of batch) {
    const prNumber = Number(pr.externalId);
    if (!Number.isInteger(prNumber)) continue;
    if (existingPrNumbers.has(prNumber)) continue;

    const change = [pr.title, pr.content].filter(Boolean).join("\n\n");
    const retrieved = await retrieveRelevantChunks({ repositoryId: run.repositoryId, query: change });
    const predicted = rankedFiles(retrieved);
    const actualResponse = await getPullRequestFiles(repository.owner, repository.name, prNumber);
    const actual = [...new Set(actualResponse.map((file) => normalizePath(file.filename)))];
    const recallAt5 = calculateRecallAtK(actual, predicted, 5);
    const recallAt10 = calculateRecallAtK(actual, predicted, 10);
    const hitAt5 = recallAt5 > 0;
    const hitAt10 = recallAt10 > 0;
    const reciprocalRank = calculateReciprocalRank(actual, predicted);
    const llmEvidence = retrieved.map((chunk) => ({ id: chunk.chunkId, content: chunk.content, path: chunk.path, chunkType: chunk.chunkType }));
    const result = await analyzeChange(change, llmEvidence);
    const retrievedIds = new Set(retrieved.map((chunk) => chunk.chunkId));
    const grounding = result.findings.map((finding) => verifyFinding(finding, retrievedIds));

    await db.insert(evalCases).values({
      evalRunId: run.id,
      prNumber,
      prTitle: pr.title,
      predictedFiles: predicted,
      actualFiles: actual,
      hit: hitAt10,
      hitAt5,
      hitAt10,
      recallAt5,
      recallAt10,
      reciprocalRank,
      groundingVerifiedCount: grounding.filter((item) => item.verified).length,
      groundingTotalCount: grounding.length,
    });
    existingPrNumbers.add(prNumber);
  }

  const nextCursor = Math.min(run.cursor + batch.length, run.totalCases);
  const [metrics] = await db
    .select({
      recallAt5: sql<number>`coalesce(avg(${evalCases.recallAt5}), 0)`,
      recallAt10: sql<number>`coalesce(avg(${evalCases.recallAt10}), 0)`,
      mrr: sql<number>`coalesce(avg(${evalCases.reciprocalRank}), 0)`,
      groundingRate: sql<number>`coalesce(sum(${evalCases.groundingVerifiedCount})::real / nullif(sum(${evalCases.groundingTotalCount}), 0), 0)`,
    })
    .from(evalCases)
    .where(eq(evalCases.evalRunId, run.id));
  const status = nextCursor >= run.totalCases ? "complete" : "running";
  const [updated] = await db.update(evalRuns).set({ cursor: nextCursor, status, recallAt5: metrics.recallAt5, recallAt10: metrics.recallAt10, mrr: metrics.mrr, groundingRate: metrics.groundingRate }).where(eq(evalRuns.id, run.id)).returning();
  return { run: updated, processed: batch.length, progress: run.totalCases === 0 ? 100 : Math.round((nextCursor / run.totalCases) * 100) };
}
