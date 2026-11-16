import { sql } from "drizzle-orm";

import { db } from "@/db";
import { generateEmbeddings } from "@/lib/embeddings";

const SEMANTIC_CANDIDATE_LIMIT = 50;
const LEXICAL_CANDIDATE_LIMIT = 50;
const FINAL_RESULT_LIMIT = 20;
const MAX_CONTEXT_CHARACTERS = 32000;
const MAX_CHUNKS_PER_PATH = 4;

const SEMANTIC_WEIGHT = 0.45;
const LEXICAL_WEIGHT = 0.30;
const STRUCTURAL_WEIGHT = 0.15;
const RECENCY_WEIGHT = 0.10;

export type RetrievalResult = {
  chunkId: string;
  documentId: string;
  path: string | null;
  title: string | null;
  chunkType: string;
  symbolName: string | null;
  startLine: number | null;
  endLine: number | null;
  content: string;

  semanticScore: number;
  lexicalScore: number;
  structuralScore: number;
  recencyScore: number;
  score: number;
};

type Candidate = RetrievalResult & {
  sourcePath: string | null;
};

type DatabaseRow = {
  chunk_id: string;
  document_id: string;
  path: string | null;
  title: string | null;
  chunk_type: string;
  symbol_name: string | null;
  start_line: number | null;
  end_line: number | null;
  content: string;
};

type SemanticRow = DatabaseRow & {
  semantic_score: number;
};

type LexicalRow = DatabaseRow & {
  lexical_score: number;
};

type DependencyRow = {
  source_path: string;
  imported_path: string;
};

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function normalizeScores(
  values: number[]
): number[] {
  if (values.length === 0) {
    return [];
  }

  const min = Math.min(...values);
  const max = Math.max(...values);

  if (max === min) {
    return values.map(() => 1);
  }

  return values.map(
    (value) =>
      (value - min) / (max - min)
  );
}

/**
 * Gives newer documents a higher score.
 *
 * We intentionally keep this simple for MVP:
 * 0 days old = 1
 * 365+ days old = 0
 *
 * Note:
 * source files are created during ingestion, so this signal is
 * much more meaningful for PRs/issues than for source files.
 */
function calculateRecencyScore(
  createdAt: Date | string | null
) {
  if (!createdAt) {
    return 0;
  }

  const timestamp =
    createdAt instanceof Date
      ? createdAt.getTime()
      : new Date(createdAt).getTime();

  if (!Number.isFinite(timestamp)) {
    return 0;
  }

  const ageDays =
    (Date.now() - timestamp) /
    (1000 * 60 * 60 * 24);

  return clamp(1 - ageDays / 365);
}

async function getSemanticCandidates(
  repositoryId: string,
  queryEmbedding: number[]
) {
  const vector = JSON.stringify(queryEmbedding);

  const rows = await db.execute<SemanticRow>(sql`
    SELECT
      c.id AS chunk_id,
      c.document_id,
      d.path,
      d.title,
      c.chunk_type,
      c.symbol_name,
      c.start_line,
      c.end_line,
      c.content,
      (
        1 - (
          c.embedding <=> ${vector}::vector
        )
      )::float8 AS semantic_score
    FROM chunks c
    INNER JOIN documents d
      ON d.id = c.document_id
    WHERE
      d.repository_id = ${repositoryId}
      AND d.current_revision = true
      AND c.embedding IS NOT NULL
    ORDER BY c.embedding <=> ${vector}::vector
    LIMIT ${SEMANTIC_CANDIDATE_LIMIT}
  `);

  return rows;
}

async function getLexicalCandidates(
  repositoryId: string,
  query: string
) {
  const rows = await db.execute<LexicalRow>(sql`
    SELECT
      c.id AS chunk_id,
      c.document_id,
      d.path,
      d.title,
      c.chunk_type,
      c.symbol_name,
      c.start_line,
      c.end_line,
      c.content,
      ts_rank(
        to_tsvector(
          'english',
          regexp_replace(
            coalesce(c.content, ''),
            '([^[:space:]]{255})[^[:space:]]+',
            ' ',
            'g'
          )
        ),
        plainto_tsquery(
          'english',
          ${query}
        )
      )::float8 AS lexical_score
    FROM chunks c
    INNER JOIN documents d
      ON d.id = c.document_id
    WHERE
      d.repository_id = ${repositoryId}
      AND d.current_revision = true
      AND c.embedding IS NOT NULL
      AND to_tsvector(
        'english',
        regexp_replace(
          coalesce(c.content, ''),
          '([^[:space:]]{255})[^[:space:]]+',
          ' ',
          'g'
        )
      ) @@ plainto_tsquery(
        'english',
        ${query}
      )
    ORDER BY lexical_score DESC
    LIMIT ${LEXICAL_CANDIDATE_LIMIT}
  `);

  return rows;
}

