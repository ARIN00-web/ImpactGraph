import { ImpactGraphLogo } from "./logo";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-[var(--border-subtle)] bg-[var(--surface-primary)] py-10 sm:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          {/* Left: Brand & Tagline */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <ImpactGraphLogo href="/" />
            <span className="hidden sm:inline text-[var(--border-subtle)]">|</span>
            <span className="text-[13px] font-medium text-[var(--text-muted)]">
              Smarter PRs. Safer Deployments.
            </span>
          </div>

          {/* Right: Technical Links & GitHub */}
          <div className="flex flex-wrap items-center gap-6 text-[13px] text-[var(--text-secondary)] font-medium">
            <a
              href="#docs"
              className="transition-colors hover:text-[var(--text-primary)]"
            >
              Documentation
            </a>
            <a
              href="https://github.com/Prateekfrfr/impactgraph"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-[var(--text-primary)]"
            >
              GitHub
            </a>
            <a
              href="#limitations"
              className="transition-colors hover:text-[var(--text-primary)]"
            >
              Security
            </a>
            <a
              href="https://github.com/Prateekfrfr/impactgraph"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[var(--text-primary)] hover:text-[var(--accent-coral)] transition-colors"
              aria-label="GitHub Repository"
            >
              <svg
                className="h-4 w-4"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="font-mono text-xs text-[var(--text-muted)]">Built for developers</span>
            </a>
          </div>
        </div>

        {/* Bottom copyright line */}
        <div className="mt-8 pt-6 border-t border-[var(--border-subtle)]/60 flex flex-col sm:flex-row items-center justify-between text-xs text-[var(--text-muted)] font-mono">
          <span>&copy; {currentYear} ImpactGraph. MIT License.</span>
          <span className="mt-2 sm:mt-0">Deterministic PR Impact &amp; Evidence Grounding</span>
        </div>
      </div>
    </footer>
  );
}
