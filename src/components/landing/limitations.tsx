import { AlertCircle } from "lucide-react";

const LIMITATIONS = [
  {
    title: "Static analysis is not full-program type checking",
    explanation:
      "ImpactGraph parses exported declarations and signatures in an isolated ts-morph project. It does not perform whole-program compilation or resolve complex ambient module typings across entire node_modules.",
  },
  {
    title: "Symbol and runtime impact analysis is partial",
    explanation:
      "Indexed dependencies reflect file-level static imports from the indexed snapshot. Dynamic imports, runtime reflection, generated routes, and external package consumers are partial.",
  },
  {
    title: "Test recommendations do not measure coverage",
    explanation:
      "Suggested tests are matched by heuristic path/name patterns and content tokens. Code coverage is not measured, and tests are never executed automatically.",
  },
  {
    title: "Large PR analysis is bounded",
    explanation:
      "For performance and API stability, PR retrieval evaluates up to 100 changed files and fetches full base/head source for up to 20 TS/JS files. Large diff omissions are documented in report readiness.",
  },
  {
    title: "CI/CD & historical regression intelligence not integrated",
    explanation:
      "No automated check runs, GitHub Actions statuses, deployment states, or past PR reverts are ingested into the deterministic scoring model.",
  },
  {
    title: "Server-side GitHub token model",
    explanation:
      "Private GitHub repository access uses the server's configured GitHub token. Per-user GitHub OAuth and granular App authorization are not implemented.",
  },
];

export function Limitations() {
  return (
    <section
      id="limitations"
      className="relative py-12 sm:py-20 border-t border-[var(--border-subtle)]/60"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-primary)] p-6 sm:p-10 shadow-sm">
          {/* Header */}
          <div className="max-w-2xl mb-8 sm:mb-10">
            <div className="inline-flex items-center gap-2 mb-3">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-coral)]" />
              <span className="font-mono text-[11px] sm:text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--accent-coral)]">
                ENGINEERING TRANSPARENCY
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text-primary)]">
              Know What the Analysis Can Prove.
            </h2>
            <p className="mt-2 text-sm sm:text-[15px] text-[var(--text-secondary)]">
              Clear technical boundaries are essential for credible developer
              tooling. Here is what ImpactGraph guarantees, and what it
              explicitly does not claim.
            </p>
          </div>

          {/* Grid of limitations */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {LIMITATIONS.map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-secondary)]/40 p-4 sm:p-5 transition-colors hover:bg-[var(--surface-secondary)]/80"
              >
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 text-[var(--accent-coral)] shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-[13px] sm:text-[14px] font-bold text-[var(--text-primary)] leading-snug">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-[12px] leading-relaxed text-[var(--text-secondary)]">
                      {item.explanation}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Trust Banner */}
          <div className="mt-8 pt-6 border-t border-[var(--border-subtle)] flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs text-[var(--text-muted)]">
            <span>
              Verified against product specification &amp;
              docs/KNOWN_LIMITATIONS.md
            </span>
            <span className="text-[var(--accent-coral)]">
              No fabricated metrics • Full evidence citations
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
