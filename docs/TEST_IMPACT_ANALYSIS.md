# Test impact analysis

The index classifies files through `ingestion.ts`; test chunks are stored alongside source documents. For a PR, the current analyzer inspects indexed test paths and content, then matches a changed source basename against a test filename or text. Matches are listed as **recommended to run**, with the reason that the path or content matched.

This does not parse test runners, construct a reliable test-to-symbol graph, measure coverage, or execute tests. A lack of a match means “no likely test identified by this heuristic,” not “there are no tests.” No tests are run by a production analysis request. The report explicitly labels recommendations as not executed.

Tests added/changed in a PR are listed as changed files but are not counted as tests actually run. CI check-run integration is not implemented. Automated local checks for the analyzer live in `src/scripts/test-pr-impact.ts`; these validate the analyzer, not a user's repository test suite.
