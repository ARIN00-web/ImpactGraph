# Analysis engine

## Existing indexing path

`src/app/api/repositories/[id]/index/route.ts` reads the GitHub recursive tree, filters supported files, and processes resumable batches. `analyzeSourceFile` uses `ts-morph` to parse TS/JS import/export declarations, resolves known relative and `@/` paths, and stores file-level edges. `chunking.ts` creates symbol or fallback source chunks. Embeddings are generated separately through the resumable embed endpoint.

## Live PR path

`src/app/api/analyze/route.ts` gets PR metadata and all changed-file pages. It keeps GitHub's `patch`, status, add/delete counts, and rename source. A bounded set of JavaScript/TypeScript files is read at the PR base and head SHAs. GitHub's patch may be omitted for very large files; the report records when diff or source evidence is incomplete.

`src/lib/pr-impact.ts` parses before and after content in an in-memory `ts-morph` project. It compares exported declaration names and normalized signatures/type shapes. Removed exports and changed declaration shapes create potential findings; interface optional-to-required property changes get a more specific explanation. Indexed reverse import paths provide structural impact evidence. A relationship is explicitly not treated as a confirmed runtime defect.

Example covered by the current heuristic:

```ts
// base
export interface User { id: number; name?: string }
// head
export interface User { id: number; name: string }
```

The analyzer reports a potential compatibility concern because a previously optional property becomes required. If a direct importer is indexed, its path is included. It does not type-check the whole PR against a complete head-revision project.

## Findings and evidence

Static findings carry a deterministic ID, severity, category, changed path/symbol, explanation, plausible consequence, action, confidence label, evidence strings, and indexed consumers. `confidence` means strength/completeness of analysis evidence, not probability of failure. AI findings are separately grounded by `grounding.ts`, which accepts only IDs in the retrieved chunk set. AI lines and claims are not considered independently verified just because a chunk citation is valid.

## Limits

Semantic checks currently cover TS/JS exports, function signatures and common type shapes; they do not prove runtime behavior, resolve all aliases, type-check the whole repository at the PR head, parse arbitrary languages, or infer framework routes/events. If GitHub source is missing or parsing fails, semantic analysis is incomplete. See [BREAKING_CHANGES.md](BREAKING_CHANGES.md).
