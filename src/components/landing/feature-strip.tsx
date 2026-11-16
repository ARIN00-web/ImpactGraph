import { Zap, ShieldAlert, CheckSquare, Sparkles } from "lucide-react";

const FEATURES = [
  {
    icon: Zap,
    title: "Analyze Dependencies",
    tagline: "Find what imports what.",
    description: "Find which indexed modules import changed code through reverse AST traversal.",
  },
  {
    icon: ShieldAlert,
    title: "Detect Breaking Changes",
    tagline: "Spot risky API changes.",
    description: "Identify potential exported TypeScript/JavaScript contract changes before merge.",
  },
  {
    icon: CheckSquare,
    title: "Assess Risk",
    tagline: "Get a clear merge-readiness score.",
    description: "Get a transparent, weighted risk assessment derived from five deterministic factors.",
  },
  {
    icon: Sparkles,
    title: "Get AI Insights",
    tagline: "Understand the bigger picture.",
    description: "Understand findings through optional evidence-grounded Gemini explanations.",
  },
];

export function FeatureStrip() {
  return (
    <section id="features" className="relative py-6 sm:py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 divide-y divide-[var(--border-subtle)] rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-primary)] sm:grid-cols-2 sm:divide-y-0 sm:divide-x lg:grid-cols-4 shadow-sm">
          {FEATURES.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="group relative p-6 sm:p-7 transition-colors hover:bg-[var(--surface-secondary)]/50"
              >
                <div className="flex items-center gap-3 mb-3.5">
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--surface-secondary)] text-[var(--accent-coral)] group-hover:scale-105 transition-transform">
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="font-mono text-[11px] text-[var(--text-muted)] font-medium">
                    0{idx + 1}
                  </span>
                </div>

                <h3 className="text-[15px] font-bold text-[var(--text-primary)] tracking-tight">
                  {feature.title}
                </h3>

                <p className="mt-1 text-[13px] font-medium text-[var(--text-secondary)]">
                  {feature.tagline}
                </p>

                <p className="mt-2 text-[12px] leading-relaxed text-[var(--text-muted)]">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
