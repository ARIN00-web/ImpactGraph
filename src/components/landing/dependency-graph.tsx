"use client";

import { useState } from "react";
import {
  Code2,
  Database,
  FileCode2,
  FileCheck2,
  Braces,
  GitFork,
  Layers,
} from "lucide-react";

interface NodeData {
  id: string;
  name: string;
  sub: string;
  type: "changed" | "importer" | "test" | "core";
  icon: typeof Code2;
  x: number; // percentage in viewBox [0-100]
  y: number; // percentage in viewBox [0-100]
  details: {
    role: string;
    description: string;
    evidence: string;
  };
}

const NODES: NodeData[] = [
  {
    id: "user-service",
    name: "user-service",
    sub: "(imports)",
    type: "importer",
    icon: Database,
    x: 23,
    y: 20,
    details: {
      role: "Direct Importer",
      description: "Service consuming user verification and token decode functions from auth.ts.",
      evidence: "import { verifyToken, decodeClaims } from '@/auth';",
    },
  },
  {
    id: "api-routes",
    name: "api-routes",
    sub: "(imports)",
    type: "importer",
    icon: FileCode2,
    x: 82,
    y: 20,
    details: {
      role: "Direct Importer",
      description: "Route handlers guarding incoming HTTP endpoints with session verification.",
      evidence: "import { requireSession } from '@/auth';",
    },
  },
  {
    id: "tests",
    name: "tests",
    sub: "(may be relevant)",
    type: "test",
    icon: FileCheck2,
    x: 18,
    y: 49,
    details: {
      role: "Recommended Test",
      description: "Name-matched test suite flagged for verification against auth module changes.",
      evidence: "tests/auth.test.ts (24 unit & integration cases)",
    },
  },
  {
    id: "types",
    name: "types",
    sub: "(changed)",
    type: "changed",
    icon: Braces,
    x: 85,
    y: 49,
    details: {
      role: "Exported Contract",
      description: "Changed exported TypeScript shape: optional field became required.",
      evidence: "interface UserSession { id: string; roles: string[]; }",
    },
  },
  {
    id: "utils",
    name: "utils",
    sub: "(imports)",
    type: "importer",
    icon: GitFork,
    x: 35,
    y: 80,
    details: {
      role: "Helper Consumer",
      description: "Cryptographic utilities and header serialization helpers.",
      evidence: "import type { TokenPayload } from '@/auth';",
    },
  },
  {
    id: "core",
    name: "core",
    sub: "(imports)",
    type: "core",
    icon: Layers,
    x: 77,
    y: 80,
    details: {
      role: "Framework Consumer",
      description: "Application bootstrap middleware verifying security context on request start.",
      evidence: "import { SecurityContext } from '@/auth';",
    },
  },
];

// Center node
const CENTER_NODE = {
  id: "auth.ts",
  name: "auth.ts",
  sub: "(changed)",
  icon: Code2,
  x: 52,
  y: 49,
  details: {
    role: "PR Modified File",
    description: "Modified in pull request with 162 line additions/deletions and exported contract updates.",
    evidence: "git diff: +94 -68 lines across 3 export signatures",
  },
};

