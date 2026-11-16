"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";

type Analysis = {
  id: string;
  repository: { owner: string; name: string };
  prNumber: number | null;
  riskScore: number | null;
  summary: string | null;
  createdAt: string;
};

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const day = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
    return `${day}, ${time}`;
  } catch {
    return dateStr;
  }
}

async function safeJson<T = unknown>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(res.ok ? "Invalid server response" : `Server error (${res.status})`);
  }
}

export default function AnalysesPage() {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/analyses")
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load reports");
        return safeJson<Analysis[]>(response);
      })
      .then((data) => {
        if (Array.isArray(data)) setAnalyses(data);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load reports"))
      .finally(() => setLoading(false));
  }, []);

  const filteredAnalyses = useMemo(() => {
    if (!search.trim()) return analyses;
    const q = search.toLowerCase();
    return analyses.filter((a) => {
      const title = a.prNumber ? `pr #${a.prNumber}` : (a.summary || "");
      const repo = `${a.repository.owner}/${a.repository.name}`;
      return title.toLowerCase().includes(q) || repo.toLowerCase().includes(q);
    });
  }, [analyses, search]);

  const avgRisk = useMemo(() => {
    const valid = analyses.filter((a) => typeof a.riskScore === "number");
    if (valid.length === 0) return null;
    return Math.round(valid.reduce((sum, a) => sum + (a.riskScore ?? 0), 0) / valid.length);
  }, [analyses]);

  return (
    <AppShell>
      <div className="blast-container">
        {/* Title row */}
        <div className="pb-8">
          <h1 className="page-title text-[28px]">Reports</h1>
          <p className="page-sub">
            Traceable change reviews and predicted blast radius.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-6 border border-[var(--r)] bg-[var(--q)] p-4 text-[14px] text-[var(--r)] rounded-[8px]"
          >
            <p className="font-bold">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-12 gap-4">
          {/* 8-col Reports Table Panel */}
          <div className="col-span-12 lg:col-span-8 panel p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--l)]">
              <div>
                <h2 className="text-[17px] font-bold text-[var(--t)]">Generated analyses</h2>
                <p className="text-[13px] text-[var(--m)] mt-0.5">
                  Open a saved report to review its findings and code evidence.
                </p>
              </div>

              {analyses.length > 0 && (
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Filter saved reports"
                  placeholder="Filter reports…"
                  className="input-base text-[13px] py-1.5 px-3 max-w-[200px]"
                />
              )}
            </div>

            <div className="pt-4 min-h-[300px]">
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-12 w-full bg-[var(--q)] rounded-[8px] animate-pulse" />
                  ))}
                </div>
              ) : analyses.length === 0 ? (
                <div className="py-16 text-center text-[13px] text-[var(--m)] space-y-4">
                  <p className="text-[14px] text-[var(--t)] font-semibold">No reports yet.</p>
                  <p>Pick an open PR in Analyze to create one.</p>
                  <Link href="/analyze" className="btn-primary text-[13px] px-4 py-2 inline-flex">
                    Analyze a change
                  </Link>
                </div>
              ) : filteredAnalyses.length === 0 ? (
                <div className="py-12 text-center text-[13px] text-[var(--m)]">
                  No reports match &ldquo;{search}&rdquo;.
                </div>
              ) : (
                <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left border-collapse">
                  <thead>
                    <tr className="text-[11px] font-semibold text-[var(--m)] border-b border-[var(--l)]">
                      <th className="pb-2.5 font-medium">Pull Request / Summary</th>
                      <th className="pb-2.5 font-medium">Repository</th>
                      <th className="pb-2.5 font-medium">Risk Score</th>
                      <th className="pb-2.5 font-medium text-right">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--l)]">
                    {filteredAnalyses.map((a) => (
                      <tr
                        key={a.id}
                        className="hover:bg-[rgba(255,255,255,0.02)] transition-colors group cursor-pointer"
                      >
                        <td className="py-3.5 pr-3 align-middle">
                          <Link
                            href={`/analyses/${a.id}`}
                            className="font-bold text-[13px] text-[var(--t)] group-hover:text-[var(--a)] line-clamp-1 no-underline"
                          >
                            {a.summary || (a.prNumber ? `PR #${a.prNumber} review` : "Change review")}
                          </Link>
                          {a.prNumber && (
                            <span className="font-mono text-[11px] text-[var(--m)] tabular-nums">
                              #{a.prNumber}
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-3 align-middle">
                          <span className="font-mono text-[12px] text-[var(--m)]">
                            {a.repository.owner}/{a.repository.name}
                          </span>
                        </td>

                        <td className="py-3.5 px-3 align-middle font-mono font-bold text-[15px] text-[var(--r)] tabular-nums">
                          {a.riskScore ?? "--"}
                        </td>

                        <td className="py-3.5 pl-3 align-middle text-right text-[12px] text-[var(--m)] tabular-nums">
                          {formatDate(a.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          </div>

          {/* 4-col Summary panel beside it */}
          <div className="col-span-12 lg:col-span-4 panel p-6 space-y-5">
            <div>
              <h2 className="text-[17px] font-bold text-[var(--t)]">Summary</h2>
              <p className="text-[13px] text-[var(--m)] mt-0.5">
                Overview across generated analyses
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[var(--q)] p-3 rounded-[8px] border border-[var(--l)]">
                <p className="font-mono text-[22px] font-extrabold text-[var(--t)] tabular-nums">
                  {analyses.length}
                </p>
                <p className="text-[12px] text-[var(--m)] mt-1">Total reports</p>
              </div>

              <div className="bg-[var(--q)] p-3 rounded-[8px] border border-[var(--l)]">
                <p className="font-mono text-[22px] font-extrabold text-[var(--r)] tabular-nums">
                  {avgRisk !== null ? avgRisk : "--"}
                </p>
                <p className="text-[12px] text-[var(--m)] mt-1">Avg risk score</p>
              </div>
            </div>

            <div className="p-4 rounded-[8px] bg-[var(--q)] border border-[var(--l)] text-[12px] text-[var(--m)] leading-relaxed">
              Evidence IDs are checked against the chunks retrieved for each report. Only matching evidence references are stored.
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
