# Security and privacy

## Authentication and authorization

Google OAuth signs the user into ImpactGraph. OAuth state is signed and bound to an HttpOnly cookie; the callback validates the identity token and verified email. Session tokens are random, stored in the database only as SHA-256 hashes, and sent in secure HttpOnly cookies. API routes check ownership through the repository's `userId` before accessing reports, indexing, and analysis.

## GitHub access

GitHub access is currently a server-configured `GITHUB_TOKEN`, optional for public repositories. It is never returned to the browser. Google sign-in does not grant GitHub scopes, and user-specific GitHub OAuth, GitHub App installation, and credential vaulting are not implemented. Private repository reads work only if the configured token is authorized for that repository.

## Untrusted data and model exposure

Repository contents, diffs, PR descriptions, comments, and historical text are untrusted. The model prompt says not to follow embedded instructions; this mitigates but cannot eliminate prompt injection. No repository code is executed during indexing or analysis. Gemini receives retrieved source context when configured; operators should assess provider data handling before using private code.

## Reliability boundaries

Inputs are validated, database queries are ownership-scoped, and evidence references are validated. GitHub rate-limit/permission errors receive an explicit error response. The system has no comprehensive request timeout/retry policy or per-user rate limiter yet. Keep `DATABASE_URL`, `GITHUB_TOKEN`, Gemini credentials, and Google OAuth secrets server-only; do not use `NEXT_PUBLIC_` prefixes.
