import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { evalRuns, repositories } from "@/db/schema";
import { createEvaluationRun, processEvaluationBatch } from "@/lib/evaluation";
import { requireUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    let body: Record<string, unknown>;
    try { body = await request.json() as Record<string, unknown>; } catch { return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 }); }
    if (typeof body?.repositoryId !== "string") return NextResponse.json({ error: "repositoryId is required" }, { status: 400 });
    const [repository] = await db.select({ id: repositories.id }).from(repositories).where(and(eq(repositories.id, body.repositoryId), eq(repositories.userId, user.id))).limit(1);
    if (!repository) return NextResponse.json({ error: "Repository not found" }, { status: 404 });
    let runId = typeof body.evalRunId === "string" ? body.evalRunId : null;
    if (!runId) runId = (await createEvaluationRun(body.repositoryId)).id;
    else {
      const [ownedRun] = await db.select({ id: evalRuns.id }).from(evalRuns).innerJoin(repositories, eq(repositories.id, evalRuns.repositoryId)).where(and(eq(evalRuns.id, runId), eq(evalRuns.repositoryId, body.repositoryId), eq(repositories.userId, user.id))).limit(1);
      if (!ownedRun) return NextResponse.json({ error: "Evaluation run not found" }, { status: 404 });
    }
    return NextResponse.json(await processEvaluationBatch(runId));
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("POST /api/eval/run failed:", error);
    return NextResponse.json({ error: "Evaluation batch failed" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  let user;
  try { user = await requireUser(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const repositoryId = new URL(request.url).searchParams.get("repositoryId");
  const rows = repositoryId ? await db.select({ run: evalRuns }).from(evalRuns).innerJoin(repositories, eq(repositories.id, evalRuns.repositoryId)).where(and(eq(evalRuns.repositoryId, repositoryId), eq(repositories.userId, user.id))).then((items) => items.map((item) => item.run)) : await db.select({ run: evalRuns }).from(evalRuns).innerJoin(repositories, eq(repositories.id, evalRuns.repositoryId)).where(eq(repositories.userId, user.id)).then((items) => items.map((item) => item.run));
  return NextResponse.json(rows);
}
