import { DependencyGraph } from "./dependency-graph";

interface HeroProps {
  user?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export function Hero({ user }: HeroProps) {
  const analyzePrHref = user ? "/analyze" : "/api/auth/google";

  return (
    <section className="relative overflow-hidden pt-8 pb-14 sm:pt-14 sm:pb-20 lg:pt-18 lg:pb-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-8">
          {/* Left Column: Heading & CTAs */}
          <div className="lg:col-span-6 xl:col-span-6 text-left">
            {/* Introductory Kicker */}
            <div className="inline-flex items-center gap-2 mb-4 sm:mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-coral)]" />
              <span className="font-mono text-[11px] sm:text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-coral)]">
                GITHUB PULL REQUEST INTELLIGENCE
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-[56px] xl:text-[62px] font-extrabold tracking-[-0.035em] text-[var(--text-primary)] leading-[1.08]">
              See the Real <br />
              <span className="text-[var(--accent-coral)]">Impact</span> of Your <br />
              Pull Requests
            </h1>

            {/* Supporting Copy */}
            <p className="mt-5 sm:mt-6 max-w-xl text-base sm:text-[17px] leading-relaxed text-[var(--text-secondary)] font-normal">
              A GitHub pull request impact analyzer that connects changed code to
              repository structure, evidence, and review actions.
            </p>

            {/* Action Buttons */}
            <div className="mt-8 sm:mt-10 flex flex-wrap items-center gap-4 sm:gap-5">
              <a
                href={analyzePrHref}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--accent-coral)] px-6 py-3 text-[14px] font-bold text-[var(--accent-text)] transition-transform hover:scale-[1.02] active:scale-[0.98] shadow-md hover:brightness-105"
              >
                <span>Analyze a PR</span>
                <span aria-hidden="true">→</span>
              </a>

              <a
                href="#features"
                className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] px-2 py-2"
              >
                <span>Learn more</span>
                <span aria-hidden="true">↓</span>
              </a>
            </div>

            {/* Credibility micro-note */}
            <div className="mt-8 flex items-center gap-3 pt-6 border-t border-[var(--border-subtle)]/70 text-xs text-[var(--text-muted)] font-mono">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--risk-low)]" />
                Deterministic AST
              </span>
              <span>•</span>
              <span>Bounded reverse graph</span>
              <span>•</span>
              <span>Evidence-grounded</span>
            </div>
          </div>

          {/* Right Column: Hero Dependency Graph */}
          <div className="lg:col-span-6 xl:col-span-6 flex justify-center lg:justify-end">
            <DependencyGraph />
          </div>
        </div>
      </div>
    </section>
  );
}