export function DependencyGraph() {
  const [activeNode, setActiveNode] = useState<string | null>(null);

  const selectedNode =
    activeNode === CENTER_NODE.id
      ? CENTER_NODE
      : NODES.find((n) => n.id === activeNode) || null;

  return (
    <div className="relative w-full max-w-[560px] mx-auto select-none">
      {/* Outer subtle glow backdrop */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] rounded-full pointer-events-none blur-3xl opacity-40 dark:opacity-60"
        style={{
          background:
            "radial-gradient(circle, rgba(255, 137, 95, 0.32) 0%, rgba(219, 118, 83, 0.12) 50%, transparent 70%)",
        }}
        aria-hidden="true"
      />

      {/* SVG Canvas for precision connection lines */}
      <div className="relative aspect-[1.12/1] w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-primary)] p-4 sm:p-6 overflow-hidden shadow-2xl">
        {/* Subtle grid background */}
        <div
          className="absolute inset-0 opacity-[0.035] dark:opacity-[0.07] pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(var(--text-primary) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
          aria-hidden="true"
        />

        {/* SVG Edge lines */}
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 w-full h-full pointer-events-none"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="edgeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--accent-coral)" stopOpacity="0.8" />
              <stop offset="100%" stopColor="var(--accent-coral-subtle)" stopOpacity="0.4" />
            </linearGradient>
            <filter id="glowFilter" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="0.6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Connection Lines from Center Node to Outer Nodes */}
          {NODES.map((node) => {
            const isHovered = activeNode === node.id || activeNode === CENTER_NODE.id;
            return (
              <g key={`edge-${node.id}`}>
                {/* Background glow path */}
                <line
                  x1={CENTER_NODE.x}
                  y1={CENTER_NODE.y}
                  x2={node.x}
                  y2={node.y}
                  stroke="var(--accent-coral)"
                  strokeWidth={isHovered ? "0.9" : "0.4"}
                  strokeOpacity={isHovered ? "0.8" : "0.35"}
                  filter={isHovered ? "url(#glowFilter)" : undefined}
                />
                {/* Animated dash line to show dynamic relationship */}
                <line
                  x1={CENTER_NODE.x}
                  y1={CENTER_NODE.y}
                  x2={node.x}
                  y2={node.y}
                  stroke="var(--accent-coral)"
                  strokeWidth={isHovered ? "0.8" : "0.5"}
                  strokeDasharray="1.5 2"
                  className="graph-edge-pulse"
                  strokeOpacity={isHovered ? "1" : "0.7"}
                />
                {/* Outer Connection Dot */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={isHovered ? "1.2" : "0.9"}
                  fill="var(--accent-coral)"
                />
              </g>
            );
          })}

          {/* Center node connection ring */}
          <circle
            cx={CENTER_NODE.x}
            cy={CENTER_NODE.y}
            r="1.4"
            fill="var(--accent-coral)"
          />
        </svg>

        {/* Center Node (auth.ts - changed) */}
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 z-20 cursor-pointer transition-transform duration-200 hover:scale-105"
          style={{ left: `${CENTER_NODE.x}%`, top: `${CENTER_NODE.y}%` }}
          onMouseEnter={() => setActiveNode(CENTER_NODE.id)}
          onMouseLeave={() => setActiveNode(null)}
          role="button"
          tabIndex={0}
          aria-label="Target changed file: auth.ts"
          onFocus={() => setActiveNode(CENTER_NODE.id)}
          onBlur={() => setActiveNode(null)}
        >
          <div className="glow-center-node relative flex flex-col items-center justify-center rounded-xl sm:rounded-2xl border-2 border-[var(--accent-coral)] bg-[var(--surface-primary)] px-3.5 py-2.5 sm:px-5 sm:py-3.5 shadow-xl min-w-[90px] sm:min-w-[110px] text-center">
            {/* Coral Radial Halo inside card */}
            <div
              className="absolute inset-0 rounded-xl sm:rounded-2xl pointer-events-none opacity-20"
              style={{
                background:
                  "radial-gradient(circle, var(--accent-coral) 0%, transparent 80%)",
              }}
              aria-hidden="true"
            />
            <div className="flex items-center gap-1.5 text-[var(--accent-coral)] mb-0.5">
              <Code2 className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
            </div>
            <span className="font-mono text-[13px] sm:text-[15px] font-bold text-[var(--text-primary)] tracking-tight">
              {CENTER_NODE.name}
            </span>
            <span className="font-mono text-[10px] sm:text-[11px] font-semibold text-[var(--accent-coral)]">
              {CENTER_NODE.sub}
            </span>
          </div>
        </div>

        {/* Outer Nodes */}
        {NODES.map((node) => {
          const isSelected = activeNode === node.id;
          const isChangedType = node.id === "types";
          const Icon = node.icon;

          return (
            <div
              key={node.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-10 cursor-pointer transition-all duration-200 hover:scale-105"
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
              onMouseEnter={() => setActiveNode(node.id)}
              onMouseLeave={() => setActiveNode(null)}
              role="button"
              tabIndex={0}
              aria-label={`${node.name} ${node.sub}`}
              onFocus={() => setActiveNode(node.id)}
              onBlur={() => setActiveNode(null)}
            >
              <div
                className={`flex items-center gap-2 rounded-lg sm:rounded-xl border px-2.5 py-1.5 sm:px-3 sm:py-2 shadow-md transition-colors ${
                  isSelected
                    ? "border-[var(--accent-coral)] bg-[var(--surface-elevated)] ring-2 ring-[var(--accent-coral)]/30"
                    : isChangedType
                    ? "border-[var(--accent-coral)]/60 bg-[var(--surface-secondary)]"
                    : "border-[var(--border-subtle)] bg-[var(--surface-primary)] hover:border-[var(--border-light)]"
                }`}
              >
                <div
                  className={`flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-md ${
                    isChangedType || isSelected
                      ? "text-[var(--accent-coral)] bg-[var(--accent-coral)]/10"
                      : "text-[var(--text-secondary)] bg-[var(--surface-secondary)]"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="font-mono text-[11px] sm:text-[12px] font-medium text-[var(--text-primary)] leading-none">
                    {node.name}
                  </span>
                  <span
                    className={`font-mono text-[9px] sm:text-[10px] mt-0.5 leading-none ${
                      isChangedType
                        ? "text-[var(--accent-coral)] font-semibold"
                        : "text-[var(--text-muted)]"
                    }`}
                  >
                    {node.sub}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {/* Live Inspection Tooltip Banner (Bottom of visualization) */}
        {selectedNode && (
          <div className="absolute bottom-2 left-2 right-2 sm:bottom-3 sm:left-3 sm:right-3 z-30 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-primary)]/95 backdrop-blur-md p-2.5 text-xs shadow-lg transition-all animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-1.5 mb-1.5">
              <span className="font-mono font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-coral)]" />
                {selectedNode.name}
                <span className="text-[var(--text-muted)] font-normal text-[11px]">
                  ({selectedNode.details.role})
                </span>
              </span>
              <span className="font-mono text-[10px] text-[var(--text-muted)]">
                Static Analysis Snapshot
              </span>
            </div>
            <p className="text-[var(--text-secondary)] text-[11px] leading-snug">
              {selectedNode.details.description}
            </p>
            <div className="mt-1 font-mono text-[10px] text-[var(--accent-coral)] truncate">
              {selectedNode.details.evidence}
            </div>
          </div>
        )}
      </div>

      {/* Ripple Effect Hand-Drawn Annotation */}
      <div className="relative mt-2 sm:mt-3 flex items-start justify-end pr-2 sm:pr-4">
        <div className="flex items-center gap-2">
          {/* Subtle curved arrow pointing to the graph */}
          <svg
            className="w-10 h-8 sm:w-14 sm:h-10 text-[var(--accent-coral)] shrink-0 transform -rotate-12"
            viewBox="0 0 60 40"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {/* Organic curve */}
            <path
              d="M 52 32 C 40 34, 18 28, 12 12"
              strokeDasharray="2 0"
            />
            {/* Arrow head */}
            <path d="M 10 18 L 12 12 L 18 13" />
          </svg>

          {/* Annotation copy */}
          <div className="text-right">
            <p className="annotation-handwritten text-[13px] sm:text-[15px] font-medium text-[var(--accent-coral)] leading-none">
              Understand the ripple effect.
            </p>
            <span className="font-mono text-[9px] sm:text-[10px] text-[var(--text-muted)] tracking-wider uppercase block mt-1">
              Deterministic Import Graph
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
