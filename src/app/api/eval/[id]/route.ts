import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { evalCases, evalRuns, repositories } from "@/db/schema";
import { requireUser } from "@/lib/auth";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let user;
  try { user = await requireUser(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const [run] = await db.select({ run: evalRuns }).from(evalRuns).innerJoin(repositories, eq(repositories.id, evalRuns.repositoryId)).where(and(eq(evalRuns.id, id), eq(repositories.userId, user.id))).limit(1).then((items) => items.map((item) => item.run));
  if (!run) return NextResponse.json({ error: "Evaluation run not found" }, { status: 404 });
  const cases = await db.select().from(evalCases).where(eq(evalCases.evalRunId, id)).orderBy(asc(evalCases.prNumber));
  return NextResponse.json({ run, cases });
}
