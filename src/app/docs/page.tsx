import Link from "next/link";
import { ArrowLeft, Layers, ShieldCheck, AlertTriangle, Cpu } from "lucide-react";
import { ImpactGraphLogo } from "@/components/landing/logo";
import { ThemeToggle } from "@/components/theme-toggle";

const DOCS_TOPICS = [
  {
    slug: "risk-scoring",
    title: "Deterministic PR Risk Scoring",
    description: "Formulas, 5 factor weights, and merge-readiness classification rules.",
    icon: ShieldCheck,
    tag: "Core Engine",
    content: `
### Risk Scoring Model
The risk score is a deterministic review-priority signal computed in \`src/lib/pr-impact.ts\`. It is not an incident probability.

#### Default Weights:
- **Change complexity (20%)**: \`min(100, 15 + 9 × changed files + ceil((additions + deletions) / 8))\`
- **Indexed dependencies (25%)**: \`min(100, 15 × direct importers + 7 × deeper importers)\`
- **Breaking changes (25%)**: \`min(100, 55 × detected exported contract changes)\`
- **Test coverage signal (15%)**: \`20 if a likely test is found; 65 if none is identified\`
- **Criticality heuristic (15%)**: \`75 if matching auth/core/security path; otherwise 15\`

#### Risk Bands:
- **0–20**: Low Risk
- **21–40**: Moderate Risk
- **41–70**: High Risk
- **71–100**: Critical Risk
    `,
  },
  {
    slug: "analysis-engine",
    title: "Analysis Engine & AST Traversal",
    description: "ts-morph export shape extraction, bounded base/head diffing, and reverse graph.",
    icon: Layers,
    tag: "Static Analysis",
    content: `
### Static Analysis Architecture
ImpactGraph inspects base and head source code using in-memory TypeScript AST projects via \`ts-morph\`.

- Parses exported function signatures, interfaces, type aliases, and enums.
- Detects removed exports, altered parameters, and optional-to-required interface changes.
- Bounded to 100 changed files and up to 20 JavaScript/TypeScript full file diffs.
- Cross-references changes against the indexed PostgreSQL import graph.
    `,
  },
  {
    slug: "evidence-grounding",
    title: "Evidence Grounding & AI Reasoning",
    description: "Chunk citation validation, hybrid retrieval, and hallucination prevention.",
    icon: Cpu,
    tag: "Gemini Integration",
    content: `
### Grounding Validation Rules
- Optional explanations from Gemini 2.5/Flash must cite valid chunk IDs from the retrieval set.
- Citations that do not match indexed chunk IDs are rejected.
- Deterministic analysis results persist regardless of AI availability.
    `,
  },
  {
    slug: "limitations",
    title: "Known Engineering Limitations",
    description: "Boundaries of static AST analysis, token scopes, and test heuristics.",
    icon: AlertTriangle,
    tag: "Transparency",
    content: `
### Product Boundaries
- Static analysis is not full-program type checking across arbitrary third-party dependencies.
- Test recommendations do not measure coverage or auto-execute.
- Server-side GitHub token: per-user GitHub OAuth is not implemented.
- CI/CD check runs are not ingested.
    `,
  },
];

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-primary)]">
      {/* Navbar */}
      <header className="border-b border-[var(--border-subtle)] bg-[var(--surface-primary)]">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <ImpactGraphLogo href="/" />
            <span className="hidden sm:inline-block font-mono text-xs text-[var(--accent-coral)] px-2 py-0.5 rounded bg-[var(--accent-coral-soft)] font-bold">
              DOCUMENTATION
            </span>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Home</span>
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Docs Body */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="max-w-3xl mb-12">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--text-primary)]">
            ImpactGraph Technical Documentation
          </h1>
          <p className="mt-3 text-base text-[var(--text-secondary)]">
            Specifications, mathematical formulas, and engineering constraints powering ImpactGraph&apos;s deterministic PR analysis.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {DOCS_TOPICS.map((topic) => {
            const Icon = topic.icon;
            return (
              <div
                key={topic.slug}
                className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-primary)] p-6 sm:p-7 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--surface-secondary)] text-[var(--accent-coral)]">
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <span className="font-mono text-[10px] text-[var(--accent-coral)] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--accent-coral-soft)]">
                      {topic.tag}
                    </span>
                  </div>

                  <h2 className="text-[18px] font-bold text-[var(--text-primary)] tracking-tight">
                    {topic.title}
                  </h2>

                  <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                    {topic.description}
                  </p>

                  <div className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-secondary)]/50 p-4 font-mono text-[11px] text-[var(--text-secondary)] space-y-2 whitespace-pre-line">
                    {topic.content.trim()}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs text-[var(--text-muted)] font-mono">
                  <span>Referenced in docs/{topic.slug.toUpperCase().replace("-", "_")}.md</span>
                  <span className="text-[var(--accent-coral)] font-semibold">Active Spec</span>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
