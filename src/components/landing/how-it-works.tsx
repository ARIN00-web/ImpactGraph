"use client";

import { useState } from "react";
import { Check } from "lucide-react";

const STEPS = [
  {
    num: "1",
    title: "Connect Your Repo",
    subtitle: "Link your GitHub repository.",
    detail: "Indexes source files and ts-morph import graph snapshot.",
  },
  {
    num: "2",
    title: "Analyze a PR",
    subtitle: "Retrieve PR changes, files & patches.",
    detail: "Fetches live diff metadata and base/head source files.",
  },
  {
    num: "3",
    title: "Explore Impact",
    subtitle: "See dependencies, risk & tests.",
    detail: "Extracts contract diffs and traverses reverse importers.",
  },
  {
    num: "4",
    title: "Make Informed Decisions",
    subtitle: "Review with evidence & clarity.",
    detail: "Reviews weighted risk factors and cited chunk evidence.",
  },
];

// Canonical PR examples derived directly from docs/RISK_SCORING.md
const REPORT_PRESETS = [
  {
    id: "docs-pr",
    label: "PR #104 (Low Risk)",
    score: 18,
    band: "Low Risk",
    bandColor: "var(--risk-low)",
    bandBg: "rgba(95, 211, 160, 0.12)",
    items: [
      {
        label: "Dependencies",
        status: "0 indexed consumers affected",
        ok: true,
      },
      {
        label: "Breaking Changes",
        status: "0 contract modifications",
        ok: true,
      },
      { label: "Test Impact", status: "Heuristic test discovered", ok: true },
      {
        label: "Critical Paths",
        status: "Standard non-critical path",
        ok: true,
      },
    ],
    sparklinePoints: "0,32 15,28 30,29 45,22 60,24 75,18 90,20 100,16",
    sparklineArea:
      "M0,32 L15,28 L30,29 L45,22 L60,24 L75,18 L90,20 L100,16 L100,45 L0,45 Z",
    note: "Small isolated PR: 1 file, 8 lines, no breaking exports.",
  },
  {
    id: "auth-pr",
    label: "PR #112 (High Risk)",
    score: 64,
    band: "High Risk",
    bandColor: "var(--accent-coral)",
    bandBg: "rgba(255, 137, 95, 0.15)",
    items: [
      {
        label: "Dependencies",
        status: "3 direct, 2 deeper importers",
        ok: false,
      },
      {
        label: "Breaking Changes",
        status: "1 exported interface changed",
        ok: false,
      },
      { label: "Test Impact", status: "No relevant test found", ok: false },
      {
        label: "Critical Paths",
        status: "Security auth critical module",
        ok: false,
      },
    ],
    sparklinePoints: "0,20 15,24 30,18 45,35 60,42 75,54 90,60 100,64",
    sparklineArea:
      "M0,20 L15,24 L30,18 L45,35 L60,42 L75,54 L90,60 L100,64 L100,75 L0,75 Z",
    note: "Auth refactor: 4 files, 160 lines, 5 consumers, 1 contract change.",
  },
];

