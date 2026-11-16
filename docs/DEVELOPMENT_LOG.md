# Development log

## 2026-11-07 — Deterministic PR impact analysis

- **Objective:** Extend the existing grounded analysis with actual diff metadata, TS/JS contract checks, importer/test hints, deterministic scoring, and honest merge readiness.
- **Files changed:** `src/lib/github.ts`, `src/lib/pr-impact.ts`, `src/app/api/analyze/route.ts`, `src/app/api/analyses/[id]/route.ts`, `src/app/analyses/[id]/page.tsx`, `src/lib/analysis.ts`, `src/prompts/impact-analysis.ts`, `src/scripts/test-pr-impact.ts`, `package.json`, documentation and README.
- **Implemented:** Optional GitHub token for public API use; paginated changed-file reads; bounded base/head source fetch; AST declaration comparisons; reverse import traversal; test recommendations; weighted PR risk and readiness; AI-independent fallback; report UI for patches and static evidence.
- **Database/API:** No schema migration. `review_details` stores PR impact JSON. `POST /api/analyze` returns `riskScore` and `mergeReadiness`; existing report GET returns saved paths and review details.
- **Tests added:** Script-level realistic analyzer checks for required-property changes, consumer links, test suggestions, score bounds, and incomplete evidence.
- **Tests to execute:** `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run test:grounding`, `npm.cmd run test:pr-impact`, production build.
- **External verification:** Live GitHub, OAuth, Gemini, database migration, and real PR end-to-end workflows require external credentials/services and were not run as part of this local pass.
- **Remaining:** Private GitHub OAuth/App authorization, comprehensive AST breaking-change handling, true test mapping/coverage, asynchronous large PR processing, CI integration, and E2E UI tests.
