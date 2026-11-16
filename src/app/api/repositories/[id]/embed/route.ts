import { NextResponse } from "next/server";
import { and, count, eq, isNull, lt, or } from "drizzle-orm";
import { db } from "@/db";
import { chunks, documents, repositories } from "@/db/schema";
import { generateEmbeddings, GeminiQuotaExhaustedError } from "@/lib/embeddings";
import { requireUser } from "@/lib/auth";

// Gemini's embedContent endpoint accepts up to 100 texts in one request.
const DEFAULT_BATCH_SIZE = 100;
const MAX_BATCH_SIZE = 100;
const STALE_JOB_MS = 10 * 60 * 1000;

function getBatchSize() {
  const configured = Number.parseInt(process.env.GEMINI_EMBED_BATCH_SIZE ?? "", 10);
  return Number.isFinite(configured) ? Math.min(Math.max(configured, 1), MAX_BATCH_SIZE) : DEFAULT_BATCH_SIZE;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  void request;
  const { id } = await params;
  let user;
  try { user = await requireUser(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const startedAt = new Date();
  try {
    const [repository] = await db.select({ id: repositories.id }).from(repositories).where(and(eq(repositories.id, id), eq(repositories.userId, user.id))).limit(1);
    if (!repository) return NextResponse.json({ error: "Repository not found" }, { status: 404 });
    const claimed = await db.update(repositories).set({ embeddingStatus: "running", embeddingStartedAt: startedAt }).where(and(
      eq(repositories.id, id), eq(repositories.userId, user.id), or(eq(repositories.embeddingStatus, "idle"), and(eq(repositories.embeddingStatus, "running"), lt(repositories.embeddingStartedAt, new Date(Date.now() - STALE_JOB_MS))))
    )).returning({ id: repositories.id });
    if (claimed.length === 0) return NextResponse.json({ status: "already_running", message: "An embedding job is already running for this repository." }, { status: 409 });

    const [{ total }] = await db.select({ total: count(chunks.id) }).from(chunks).innerJoin(documents, eq(chunks.documentId, documents.id)).where(eq(documents.repositoryId, id));
    const totalChunks = Number(total);
    const size = getBatchSize();
    let processed = 0;
    let quotaExhausted = false;
    while (true) {
      const pending = await db.select({ id: chunks.id, content: chunks.content }).from(chunks).innerJoin(documents, eq(chunks.documentId, documents.id)).where(and(eq(documents.repositoryId, id), isNull(chunks.embedding))).orderBy(chunks.id).limit(size);
      if (pending.length === 0) break;
      console.log(`Embedding repository ${id}: processing batch of ${pending.length}`);
      try {
        const embeddings = await generateEmbeddings(pending.map((chunk) => chunk.content));
        for (let index = 0; index < pending.length; index++) {
          await db.update(chunks).set({ embedding: embeddings[index] }).where(and(eq(chunks.id, pending[index].id), isNull(chunks.embedding)));
        }
        processed += pending.length;
        console.log(`Embedding repository ${id}: saved ${processed} embeddings`);
      } catch (error) {
        if (error instanceof GeminiQuotaExhaustedError) { quotaExhausted = true; break; }
        throw error;
      }
    }
    const [{ remaining }] = await db.select({ remaining: count(chunks.id) }).from(chunks).innerJoin(documents, eq(chunks.documentId, documents.id)).where(and(eq(documents.repositoryId, id), isNull(chunks.embedding)));
    const remainingChunks = Number(remaining);
    await db.update(repositories).set({ embeddingStatus: "idle", embeddingStartedAt: null }).where(and(eq(repositories.id, id), eq(repositories.userId, user.id), eq(repositories.embeddingStartedAt, startedAt)));
    const progress = totalChunks === 0 ? 100 : Math.round(((totalChunks - remainingChunks) / totalChunks) * 100);
    if (quotaExhausted) return NextResponse.json({ status: "quota_exhausted", processed, remaining: remainingChunks, progress, message: "Gemini embedding daily quota exhausted. Already processed embeddings were saved. Run the job again after the quota resets." });
    return NextResponse.json({ status: "complete", done: remainingChunks === 0, processed, remaining: remainingChunks, progress });
  } catch (error) {
    console.error(`Embedding backfill failed for repository ${id}:`, error);
    await db.update(repositories).set({ embeddingStatus: "idle", embeddingStartedAt: null }).where(and(eq(repositories.id, id), eq(repositories.userId, user.id), eq(repositories.embeddingStartedAt, startedAt)));
    return NextResponse.json({ error: "Failed to generate embeddings" }, { status: 500 });
  }
}