async function getChangedFileCandidates(
  repositoryId: string,
  paths: string[]
) {
  if (paths.length === 0) return [];

  return db.execute<DatabaseRow>(sql`
    SELECT
      c.id AS chunk_id,
      c.document_id,
      d.path,
      d.title,
      c.chunk_type,
      c.symbol_name,
      c.start_line,
      c.end_line,
      c.content
    FROM chunks c
    INNER JOIN documents d ON d.id = c.document_id
    WHERE d.repository_id = ${repositoryId}
      AND d.path IN (${sql.join(paths.map((path) => sql`${path}`), sql`, `)})
      AND d.current_revision = true
      AND c.embedding IS NOT NULL
    ORDER BY d.path, c.start_line NULLS FIRST
    LIMIT 50
  `);
}

async function getStructuralEdges(
  repositoryId: string,
  paths: string[]
) {
  if (paths.length === 0) {
    return [];
  }

  const result =
    await db.execute<DependencyRow>(sql`
      SELECT
        source_path,
        imported_path
      FROM file_dependencies
      WHERE
        repository_id = ${repositoryId}
        AND (
         source_path IN (${sql.join(
            paths.map((path) => sql`${path}`),
            sql`, `
            )})
            OR imported_path IN (${sql.join(
            paths.map((path) => sql`${path}`),
            sql`, `
            )})
        )
    `);

  return result;
}

async function getRecencyDates(
  repositoryId: string,
  documentIds: string[]
) {
  if (documentIds.length === 0) {
    return new Map<string, Date>();
  }

  const rows = await db.execute<{
    document_id: string;
    created_at: Date | string;
  }>(sql`
    SELECT
      id AS document_id,
      created_at
    FROM documents
    WHERE
      repository_id = ${repositoryId}
      AND current_revision = true
            AND id IN (${sql.join(
                documentIds.map((documentId) => sql`${documentId}`),
                sql`, `
        )})
  `);

  return new Map(
    rows.map((row) => [
      row.document_id,
      new Date(row.created_at),
    ])
  );
}

