# Known limitations

- GitHub requests use one optional server token. Google authentication is not GitHub authorization; per-user private repository authorization is not available.
- Repository indexing handles a bounded supported-file set and at most 3,000 tree entries. The default classifier emphasizes JS/TS, Markdown, and MDX.
- PR retrieval retains up to 100 changed files and fetches full base/head source for up to 20 JS/TS files. GitHub may omit patches for very large files or diffs.
- Static compatibility analysis covers a subset of TypeScript/JavaScript exported declaration changes. It does not perform full-program type checking or confirm runtime regressions.
- Dependency edges are file-level static imports from the indexed snapshot. Dynamic imports, generated paths, external packages, some aliases/barrels, and symbol usage are incomplete.
- Test recommendations use name/content matching. Coverage is not measured; tests are never executed automatically.
- AI findings are model-generated explanations grounded to retrieved chunk IDs. A valid citation does not guarantee a valid conclusion. AI may be unavailable due to configuration, quota, or network failure.
- Risk factors are heuristic, configurable, and not calibrated against incidents. The critical-module score uses path-name matching.
- Historical PR evaluation exists, but related past PRs/reverts are not incorporated as risk evidence. CI status/check runs, trend dashboards, report export/share, and background analysis jobs are not implemented.
- No complete request concurrency control, retry/backoff policy, test-runner sandbox, or end-to-end browser suite is present.
