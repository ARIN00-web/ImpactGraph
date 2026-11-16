import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { analyses, repositories } from "@/db/schema";
import { requireUser } from "@/lib/auth";

export async function GET() {
  let user;
  try { user = await requireUser(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const rows = await db.select({ analysis: analyses, owner: repositories.owner, name: repositories.name }).from(analyses).innerJoin(repositories, eq(repositories.id, analyses.repositoryId)).where(eq(repositories.userId, user.id)).orderBy(desc(analyses.createdAt)).limit(100);
  return NextResponse.json(rows.map((row) => ({ ...row.analysis, repository: { owner: row.owner, name: row.name } })));
}
