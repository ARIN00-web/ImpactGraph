# Interview preparation: ImpactGraph

Answers below describe the current repository implementation. Partial capabilities are marked clearly.

## Architecture

1. **What problem does the application solve?** It gathers a PR's actual changed files, compares supported source declarations, traces indexed importers, retrieves related code, and presents evidence and review actions before merge.
2. **Why keep this as a Next.js application?** Existing pages, protected API routes, and server-side integrations already shared one TypeScript codebase. The enhancement reuses those boundaries instead of introducing another service.
3. **How does data move through the system?** GitHub tree data is indexed to documents/chunks/import edges; a PR request retrieves live metadata and diffs, computes static signals, retrieves chunks, optionally calls Gemini, validates citations, then persists an analysis.
4. **What does the database store?** Drizzle models users/sessions, repositories, documents, vector chunks, file dependencies, analyses, findings/evidence, and evaluation records. New PR result details use the existing JSONB review field, so no migration was needed.
5. **Why separate model findings from deterministic findings?** Model citations and static compatibility evidence have different provenance. Keeping the groups distinct prevents a chunk citation from being mistaken for proof of an AST compatibility warning.
6. **What is incomplete in the architecture?** Expensive indexing/analysis still runs in request handlers; there is no durable job queue, comprehensive progress state, or end-to-end browser suite.

## GitHub and ingestion

7. **How are PRs retrieved?** Octokit fetches the PR record and paginates `pulls.listFiles`; files include status, patch when supplied, add/delete counts, and rename path.
8. **How is a real diff used?** GitHub's unified patch is included in the analysis context and displayed per file. Full TS/JS base/head text is fetched by immutable base/head commit SHA for a bounded subset.
9. **How are API limits handled?** File listing uses Octokit pagination, source reads are capped at 20 files, and 403/429 errors return an explicit rate-limit/permission message. A full retry/backoff strategy is not implemented.
10. **Does Google sign-in authorize private GitHub access?** No. GitHub uses an optional server-level token. Private access works only if that token has rights; user-scoped GitHub OAuth or GitHub App is future work.
11. **How are large PRs bounded?** Up to 100 changed-file records are retained and up to 20 source files fetched for AST analysis. The saved report flags truncation/incomplete evidence.
12. **What if a file is deleted or unavailable?** Deleted files have no head source; 404 source retrieval returns null. The analyzer records missing before/after evidence and avoids claiming complete semantic coverage.

## AST and dependencies

13. **Why AST analysis instead of regex?** `ts-morph` parses TS/JS declarations and import syntax, avoiding many text-pattern errors. The implementation still does not perform full semantic type checking.
14. **How is the dependency graph constructed?** During indexing, each file is parsed and relative/import-alias imports are resolved against known repository paths, then stored as directed source-to-imported file edges.
15. **How are indirect dependencies found?** The analysis traverses the reverse edge graph from changed modules, tracks visited files to handle cycles, and stops after eight levels for scoring. The UI graph has separate smaller limits.
16. **What happens with circular imports?** A visited-path map ensures each importer is only added once, so the traversal terminates.
17. **How do you find affected consumers?** Stored file edges identify importers; for some direct TS/JS consumers, named import bindings are parsed to associate the changed export. This is incomplete for barrels, namespace imports, dynamic imports, and external consumers.
18. **What relationship does an edge prove?** Only that an indexed file statically imported another file. It does not prove that a particular feature uses a changed symbol or will fail.
19. **How are exports compared?** The analyzer compares exported declaration maps and normalized function parameters/return annotations, interface member text, type aliases, enum members, and exported variable declaration text.
20. **How is a newly required interface property detected?** It compares property optional markers for matching property names between before/after interface declarations.
21. **Can it prove a TypeScript PR compiles?** No. It parses changed files independently and reports likely contract changes; it does not build a complete head-revision TypeScript program.
22. **What are likely false positives?** Textual type shape changes can be intentional or compatible; import edges can be unused; named importer resolution and inferred types are incomplete.
23. **What are likely false negatives?** Runtime behavior changes, dynamic imports, non-TS languages, external consumers, generated code, alias/barrel corner cases, and files beyond the fetch cap can be missed.