export function HowItWorks() {
  const [activePreset, setActivePreset] = useState(0);
  const current = REPORT_PRESETS[activePreset];

  // SVG Gauge calculations (circumference for radius 38)
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    circumference - (current.score / 100) * circumference;

  return (
    <section id="how-it-works" className="relative py-12 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-2xl mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--text-primary)]">
            How It Works
          </h2>
          <p className="mt-3 text-base sm:text-lg text-[var(--text-secondary)]">
            From a PR to a complete impact analysis, in just a few clicks.
          </p>
        </div>

        {/* Content Grid: 4-Step Timeline on Left, PR Analysis Report Card on Right */}
        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-12 lg:gap-10">
          {/* Left Column: 4-Step Timeline */}
          <div className="lg:col-span-7 flex flex-col justify-between h-full space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
              {STEPS.map((step, idx) => (
                <div
                  key={step.num}
                  className="relative rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-primary)] p-5 sm:p-6 transition-all hover:border-[var(--border-light)] hover:bg-[var(--surface-secondary)]/40 shadow-sm"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent-coral)] font-mono text-[13px] font-bold text-[var(--accent-text)]">
                      {step.num}
                    </span>
                    {idx < 3 && (
                      <span className="hidden sm:inline-block font-mono text-[11px] text-[var(--text-muted)]">
                        Step 0{idx + 1}
                      </span>
                    )}
                  </div>
                  <h3 className="text-[16px] font-bold text-[var(--text-primary)]">
                    {step.title}
                  </h3>
                  <p className="mt-1 text-[13px] font-medium text-[var(--text-secondary)]">
                    {step.subtitle}
                  </p>
                  <p className="mt-2 text-[12px] leading-relaxed text-[var(--text-muted)]">
                    {step.detail}
                  </p>
                </div>
              ))}
            </div>

            {/* Horizontal Timeline Bar indicator */}
            <div className="hidden sm:flex items-center justify-between px-2 pt-2">
              <span className="font-mono text-[11px] text-[var(--text-muted)] uppercase tracking-wider">
                Full PR Lifecycle
              </span>
              <div className="flex items-center gap-2 font-mono text-[11px] text-[var(--accent-coral)]">
                <span>Webhook / Manual</span>
                <span>→</span>
                <span>Reverse AST</span>
                <span>→</span>
                <span>Grounded Evidence</span>
              </div>
            </div>
          </div>

          {/* Right Column: Recreated PR Analysis Report Card */}
          <div className="lg:col-span-5 flex flex-col">
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-primary)] p-5 sm:p-6 shadow-xl relative overflow-hidden">
              {/* Preset Toggle Switch */}
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4 mb-5">
                <div className="flex items-center gap-2">
                  <h3 className="font-mono text-[14px] sm:text-[15px] font-bold text-[var(--text-primary)] tracking-tight">
                    PR Analysis Report
                  </h3>
                </div>

                {/* Status Badge */}
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[11px] font-bold transition-colors"
                  style={{
                    color: current.bandColor,
                    backgroundColor: current.bandBg,
                    border: `1px solid ${current.bandColor}40`,
                  }}
                >
                  {current.band}
                </span>
              </div>

              {/* Card Body: Circular Gauge + Checklist */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center">
                {/* Circular Score Gauge */}
                <div className="sm:col-span-5 flex flex-col items-center justify-center">
                  <div className="relative w-28 h-28 flex items-center justify-center">
                    <svg
                      className="w-full h-full transform -rotate-90"
                      viewBox="0 0 90 90"
                    >
                      {/* Background Track Circle */}
                      <circle
                        cx="45"
                        cy="45"
                        r={radius}
                        fill="none"
                        stroke="var(--border-subtle)"
                        strokeWidth="7"
                      />
                      {/* Progress Arc */}
                      <circle
                        cx="45"
                        cy="45"
                        r={radius}
                        fill="none"
                        stroke={current.bandColor}
                        strokeWidth="7"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        style={{
                          transition:
                            "stroke-dashoffset 0.8s ease-in-out, stroke 0.4s ease",
                        }}
                      />
                    </svg>
                    {/* Score Center Text */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className="font-mono text-2xl font-extrabold text-[var(--text-primary)] leading-none">
                        {current.score}
                      </span>
                      <span className="font-mono text-[10px] text-[var(--text-muted)] mt-0.5">
                        / 100
                      </span>
                    </div>
                  </div>
                  <span className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-wider mt-2">
                    Deterministic Risk
                  </span>
                </div>

                {/* Right Checklist */}
                <div className="sm:col-span-7 space-y-2.5">
                  {current.items.map((item) => (
                    <div key={item.label} className="flex items-start gap-2.5">
                      <div
                        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full mt-0.5"
                        style={{
                          color: item.ok
                            ? "var(--risk-low)"
                            : "var(--accent-coral)",
                          backgroundColor: item.ok
                            ? "rgba(95, 211, 160, 0.15)"
                            : "rgba(255, 137, 95, 0.15)",
                        }}
                      >
                        <Check className="h-3 w-3 stroke-[3]" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[13px] font-semibold text-[var(--text-primary)] leading-none">
                          {item.label}
                        </span>
                        <span className="font-mono text-[10px] text-[var(--text-muted)] mt-0.5">
                          {item.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sparkline Wave Chart at Bottom */}
              <div className="mt-6 pt-4 border-t border-[var(--border-subtle)]">
                <div className="flex items-center justify-between mb-1 text-[11px] font-mono text-[var(--text-muted)]">
                  <span>Commit Diff Complexity Trajectory</span>
                  <span>{current.label}</span>
                </div>
                <div className="relative h-12 w-full overflow-hidden rounded-lg bg-[var(--surface-secondary)]/50 border border-[var(--border-subtle)]/50">
                  <svg
                    viewBox="0 0 100 45"
                    preserveAspectRatio="none"
                    className="w-full h-full"
                  >
                    <defs>
                      <linearGradient
                        id="sparkGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor={current.bandColor}
                          stopOpacity="0.3"
                        />
                        <stop
                          offset="100%"
                          stopColor={current.bandColor}
                          stopOpacity="0.0"
                        />
                      </linearGradient>
                    </defs>
                    {/* Area fill */}
                    <path
                      d={current.sparklineArea}
                      fill="url(#sparkGradient)"
                    />
                    {/* Stroke line */}
                    <polyline
                      fill="none"
                      stroke={current.bandColor}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={current.sparklinePoints}
                    />
                  </svg>
                </div>
              </div>

              {/* Interactive Scenario Selector & Grounding Notice */}
              <div className="mt-4 flex items-center justify-between text-xs text-[var(--text-muted)] pt-2">
                <span className="text-[11px] font-mono truncate max-w-[200px]">
                  {current.note}
                </span>
                <button
                  type="button"
                  onClick={() => setActivePreset(activePreset === 0 ? 1 : 0)}
                  className="font-mono text-[11px] text-[var(--accent-coral)] hover:underline shrink-0 font-semibold"
                >
                  Switch Scenario ⇄
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
