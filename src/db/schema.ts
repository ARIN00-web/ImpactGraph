import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  real,
  vector,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  googleSubject: text("google_subject").notNull(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("users_google_subject_unique").on(table.googleSubject),
  uniqueIndex("users_email_unique").on(table.email),
]);

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
]);



// REPOSITORIES
// One row per connected GitHub repository

export const repositories = pgTable("repositories", {
  id: uuid("id").defaultRandom().primaryKey(),

  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),

  owner: text("owner").notNull(),

  name: text("name").notNull(),

  githubUrl: text("github_url").notNull(),

  defaultBranch: text("default_branch"),

  indexingStatus: text("indexing_status")
    .notNull()
    .default("pending"),

  indexedFileCount: integer("indexed_file_count")
    .notNull()
    .default(0),

  indexingCursor: text("indexing_cursor"),

  lastIndexedAt: timestamp("last_indexed_at"),

  embeddingStatus: text("embedding_status").notNull().default("idle"),

  embeddingStartedAt: timestamp("embedding_started_at"),
});



// DOCUMENTS
// Normalized storage for files, PRs, issues, docs

export const documents = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey(),

  repositoryId: uuid("repository_id")
    .notNull()
    .references(() => repositories.id, {
      onDelete: "cascade",
    }),

  type: text("type").notNull(),

  externalId: text("external_id"),

  path: text("path"),

  title: text("title"),

  content: text("content").notNull(),

  sha: text("sha"),

  metadata: jsonb("metadata"),

  createdAt: timestamp("created_at")
    .notNull()
    .defaultNow(),

  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow(),

  currentRevision: boolean("current_revision")
    .notNull()
    .default(true),
});


// CHUNKS
// Structure-aware chunks + embeddings

export const chunks = pgTable("chunks", {
  id: uuid("id").defaultRandom().primaryKey(),

  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, {
      onDelete: "cascade",
    }),

  content: text("content").notNull(),

  embedding: vector("embedding", {
    dimensions: 1536,
  }),

  chunkType: text("chunk_type").notNull(),

  symbolName: text("symbol_name"),

  startLine: integer("start_line"),

  endLine: integer("end_line"),

  metadata: jsonb("metadata"),
});



// FILE_DEPENDENCIES
// Static import graph

export const fileDependencies = pgTable("file_dependencies", {
  id: uuid("id").defaultRandom().primaryKey(),

  repositoryId: uuid("repository_id")
    .notNull()
    .references(() => repositories.id, {
      onDelete: "cascade",
    }),

  sourcePath: text("source_path").notNull(),

  importedPath: text("imported_path").notNull(),
});



// ANALYSES
// One row per impact-analysis request

export const analyses = pgTable("analyses", {
  id: uuid("id").defaultRandom().primaryKey(),

  repositoryId: uuid("repository_id")
    .notNull()
    .references(() => repositories.id, {
      onDelete: "cascade",
    }),

  inputType: text("input_type").notNull(),

  inputText: text("input_text"),

  prNumber: integer("pr_number"),

  riskScore: integer("risk_score"),

  summary: text("summary"),

  reviewDetails: jsonb("review_details"),

  createdAt: timestamp("created_at")
    .notNull()
    .defaultNow(),
});



// FINDINGS
// Individual predicted impact findings

export const findings = pgTable("findings", {
  id: uuid("id").defaultRandom().primaryKey(),

  analysisId: uuid("analysis_id")
    .notNull()
    .references(() => analyses.id, {
      onDelete: "cascade",
    }),

  component: text("component"),

  filePath: text("file_path"),

  impactType: text("impact_type"),

  confidence: real("confidence"),

  reason: text("reason"),

  verified: boolean("verified")
    .notNull()
    .default(false),
});



// EVIDENCE
// Evidence supporting a finding

export const evidence = pgTable("evidence", {
  id: uuid("id").defaultRandom().primaryKey(),

  findingId: uuid("finding_id")
    .notNull()
    .references(() => findings.id, {
      onDelete: "cascade",
    }),

  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, {
      onDelete: "cascade",
    }),

  chunkId: uuid("chunk_id")
    .notNull()
    .references(() => chunks.id, {
      onDelete: "cascade",
    }),

  relevanceScore: real("relevance_score"),

  snippet: text("snippet"),
});



// EVAL_RUNS
// One evaluation run for a repository

export const evalRuns = pgTable("eval_runs", {
  id: uuid("id").defaultRandom().primaryKey(),

  repositoryId: uuid("repository_id")
    .notNull()
    .references(() => repositories.id, {
      onDelete: "cascade",
    }),

  recallAt5: real("recall_at_5"),

  recallAt10: real("recall_at_10"),

  mrr: real("mrr"),

  groundingRate: real("grounding_rate"),

  totalCases: integer("total_cases").notNull().default(0),

  cursor: integer("cursor").notNull().default(0),

  status: text("status").notNull().default("pending"),

  createdAt: timestamp("created_at")
    .notNull()
    .defaultNow(),
});


// EVAL_CASES
// Individual PR evaluation cases

export const evalCases = pgTable("eval_cases", {
  id: uuid("id").defaultRandom().primaryKey(),

  evalRunId: uuid("eval_run_id")
    .notNull()
    .references(() => evalRuns.id, {
      onDelete: "cascade",
    }),

  prNumber: integer("pr_number").notNull(),

  prTitle: text("pr_title"),

  predictedFiles: jsonb("predicted_files"),

  actualFiles: jsonb("actual_files"),

  hit: boolean("hit"),

  hitAt5: boolean("hit_at_5"),

  hitAt10: boolean("hit_at_10"),

  recallAt5: real("recall_at_5"),

  recallAt10: real("recall_at_10"),

  reciprocalRank: real("reciprocal_rank"),

  groundingVerifiedCount: integer("grounding_verified_count").notNull().default(0),

  groundingTotalCount: integer("grounding_total_count").notNull().default(0),
});
