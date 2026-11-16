# Deterministic PR risk scoring

The score is computed in `src/lib/pr-impact.ts`; the Gemini response no longer contains a risk field. This score is a review-priority signal, **not** a calibrated probability that production will fail.

## Factors and defaults

| Factor | Default weight | Input rule |
| --- | ---: | --- |
| Change complexity | 20% | `min(100, 15 + 9 × changed files + ceil((additions + deletions) / 8))` |
| Dependency impact | 25% | `min(100, 15 × direct importers + 7 × deeper importers)` |
| Breaking changes | 25% | `min(100, 55 × detected exported contract changes)` |
| Test coverage signal | 15% | 20 if a likely test is found; 65 if none is identified |
| Criticality | 15% | 75 if a path matches the current critical-name list; otherwise 15 |

The final score is the rounded sum of factor score × normalized weight. Weight inputs are fractions and are normalized to total 1. Optional environment variables: `RISK_WEIGHT_COMPLEXITY`, `RISK_WEIGHT_DEPENDENCIES`, `RISK_WEIGHT_BREAKING`, `RISK_WEIGHT_TESTS`, `RISK_WEIGHT_CRITICALITY`.

## Bands and merge readiness

Bands are 0–20 Low, 21–40 Moderate, 41–70 High, 71–100 Critical. Merge readiness adds guardrails: detected critical findings produce `CRITICAL`; high findings or a detected contract change produce `HIGH RISK`; moderate risk or incomplete evidence produces `REVIEW REQUIRED`; only a low score with adequate diff/source evidence can produce `LOW RISK`. It never approves or merges a PR.

## Examples

1. A small isolated docs PR with 1 changed file, 8 changed lines, no importers/contracts, and a likely test: complexity 25, dependency 0, breaking 0, tests 20, criticality 15. Weighted score = 5 + 0 + 0 + 3 + 2.25 = 10.25, rounded to **10 (Low)**. Unsupported docs source may still make the evidence incomplete and require review.
2. A 4-file auth PR with 160 changed lines, 3 direct and 2 deeper importers, 1 contract change, and no likely test: complexity 71, dependency 59, breaking 55, tests 65, criticality 75. Weighted score = 14.2 + 14.75 + 13.75 + 9.75 + 11.25 = **64 (High)**; readiness is at least `HIGH RISK` due to the contract finding.

## Unknowns and interpretation

Missing source, patch, or unsupported language is listed explicitly and prevents complete readiness. A low factor is not a claim that no risks exist. Test discovery is heuristic and does not inspect coverage. Findings are counted by underlying exported contract name to avoid repeated model prose affecting score, but distinct changes across files may still represent related causes and are not deduplicated semantically.