## Risk, findings, and tests

24. **How is PR risk calculated?** Five factor scores are weighted and summed: complexity, importer impact, exported contract changes, test-signal heuristic, and path-name criticality. Defaults and formulas are documented in `RISK_SCORING.md`.
25. **Why is the score deterministic?** The scoring inputs and equations are ordinary code; Gemini no longer returns the PR score. Same stored facts and weights produce the same number.
26. **Is 80 an 80% failure probability?** No. It is a heuristic review-priority score, not calibrated against production incidents.
27. **How do you represent unknown information?** Missing patches/source and unsupported files appear as uncertainty, and merge readiness is marked incomplete/review required. Zero findings do not imply safe.
28. **How do you avoid double counting?** AI prose does not enter the score. Exported API changes are counted by detected declaration, but related changes across files are not yet semantically deduplicated.
29. **How are tests selected?** A heuristic matches changed source basenames against indexed test paths and contents. It does not compute coverage or run tests.
30. **How do you distinguish recommended from executed tests?** UI and report text label discovered tests as recommended and not executed. No repository test command is run by analysis.
31. **What is merge readiness?** A deterministic status derived from severity counts, score band, and evidence completeness. It provides actions but never approves or merges a PR.
32. **What does confidence mean?** Confidence indicates evidence strength/completeness for a finding, not probability of a production incident.

## AI, auth, and operations

33. **What does Gemini do?** It writes explanations and potential impact summaries from retrieved evidence. It does not calculate the PR risk score.
34. **How do you prevent invented evidence IDs?** The grounding helper checks every model citation against the exact retrieved ID set; only valid evidence relations are saved.
35. **Does grounding prove a claim is true?** No. It proves only that the cited chunk was part of the model's context. Human review remains necessary.
36. **What happens when Gemini is unavailable?** PR static analysis can still save a result, with a limitation explaining the AI/retrieval failure. Description-only analyses still depend on retrieval/model.
37. **How do you address prompt injection?** Repository text is explicitly treated as untrusted in the prompt. This is a mitigation, not a formal guarantee; secrets are not intentionally sent in prompt content.
38. **How is authentication secured?** Google OAuth state is signed and cookie-bound; random session credentials are stored hashed and issued in HttpOnly cookies. Resource routes scope queries to the user's repository ownership.
39. **Is private source sent to an AI provider?** If Gemini is configured, retrieved repository snippets are sent for explanation. Operators must evaluate provider policies before processing private code.
40. **What credentials are server-only?** Database, GitHub token, Gemini key, and Google client secret are read from server environment variables and should not use `NEXT_PUBLIC_` names.
41. **How are API errors presented?** Invalid input and ownership failures use HTTP errors; GitHub rate/permission/not-found failures are distinguished; AI failures are recorded as limitations for a PR result.
42. **Can repository code execute?** No. Indexing and analysis parse text and never run code or package scripts.

## Product and scale

43. **What if a repository is in an unsupported language?** Changed files and patches can still be displayed, but TS/JS AST checks do not apply and evidence coverage is incomplete.
44. **How would you scale to thousands of repositories?** First move indexing and PR analysis to durable jobs with per-repository concurrency limits, incremental commit-aware indexing, request caching, and queue-level retries; measure before introducing distributed graph infrastructure.
45. **Why use JSONB for the new analysis details?** It avoided a disruptive migration while fitting a versioned report payload. Query-heavy findings would justify normalized tables later.
46. **What would you improve next?** GitHub App authorization, head-revision project type checking, richer symbol reference analysis, test-runner integration via explicit safe policy, CI checks, and worker-backed large PR processing.

## Local verification

The analyzer checks run with `npm run test:pr-impact`; evidence checks use `npm run test:grounding`; type checking and linting use the README commands. These local checks do not verify external OAuth, database, GitHub, Gemini, or browser end-to-end workflows.
