# Project overview

ImpactGraph is an authenticated Next.js application for reviewing likely code impact in a GitHub pull request. It combines repository indexing, TypeScript/JavaScript import extraction, hybrid retrieval, evidence-cited AI explanations, and a deterministic PR risk summary.

## Users and problem

It is intended for engineers reviewing changes in a repository they can access through the configured GitHub service token. A PR can alter a shared API or behavior far from the edited file. ImpactGraph surfaces changed paths, indexed importers, exported declaration differences, likely tests, evidence gaps, and follow-up actions in one saved report.

## How a PR review works today

1. A signed-in user chooses an owned repository and open or merged PR.
2. The server checks repository ownership and fetches live PR metadata and paginated changed-file records from GitHub.
3. It retains GitHub patch metadata for up to 100 listed files, reads up to 200 commit records, and retrieves base/head source text for up to 20 JavaScript/TypeScript files.
4. `pr-impact.ts` compares exported declarations where both revisions are available, traces indexed import edges, suggests name-related tests, and computes weighted risk factors.
5. Hybrid retrieval supplies indexed chunks to Gemini when available. Returned AI findings are validated and only evidence IDs from the supplied context can be linked.
6. Deterministic and AI outputs are stored in the existing analysis JSON field and shown in the saved report.

## Product capabilities and status

- **Working foundation:** Google sign-in, hashed database sessions, user-scoped repositories and reports, Postgres/Drizzle persistence.
- **Working ingestion:** resumable public GitHub tree indexing (up to 3,000 supported files), TypeScript/JavaScript AST import edges, chunks, and embedding backfill.
- **Working PR access:** live PR metadata, patches, changed file status, and paginated file listing. GitHub auth uses one server-configured `GITHUB_TOKEN`; per-user GitHub OAuth and private access on behalf of a user are not implemented.
- **Partial semantic analysis:** exported JS/TS declarations are compared for changed signatures, interface shapes, and removed exports. Only changed files with fetched before/after source are eligible.
- **Partial impact analysis:** indexed import relationships and limited reverse traversal; test selection is a name/content heuristic, not coverage analysis.
- **Deterministic score:** documented factors and configurable weights, for live PR analyses only. It is a review signal, not an incident probability.
- **AI explanation:** optional Gemini summaries/findings over retrieved evidence. Deterministic PR analysis remains when retrieval or Gemini fails.
- **Not implemented:** actual test execution, coverage measurement, GitHub App/user token OAuth, CI status integration, export/share, history trend analytics, and multi-language AST analysis.

## What differs from a basic AI reviewer

The report keeps GitHub diff metadata and a deterministic score separate from model prose. AI evidence IDs are checked against the exact retrieved chunk set before stored evidence is marked verified. Missing source or patches are represented as limitations. Static relationships and compatibility warnings are not described as proof of runtime breakage.

See [ARCHITECTURE.md](ARCHITECTURE.md), [ANALYSIS_ENGINE.md](ANALYSIS_ENGINE.md), and [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md) for implementation boundaries.
