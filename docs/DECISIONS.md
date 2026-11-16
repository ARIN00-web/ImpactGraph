# Architecture decisions

## ADR-001: Keep the existing Next.js and Postgres application

- **Context:** The repository already had authenticated App Router pages, Drizzle persistence, ingestion, retrieval, grounded AI findings, and evaluation.
- **Options:** Replace the stack; add a separate analyzer service; extend the existing server pipeline.
- **Decision:** Extend the existing route and persist new deterministic PR details in the existing JSON review field.
- **Why:** Preserves working flows and avoids a schema rewrite.
- **Trade-offs:** JSON details are less queryable than normalized finding tables and may need a future migration.

## ADR-002: Keep scoring deterministic and separate from Gemini

- **Context:** A model generated the stored score, making identical inputs potentially score differently and obscuring the basis.
- **Decision:** Calculate PR score from explicit code inputs and configurable weights; remove risk score from the explanation prompt/output contract.
- **Trade-offs:** Heuristic scores are explainable but not statistically calibrated. Description-only analyses have no deterministic PR score.

## ADR-003: Use AST-based exported declaration comparison

- **Context:** File-name and diff-line heuristics cannot identify API shape changes reliably.
- **Decision:** Reuse installed `ts-morph` to parse fetched TS/JS base/head source and compare exports.
- **Trade-offs:** Requires source at both revisions; covers a subset of language semantics and can produce potential warnings rather than proofs.

## ADR-004: Bound per-PR source retrieval

- **Context:** GitHub REST quotas and large diffs must be bounded.
- **Decision:** Retain up to 100 changed-file entries and fetch base/head source for at most 20 TS/JS files per request.
- **Trade-offs:** Large PRs are explicitly incomplete. A future background worker should process large PRs with persistent progress.

## ADR-005: Keep model and static findings distinct

- **Context:** Valid evidence IDs establish citation provenance but not semantic correctness.
- **Decision:** Store static PR analysis in review details and keep AI findings in the existing findings/evidence tables.
- **Trade-offs:** The report renders two finding groups; a normalized unified finding model is future work.
