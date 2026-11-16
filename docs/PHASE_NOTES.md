# ImpactGraph phase notes

## Initial audit

### Objective
Understand the existing Next.js, Drizzle, GitHub ingestion, retrieval, analysis, evaluation, and UI architecture before changing it.

### Changes
Audited the App Router pages, API routes, schema/migrations, ingestion and retrieval modules, AI adapters, environment names, and package scripts.

### Security
The audit found no authentication layer and no server-side ownership checks. APIs accepted arbitrary repository, analysis, and evaluation IDs.

### Verification
`npx.cmd drizzle-kit check` passed. TypeScript initially exposed existing API adapter mismatches; those are now corrected and `npx.cmd tsc --noEmit` passes.

### Remaining risks
OAuth requires valid Google Cloud Console configuration and a reachable database. Live sign-in, database migration, and cross-user tests require external credentials and were not claimed as passed.

## Google authentication and authorization

### Objective
Add a server-side Google sign-in flow and prevent unauthenticated or cross-user resource access.

### Changes
Added signed OAuth state, server-side code exchange and identity validation, first-login user upsert, hashed database sessions, secure HttpOnly cookies, logout, current-user endpoint, and middleware protection. Repositories now carry an owner user ID, and repository/analysis/evaluation/report/PR/index/embed/retrieval APIs enforce the current user server-side.

### Security
Google secrets remain server-only. OAuth state is bound to an HttpOnly cookie. Session tokens are stored only as SHA-256 hashes. Callback redirects are fixed to `APP_URL` and do not accept client-provided destinations.

### Remaining risks
Existing repositories created before this migration have a nullable owner and will not be visible to newly authenticated users until explicitly assigned. No destructive backfill was performed.

## Google Cloud Console configuration

### Local values

Authorized JavaScript origin:

`http://localhost:3000`

Authorized redirect URI:

`http://localhost:3000/api/auth/google/callback`

No production hostname was present in the repository, so none is invented here. Set `APP_URL` to the actual deployed origin and add that origin plus `/api/auth/google/callback` in Google Cloud before production use.

### Environment variables

- `GOOGLE_CLIENT_ID`: server-side OAuth configuration; not `NEXT_PUBLIC_*`.
- `GOOGLE_CLIENT_SECRET`: server-only secret.
- `APP_URL`: server-side URL configuration used to construct the fixed callback.

## Testing and final cleanup

`npx.cmd tsc --noEmit` passes. Drizzle migration checking passes. Live Google OAuth, Supabase migration, production deployment, and end-to-end ingestion/AI calls remain environment-dependent and are not represented as completed.

## Public experience and authenticated dashboard

### Objective
Keep the public site informational while requiring Google sign-in for all repository and analysis actions.

### Changes
The landing page no longer fetches protected repository data. It explains the product and links to Google sign-in. Authenticated users receive a protected `/dashboard` workspace containing repository onboarding and a dashboard link in the global account control.

### Verification
Unauthenticated API requests now return `401 Unauthorized` instead of logging an internal `UNAUTHENTICATED` exception as a `500` response. TypeScript and lint pass after the change.

## Grounded review and frontend pass

### Changes
The review flow now supports live open and merged PR selection, sends the actual
PR number to the server, fetches changed paths, and returns a real analysis ID for
navigation. Model findings are schema-validated and checked against exact
retrieved evidence IDs before evidence rows are stored. Report pages distinguish
model confidence from evidence verification and show a dependency map only from
stored static-analysis edges; when no edge exists they show a ranked file list.

The public landing page is informational. Repository ingestion, analysis,
evaluation, and reports remain protected behind the authenticated dashboard.
Theme preference is persisted, follows the operating-system preference when no
choice exists, and respects reduced-motion settings.

### Verification boundary
These changes can be checked locally with TypeScript, lint, Drizzle migration
validation, and a production build. OAuth itself still depends on the exact
Google Cloud origin/callback registration, reachable Postgres database, and
valid server environment variables.
