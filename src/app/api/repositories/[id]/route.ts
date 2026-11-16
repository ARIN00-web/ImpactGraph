import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { repositories, fileDependencies } from "@/db/schema";
import { requireUser } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const [repository] = await db
      .select()
      .from(repositories)
      .where(and(eq(repositories.id, id), eq(repositories.userId, user.id)))
      .limit(1);

    if (!repository) {
      return NextResponse.json({ error: "Repository not found" }, { status: 404 });
    }

    const dependencies = await db
      .select({
        sourcePath: fileDependencies.sourcePath,
        importedPath: fileDependencies.importedPath,
      })
      .from(fileDependencies)
      .where(eq(fileDependencies.repositoryId, id))
      .limit(60);

    return NextResponse.json({
      repository,
      dependencies,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/repositories/[id] failed:", error);
    return NextResponse.json({ error: "Failed to fetch repository" }, { status: 500 });
  }
}
