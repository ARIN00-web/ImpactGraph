import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { repositories } from "@/db/schema";
import { retrieveRelevantChunks } from "@/lib/retrieval";
import { requireUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    let body: Record<string, unknown>;
    try { body = await request.json() as Record<string, unknown>; } catch { return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 }); }

    const repositoryId = body.repositoryId;
    const query = body.query;

    if (
      typeof repositoryId !== "string" ||
      typeof query !== "string"
    ) {
      return NextResponse.json(
        {
          error:
            "repositoryId and query are required",
        },
        { status: 400 }
      );
    }

    const [owned] = await db.select({ id: repositories.id }).from(repositories).where(and(eq(repositories.id, repositoryId), eq(repositories.userId, user.id))).limit(1);
    if (!owned) return NextResponse.json({ error: "Repository not found" }, { status: 404 });

    const results = await retrieveRelevantChunks({
      repositoryId,
      query,
    });

    return NextResponse.json({
      count: results.length,
      results: results.map((result, index) => ({
        rank: index + 1,
        path: result.path,
        chunkType: result.chunkType,
        symbolName: result.symbolName,
        startLine: result.startLine,
        endLine: result.endLine,
        semanticScore: Number(
          result.semanticScore.toFixed(4)
        ),
        lexicalScore: Number(
          result.lexicalScore.toFixed(4)
        ),
        structuralScore: Number(
          result.structuralScore.toFixed(4)
        ),
        recencyScore: Number(
          result.recencyScore.toFixed(4)
        ),
        finalScore: Number(
          result.score.toFixed(4)
        ),
        content: result.content,
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error(
      "Retrieval test failed:",
      error
    );

    return NextResponse.json(
      {
        error: "Retrieval test failed",
      },
      { status: 500 }
    );
  }
}