export async function retrieveRelevantChunks({
  repositoryId,
  query,
  paths = [],
}: {
  repositoryId: string;
  query: string;
  paths?: string[];
}): Promise<RetrievalResult[]> {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return [];
  }

  const [queryEmbedding] =
    await generateEmbeddings([
      trimmedQuery,
    ]);

  const [
    semanticCandidates,
    lexicalCandidates,
    changedFileCandidates,
  ] = await Promise.all([
    getSemanticCandidates(
      repositoryId,
      queryEmbedding
    ),
    getLexicalCandidates(
      repositoryId,
      trimmedQuery
    ),
    getChangedFileCandidates(repositoryId, paths),
  ]);

  const candidates = new Map<
    string,
    Candidate
  >();

  const semanticValues =
    normalizeScores(
      semanticCandidates.map(
        (candidate) =>
          Number(
            candidate.semantic_score
          )
      )
    );

  semanticCandidates.forEach(
    (candidate, index) => {
      candidates.set(
        candidate.chunk_id,
        {
          chunkId:
            candidate.chunk_id,
          documentId:
            candidate.document_id,
          path: candidate.path,
          title: candidate.title,
          chunkType:
            candidate.chunk_type,
          symbolName:
            candidate.symbol_name,
          startLine:
            candidate.start_line,
          endLine:
            candidate.end_line,
          content:
            candidate.content,
          semanticScore:
            clamp(
              semanticValues[index]
            ),
          lexicalScore: 0,
          structuralScore: 0,
          recencyScore: 0,
          score: 0,
          sourcePath:
            candidate.path,
        }
      );
    }
  );

  const lexicalValues =
    normalizeScores(
      lexicalCandidates.map(
        (candidate) =>
          Number(
            candidate.lexical_score
          )
      )
    );

  lexicalCandidates.forEach(
    (candidate, index) => {
      const existing =
        candidates.get(
          candidate.chunk_id
        );

      if (existing) {
        existing.lexicalScore =
          clamp(
            lexicalValues[index]
          );
      } else {
        candidates.set(
          candidate.chunk_id,
          {
            chunkId:
              candidate.chunk_id,
            documentId:
              candidate.document_id,
            path: candidate.path,
            title:
              candidate.title,
            chunkType:
              candidate.chunk_type,
            symbolName:
              candidate.symbol_name,
            startLine:
              candidate.start_line,
            endLine:
              candidate.end_line,
            content:
              candidate.content,
            semanticScore: 0,
            lexicalScore:
              clamp(
                lexicalValues[index]
              ),
            structuralScore: 0,
            recencyScore: 0,
            score: 0,
            sourcePath:
              candidate.path,
          }
        );
      }
    }
  );

  changedFileCandidates.forEach((candidate) => {
    const existing = candidates.get(candidate.chunk_id);
    if (existing) {
      existing.structuralScore = 1;
      return;
    }

    candidates.set(candidate.chunk_id, {
      chunkId: candidate.chunk_id,
      documentId: candidate.document_id,
      path: candidate.path,
      title: candidate.title,
      chunkType: candidate.chunk_type,
      symbolName: candidate.symbol_name,
      startLine: candidate.start_line,
      endLine: candidate.end_line,
      content: candidate.content,
      semanticScore: 0,
      lexicalScore: 0,
      structuralScore: 1,
      recencyScore: 0,
      score: 0,
      sourcePath: candidate.path,
    });
  });

  const seedPaths = Array.from(
    candidates.values()
  )
    .map(
      (candidate) =>
        candidate.sourcePath
    )
    .filter(
      (path): path is string =>
        Boolean(path)
    );

  const uniqueSeedPaths = [
    ...new Set(seedPaths),
  ];

  const dependencies =
    await getStructuralEdges(
      repositoryId,
      uniqueSeedPaths
    );

  const seedPathSet = new Set(
    uniqueSeedPaths
  );

  const structuralPaths =
    new Set<string>();

  for (const dependency of dependencies) {
    if (
      seedPathSet.has(
        dependency.source_path
      )
    ) {
      structuralPaths.add(
        dependency.imported_path
      );
    }

    if (
      seedPathSet.has(
        dependency.imported_path
      )
    ) {
      structuralPaths.add(
        dependency.source_path
      );
    }
  }

  for (const candidate of candidates.values()) {
    if (
      candidate.sourcePath &&
      structuralPaths.has(
        candidate.sourcePath
      )
    ) {
      candidate.structuralScore = 1;
    }
  }

  const documentIds = [
    ...new Set(
      Array.from(candidates.values()).map(
        (candidate) =>
          candidate.documentId
      )
    ),
  ];

  const recencyDates =
    await getRecencyDates(
      repositoryId,
      documentIds
    );

  for (const candidate of candidates.values()) {
    const createdAt =
      recencyDates.get(
        candidate.documentId
      ) ?? null;

    candidate.recencyScore =
      calculateRecencyScore(
        createdAt
      );

    candidate.score =
      SEMANTIC_WEIGHT *
        candidate.semanticScore +
      LEXICAL_WEIGHT *
        candidate.lexicalScore +
      STRUCTURAL_WEIGHT *
        candidate.structuralScore +
      RECENCY_WEIGHT *
        candidate.recencyScore;
  }

  const selected: Candidate[] = [];
  const pathCounts = new Map<string, number>();
  let contextCharacters = 0;
  for (const candidate of Array.from(candidates.values()).sort((a, b) => b.score - a.score)) {
    const path = candidate.path ?? candidate.chunkId;
    const count = pathCounts.get(path) ?? 0;
    if (count >= MAX_CHUNKS_PER_PATH) continue;
    if (selected.length > 0 && contextCharacters + candidate.content.length > MAX_CONTEXT_CHARACTERS) continue;
    selected.push(candidate);
    pathCounts.set(path, count + 1);
    contextCharacters += candidate.content.length;
    if (selected.length >= FINAL_RESULT_LIMIT) break;
  }

  return selected
    .map((candidate) =>
      Object.fromEntries(
        Object.entries(candidate).filter(
          ([key]) => key !== "sourcePath"
        )
      ) as RetrievalResult
    );
}

