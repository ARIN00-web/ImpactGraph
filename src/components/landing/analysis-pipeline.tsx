import {
  GitPullRequest,
  FileCode,
  Binary,
  GitFork,
  SearchCode,
  Cpu,
  FileCheck,
  ArrowRight,
} from "lucide-react";

const PIPELINE_STEPS = [
  {
    step: "01",
    name: "GitHub PR",
    icon: GitPullRequest,
    description: "Fetches live PR metadata, commits, and paginated changed files via Octokit.",
    badge: "Octokit REST",
  },
  {
    step: "02",
    name: "Diff & Source Retrieval",
    icon: FileCode,
    description: "Fetches patch diffs, add/delete counts, and base/head source for up to 20 TS/JS files.",
    badge: "Base / Head SHAs",
  },
  {
    step: "03",
    name: "Static AST Analysis",
    icon: Binary,
    description: "Parses source in an in-memory ts-morph project to diff exported declarations and signatures.",
    badge: "ts-morph AST",
  },
  {
    step: "04",
    name: "Dependency Traversal",
    icon: GitFork,
    description: "Performs bounded reverse file-graph traversal against the indexed repository snapshot.",
    badge: "Indexed Graph",
  },
  {
    step: "05",
    name: "Evidence Retrieval",
    icon: SearchCode,
    description: "Gathers hybrid lexical, vector, and path evidence chunks for affected symbols.",
    badge: "pgvector Chunks",
  },
  {
    step: "06",
    name: "Optional Gemini AI",
    icon: Cpu,
    description: "Synthesizes concise explanations strictly validated against retrieved evidence chunk IDs.",
    badge: "Gemini 2.5/Flash",
  },
  {
    step: "07",
    name: "Review Report",
    icon: FileCheck,
    description: "Persists deterministic score, readiness category, evidence citations, and missing gaps.",
    badge: "Persisted Report",
  },
];

export function AnalysisPipeline() {
  return (
    <section id="docs" className="relative py-12 sm:py-20 border-t border-[var(--border-subtle)]/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="max-w-3xl mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 mb-3">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-coral)]" />
            <span className="font-mono text-[11px] sm:text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--accent-coral)]">
              ANALYSIS PIPELINE
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--text-primary)]">
            How ImpactGraph Analyzes Code
          </h2>
          <p className="mt-3 text-base sm:text-lg text-[var(--text-secondary)]">
            A deterministic static engine paired with bounded dependency exploration and evidence-validated explanations.
          </p>
        </div>

        {/* Pipeline Progression Ribbon */}
        <div className="mb-10 overflow-x-auto pb-4">
          <div className="inline-flex min-w-[760px] w-full items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-primary)] p-3 text-xs font-mono">
            {PIPELINE_STEPS.map((s, idx) => (
              <div key={s.name} className="flex items-center gap-2">
                <span className="text-[var(--accent-coral)] font-bold">{s.step}</span>
                <span className="text-[var(--text-primary)] font-semibold">{s.name}</span>
                {idx < PIPELINE_STEPS.length - 1 && (
                  <ArrowRight className="h-3.5 w-3.5 text-[var(--text-muted)] mx-1" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Detailed Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {PIPELINE_STEPS.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.step}
                className="group rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-primary)] p-5 sm:p-6 transition-all hover:border-[var(--border-light)] hover:bg-[var(--surface-secondary)]/50 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--surface-secondary)] text-[var(--accent-coral)] group-hover:scale-105 transition-transform">
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <span className="font-mono text-[11px] font-bold text-[var(--accent-coral)]">
                      {item.step}
                    </span>
                  </div>

                  <h3 className="text-[15px] font-bold text-[var(--text-primary)]">
                    {item.name}
                  </h3>

                  <p className="mt-2 text-[12px] leading-relaxed text-[var(--text-secondary)]">
                    {item.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-[var(--border-subtle)]">
                  <span className="inline-block rounded-md border border-[var(--border-subtle)] bg-[var(--surface-secondary)] px-2 py-0.5 font-mono text-[10px] text-[var(--text-muted)]">
                    {item.badge}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
