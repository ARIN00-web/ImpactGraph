"use client";

import {
  Info,
  Layers,
  ShieldCheck,
  GitCommit,
  Search,
  Sparkles,
} from "lucide-react";

const FACTORS = [
  {
    name: "Change complexity",
    weight: "20%",
    weightNum: 0.2,
    rule: "min(100, 15 + 9 × changed files + ceil((additions + deletions) / 8))",
    description:
      "Evaluates the volume of modified lines, file count, and churn velocity.",
    icon: GitCommit,
  },
  {
    name: "Indexed dependencies",
    weight: "25%",
    weightNum: 0.25,
    rule: "min(100, 15 × direct importers + 7 × deeper importers)",
    description:
      "Traverses bounded reverse import graph to count affected downstream consumers.",
    icon: Layers,
  },
  {
    name: "Breaking changes",
    weight: "25%",
    weightNum: 0.25,
    rule: "min(100, 55 × detected exported contract changes)",
    description:
      "Detects exported TypeScript signatures, deleted exports, and optional-to-required fields.",
    icon: ShieldCheck,
  },
  {
    name: "Test discovery",
    weight: "15%",
    weightNum: 0.15,
    rule: "20 if a likely test is found; 65 if none is identified",
    description:
      "Discovers existing test files matched by filename and source content heuristics.",
    icon: Search,
  },
  {
    name: "Critical-path heuristic",
    weight: "15%",
    weightNum: 0.15,
    rule: "75 if matching auth/core/security path; otherwise 15",
    description:
      "Scores critical path sensitivity (authentication, billing, crypto, database adapters).",
    icon: Sparkles,
  },
];

const BANDS = [
  {
    label: "Low",
    range: "0–20",
    color: "var(--risk-low)",
    bg: "rgba(95, 211, 160, 0.12)",
    readiness: "Eligible for LOW RISK only when evidence is complete",
  },
  {
    label: "Moderate",
    range: "21–40",
    color: "var(--risk-moderate)",
    bg: "rgba(242, 193, 78, 0.12)",
    readiness: "Produces REVIEW REQUIRED status",
  },
  {
    label: "High",
    range: "41–70",
    color: "var(--accent-coral)",
    bg: "rgba(255, 137, 95, 0.14)",
    readiness: "Flagged when contract change or high factor is detected",
  },
  {
    label: "Critical",
    range: "71–100",
    color: "var(--risk-critical)",
    bg: "rgba(242, 119, 125, 0.14)",
    readiness: "Produces CRITICAL readiness flag requiring senior review",
  },
];

export function RiskScoring() {
  return (
    <section id="risk-scoring" className="relative py-12 sm:py-18">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Main Overview Panel matching reference design */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-primary)] p-6 sm:p-8 shadow-sm">
          {/* Header Row: Title on Left, 4 Risk Category Dots on Right */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-[var(--border-subtle)] pb-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text-primary)]">
                Risk Scoring at a Glance
              </h2>
              <p className="mt-1 text-sm sm:text-[15px] text-[var(--text-secondary)]">
                A transparent, weighted score based on real impact factors.
              </p>
            </div>

            {/* Risk Category Legend Indicators */}
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 font-mono text-[12px] sm:text-[13px]">
              {BANDS.map((band) => (
                <div key={band.label} className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: band.color }}
                  />
                  <span className="font-semibold text-[var(--text-primary)]">
                    {band.label}
                  </span>
                  <span className="text-[var(--text-muted)]">{band.range}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Horizontal Risk Spectrum Bar */}
          <div className="mt-8">
            <div className="flex items-center justify-between text-xs font-mono text-[var(--text-muted)] mb-2">
              <span>0 (Minimal Change)</span>
              <span>20</span>
              <span>40</span>
              <span>70</span>
              <span>100 (Maximum Risk)</span>
            </div>
            <div className="relative h-3 w-full rounded-full bg-[var(--surface-secondary)] overflow-hidden flex border border-[var(--border-subtle)]">
              {/* Low: 0-20 (20%) */}
              <div
                className="h-full transition-all"
                style={{ width: "20%", backgroundColor: "var(--risk-low)" }}
                title="Low Risk (0-20)"
              />
              {/* Moderate: 20-40 (20%) */}
              <div
                className="h-full transition-all"
                style={{
                  width: "20%",
                  backgroundColor: "var(--risk-moderate)",
                }}
                title="Moderate Risk (21-40)"
              />
              {/* High: 40-70 (30%) */}
              <div
                className="h-full transition-all"
                style={{ width: "30%", backgroundColor: "var(--accent-coral)" }}
                title="High Risk (41-70)"
              />
              {/* Critical: 70-100 (30%) */}
              <div
                className="h-full transition-all"
                style={{
                  width: "30%",
                  backgroundColor: "var(--risk-critical)",
                }}
                title="Critical Risk (71-100)"
              />
            </div>
          </div>

          {/* Factor Weight Cards Grid */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {FACTORS.map((factor) => {
              const Icon = factor.icon;
              return (
                <div
                  key={factor.name}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-secondary)]/50 p-4 transition-colors hover:bg-[var(--surface-secondary)]"
                >
                  <div className="flex items-center justify-between mb-2">
                    <Icon className="h-4 w-4 text-[var(--accent-coral)]" />
                    <span className="font-mono text-[13px] font-bold text-[var(--text-primary)]">
                      {factor.weight}
                    </span>
                  </div>
                  <h4 className="text-[13px] font-bold text-[var(--text-primary)] tracking-tight">
                    {factor.name}
                  </h4>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--text-secondary)]">
                    {factor.description}
                  </p>
                  <div
                    className="mt-2.5 pt-2 border-t border-[var(--border-subtle)] font-mono text-[10px] text-[var(--text-muted)] truncate"
                    title={factor.rule}
                  >
                    {factor.rule}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Explicit Transparency Disclaimer */}
          <div className="mt-8 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-secondary)]/70 p-4 sm:p-5 flex items-start gap-3.5">
            <Info className="h-5 w-5 text-[var(--accent-coral)] shrink-0 mt-0.5" />
            <div className="text-[12px] sm:text-[13px] leading-relaxed text-[var(--text-secondary)]">
              <strong className="text-[var(--text-primary)] font-semibold">
                Important disclaimer:
              </strong>{" "}
              Risk scores are heuristic signals, not incident probabilities or
              merge approvals. A low score does not guarantee safety, and
              missing patches or unsupported languages are explicitly flagged to
              prevent false confidence.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
