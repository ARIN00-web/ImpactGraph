import { NextResponse } from "next/server";
import { and, eq, ilike, or } from "drizzle-orm";

import { db } from "@/db";
import { documents, repositories } from "@/db/schema";
import { getOpenPullRequests } from "@/lib/github";
import { requireUser } from "@/lib/auth";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let user;
  try { user = await requireUser(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const query = new URL(request.url).searchParams.get("q")?.trim();
  const [repository] = await db.select({ id: repositories.id, owner: repositories.owner, name: repositories.name }).from(repositories).where(and(eq(repositories.id, id), eq(repositories.userId, user.id))).limit(1);
  if (!repository) return NextResponse.json({ error: "Repository not found" }, { status: 404 });

  const rows = await db.select({ number: documents.externalId, title: documents.title, content: documents.content, metadata: documents.metadata })
    .from(documents)
    .where(and(eq(documents.repositoryId, id), eq(documents.type, "pull_request"), query ? or(ilike(documents.title, `%${query}%`), ilike(documents.content, `%${query}%`)) : undefined));

  const openPullRequests = await getOpenPullRequests(repository.owner, repository.name);
  const openRows = openPullRequests
    .filter((pullRequest) => !query || `${pullRequest.title} ${pullRequest.body ?? ""}`.toLowerCase().includes(query.toLowerCase()))
    .map((pullRequest) => ({
      number: String(pullRequest.number),
      title: pullRequest.title,
      content: pullRequest.body,
      metadata: { htmlUrl: pullRequest.html_url, state: "open", author: pullRequest.user?.login ?? null, changedFiles: null },
    }));

  const mergedRows = rows.map((row) => ({ ...row, metadata: { ...(row.metadata && typeof row.metadata === "object" ? row.metadata : {}), state: "merged" } }));
  return NextResponse.json([...openRows, ...mergedRows]);
}
