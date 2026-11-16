"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";

type Repository = { id: string; owner: string; name: string };
type Run = {
  id: string;
  repositoryId: string;
  status: string;
  progress?: number;
  recallAt5: number | null;
  recallAt10: number | null;
  mrr: number | null;
  groundingRate: number | null;
  totalCases: number;
  cursor: number;
  createdAt: string;
};

type CaseItem = {
  prNumber: number;
  prTitle: string | null;
  predictedFiles?: string[] | null;
  actualFiles?: string[] | null;
  groundingVerifiedCount?: number;
  groundingTotalCount?: number;
};

type EvaluationBatchResponse = { run: Run; error?: string };

function getShortPath(path: string): string {
  return path.split("/").pop() || path;
}

async function safeJson<T = unknown>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(res.ok ? "Invalid server response" : `Server error (${res.status})`);
  }
}

function TrendLineChart({ runs }: { runs: Run[] }) {
  const completed = runs
    .filter((run): run is Run & { recallAt5: number; recallAt10: number } =>
      run.status === "complete" && typeof run.recallAt5 === "number" && typeof run.recallAt10 === "number"
    )
    .slice()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  if (completed.length < 2) {
    return (
      <div className="py-12 text-center text-[13px] text-[var(--m)]">
        The trend appears after at least two completed evaluation runs for this repository.
      </div>
    );
  }

  const width = 500;
  const height = 150;
  const paddingX = 40;
  const paddingY = 20;

  const pointsR5 = completed.map((run, i) => {
    const x = paddingX + (i * (width - 2 * paddingX)) / Math.max(1, completed.length - 1);
    const val = run.recallAt5;
    const y = height - paddingY - val * (height - 2 * paddingY);
    return `${x},${y}`;
  });

  const pointsR10 = completed.map((run, i) => {
    const x = paddingX + (i * (width - 2 * paddingX)) / Math.max(1, completed.length - 1);
    const val = run.recallAt10;
    const y = height - paddingY - val * (height - 2 * paddingY);
    return `${x},${y}`;
  });

  return (
    <div className="space-y-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
        {/* Horizontal grid lines */}
        <line x1={paddingX} y1={paddingY} x2={width - paddingX} y2={paddingY} stroke="var(--l)" strokeDasharray="3,3" />
        <line x1={paddingX} y1={height / 2} x2={width - paddingX} y2={height / 2} stroke="var(--l)" strokeDasharray="3,3" />
        <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="var(--l)" />

        {/* Lines */}
        <polyline fill="none" stroke="var(--a)" strokeWidth="2" points={pointsR5.join(" ")} />
        <polyline fill="none" stroke="var(--ok)" strokeWidth="2" points={pointsR10.join(" ")} />

        {/* X Axis Run Labels */}
        {completed.map((run, i) => {
          const x = paddingX + (i * (width - 2 * paddingX)) / Math.max(1, completed.length - 1);
          return (
            <text key={run.id} x={x} y={height - 2} textAnchor="middle" fill="var(--m)" fontSize="10" className="font-mono">
              Run {i + 1}
            </text>
          );
        })}
      </svg>

      <div className="flex items-center gap-4 text-[12px] text-[var(--m)] pt-2">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[var(--a)]" />
          Recall@5
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[var(--ok)]" />
          Recall@10
        </span>
      </div>
    </div>
  );
}

export default function EvaluationPage() {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [casesRunId, setCasesRunId] = useState<string | null>(null);
  const [repositoryId, setRepositoryId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [repoResponse, runResponse] = await Promise.all([
        fetch("/api/repositories"),
        fetch("/api/eval/run"),
      ]);
      const repoData = await safeJson<Repository[]>(repoResponse);
      const runData = await safeJson<Run[]>(runResponse);
      if (!repoResponse.ok || !runResponse.ok) {
        throw new Error("Could not load evaluation data");
      }
      setRepos(repoData);
      setRuns(runData);
      if (repoData.length > 0 && !repositoryId) {
        setRepositoryId(repoData[0].id);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load evaluation data");
    }
  }, [repositoryId]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const selectedRuns = useMemo(() => {
    return repositoryId ? runs.filter((run) => run.repositoryId === repositoryId) : runs;
  }, [repositoryId, runs]);

  const latestRun = selectedRuns[0];

  // Fetch real cases for latest run
  useEffect(() => {
    if (!latestRun?.id) return;
    const runId = latestRun.id;
    fetch(`/api/eval/${runId}`)
      .then(async (res) => {
        const data = await safeJson<{ error?: string; cases: CaseItem[] }>(res);
        if (!res.ok) throw new Error(data.error ?? "Could not load evaluation cases");
        return data;
      })
      .then((data) => {
        if (Array.isArray(data.cases)) {
          setCases(data.cases);
          setCasesRunId(runId);
        }
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load evaluation cases"));
  }, [latestRun?.id]);

  const visibleCases = casesRunId === latestRun?.id ? cases : [];

  async function startNewRun() {
    if (!repositoryId) return;
    setBusy(true);
    setError("");
    try {
      let response = await fetch("/api/eval/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repositoryId }),
      });
      let data = await safeJson<EvaluationBatchResponse>(response);
      if (!response.ok) throw new Error(data.error ?? "Evaluation failed");
      let batches = 0;
      while (data.run?.status === "running" && batches < 100) {
        response = await fetch("/api/eval/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repositoryId, evalRunId: data.run.id }),
        });
        data = await safeJson<EvaluationBatchResponse>(response);
        batches += 1;
        if (!response.ok) throw new Error(data.error ?? "Evaluation failed");
      }
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Evaluation failed");
    } finally {
      setBusy(false);
    }
  }

  async function resumeRun(runItem: Run) {
    setBusy(true);
    setError("");
    try {
      let response = await fetch("/api/eval/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repositoryId: runItem.repositoryId, evalRunId: runItem.id }),
      });
      let data = await safeJson<EvaluationBatchResponse>(response);
      if (!response.ok) throw new Error(data.error ?? "Resume failed");
      while (data.run?.status === "running") {
        response = await fetch("/api/eval/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repositoryId: runItem.repositoryId, evalRunId: runItem.id }),
        });
        data = await safeJson<EvaluationBatchResponse>(response);
        if (!response.ok) throw new Error(data.error ?? "Resume failed");
      }
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Resume failed");
    } finally {
      setBusy(false);
    }
  }

  const activeRepo = repos.find((r) => r.id === repositoryId);
  const activeRepoName = activeRepo ? `${activeRepo.owner}/${activeRepo.name}` : "";

  // Metrics from real latest run
  const r5Val = typeof latestRun?.recallAt5 === "number" ? latestRun.recallAt5.toFixed(2) : "--";
  const r10Val = typeof latestRun?.recallAt10 === "number" ? latestRun.recallAt10.toFixed(2) : "--";
  const mrrVal = typeof latestRun?.mrr === "number" ? latestRun.mrr.toFixed(2) : "--";
  const groundingVal =
    typeof latestRun?.groundingRate === "number"
      ? `${Math.round(latestRun.groundingRate * 100)}%`
      : "--";

  return (
    <AppShell>
      <div className="blast-container">
        {/* Title row with repo select and "Start new run" */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-8">
          <div>
            <h1 className="page-title text-[28px]">Evaluation</h1>
            <p className="page-sub">
              Merged PRs have a known answer. Retrieval saw only each title and description, never the diff.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {repos.length > 0 ? (
              <select
                value={repositoryId}
                onChange={(e) => setRepositoryId(e.target.value)}
                className="input-base font-mono text-[13px] py-1.5 px-3 bg-[var(--p)] cursor-pointer"
              >
                {repos.map((repo) => (
                  <option key={repo.id} value={repo.id}>
                    {repo.owner}/{repo.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="font-mono text-[13px] text-[var(--m)] px-3 py-1.5 rounded-[8px] border border-[var(--l)] bg-[var(--p)] inline-block">
                No repositories
              </span>
            )}

            <button
              type="button"
              onClick={startNewRun}
              disabled={busy || !repositoryId}
              className="btn-primary text-[13px] py-1.5 px-3.5"
            >
              {busy ? "Running benchmark…" : "Start new run"}
            </button>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-6 border border-[var(--r)] bg-[var(--q)] p-4 text-[14px] text-[var(--r)] rounded-[8px]"
          >
            <p className="font-bold">{error}</p>
          </div>
        )}

        {/* 4 Metric Tiles (3 cols each) */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-4">
          <div className="panel p-5">
            <p className="text-[12px] font-medium text-[var(--m)]">Recall@5</p>
            <p className="font-mono text-[30px] font-extrabold text-[var(--t)] mt-1 tabular-nums">
              {r5Val}
            </p>
            <p className="text-[12px] text-[var(--m)] mt-1">
              Fraction of true changed files found in the first 5 retrieved chunks.
            </p>
          </div>

          <div className="panel p-5">
            <p className="text-[12px] font-medium text-[var(--m)]">Recall@10</p>
            <p className="font-mono text-[30px] font-extrabold text-[var(--t)] mt-1 tabular-nums">
              {r10Val}
            </p>
            <p className="text-[12px] text-[var(--m)] mt-1">
              Fraction found in the first 10 retrieved chunks.
            </p>
          </div>

          <div className="panel p-5">
            <p className="text-[12px] font-medium text-[var(--m)]">MRR</p>
            <p className="font-mono text-[30px] font-extrabold text-[var(--t)] mt-1 tabular-nums">
              {mrrVal}
            </p>
            <p className="text-[12px] text-[var(--m)] mt-1">
              Mean Reciprocal Rank: how high the first correct file was ranked.
            </p>
          </div>

          <div className="panel p-5">
            <p className="text-[12px] font-medium text-[var(--m)]">Grounding</p>
            <p className="font-mono text-[30px] font-extrabold text-[var(--t)] mt-1 tabular-nums">
              {groundingVal}
            </p>
            <p className="text-[12px] text-[var(--m)] mt-1">
              Fraction of predicted breaking changes supported by stored chunks.
            </p>
          </div>
        </div>

        {/* Middle Grid: 7 cols Trend + 5 cols Runs list */}
        <div className="grid grid-cols-12 gap-4 mb-4">
          {/* Trend Chart (7 cols) */}
          <div className="col-span-12 lg:col-span-7 panel p-6 flex flex-col justify-between">
            <div>
              <h2 className="text-[17px] font-bold text-[var(--t)]">Trend</h2>
              <p className="text-[13px] text-[var(--m)] mt-0.5">
                {activeRepoName ? `Recall progression for ${activeRepoName}` : "Progression over consecutive benchmark runs"}
              </p>
            </div>

            <div className="my-auto py-4">
              <TrendLineChart runs={selectedRuns} />
            </div>
          </div>

          {/* Runs List (5 cols) */}
          <div className="col-span-12 lg:col-span-5 panel p-6 flex flex-col justify-between">
            <div>
              <h2 className="text-[17px] font-bold text-[var(--t)]">Runs</h2>
              <p className="text-[13px] text-[var(--m)] mt-0.5">
                Benchmark executions on merged pull requests
              </p>
            </div>

            <div className="mt-4 pt-4 border-t border-[var(--l)] min-h-[200px]">
              {selectedRuns.length === 0 ? (
                <div className="py-12 text-center text-[13px] text-[var(--m)] space-y-3">
                  <p>No benchmark runs yet for this repository.</p>
                  <button
                    type="button"
                    onClick={startNewRun}
                    disabled={busy || !repositoryId}
                    className="btn-primary text-xs py-1.5 px-3"
                  >
                    Run first benchmark
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedRuns.map((r, i) => {
                    const isRunning = r.status === "running";
                    const isPaused = r.status === "paused";
                    const isComplete = r.status === "complete";
                    const runLabel = `Run ${selectedRuns.length - i}`;

                    return (
                      <div
                        key={r.id}
                        className="p-3.5 rounded-[8px] bg-[var(--q)] border border-[var(--l)] flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/eval/${r.id}`}
                              className="font-bold text-[14px] text-[var(--t)] hover:text-[var(--a)]"
                            >
                              {runLabel}
                            </Link>
                            <span
                              className={`text-[11px] font-mono px-1.5 py-0.5 rounded-[4px] uppercase ${
                                isComplete
                                  ? "bg-[rgba(95,211,160,0.15)] text-[var(--ok)]"
                                  : isPaused
                                  ? "bg-[rgba(242,193,78,0.15)] text-[var(--w)]"
                                  : "bg-[rgba(122,162,255,0.15)] text-[var(--a)]"
                              }`}
                            >
                              {r.status}
                            </span>
                          </div>
                          <p className="font-mono text-[11px] text-[var(--m)] mt-1 tabular-nums">
                            {r.totalCases} cases · Recall@5 {r.recallAt5 ?? "--"} · MRR {r.mrr ?? "--"}
                          </p>
                        </div>

                        <div className="shrink-0 flex items-center gap-2">
                          {(isPaused || isRunning) ? (
                            <button
                              type="button"
                              onClick={() => resumeRun(r)}
                              disabled={busy}
                              className="btn-primary text-[12px] py-1 px-2.5"
                            >
                              Resume
                            </button>
                          ) : (
                            <Link
                              href={`/eval/${r.id}`}
                              className="btn-secondary text-[12px] py-1 px-2.5"
                            >
                              Open
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 12-col Cases Panel */}
        <div className="panel p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[var(--l)]">
            <div>
              <h2 className="text-[17px] font-bold text-[var(--t)]">Cases</h2>
              <p className="text-[13px] text-[var(--m)] mt-0.5">
                Evaluation results for {latestRun ? `Run on ${activeRepoName}` : "current benchmark run"}
              </p>
            </div>
          </div>

          <div className="pt-4 min-h-[160px]">
            {visibleCases.length === 0 ? (
              <div className="py-12 text-center text-[13px] text-[var(--m)]">
                No benchmark cases recorded for this run. Index merged pull requests and run an evaluation.
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[var(--l)] text-[12px] text-[var(--m)]">
                    <th className="py-3 pr-4 font-medium w-[280px]">Merged PR</th>
                    <th className="py-3 px-4 font-medium">Changed files</th>
                    <th className="py-3 pl-4 text-right font-medium w-[120px]">Grounding</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--l)]">
                  {visibleCases.map((c) => {
                    const actual = c.actualFiles || [];
                    const predicted = c.predictedFiles || [];
                    return (
                      <tr key={c.prNumber} className="hover:bg-[var(--q)] transition-colors">
                        <td className="py-4 pr-4 align-middle">
                          <p className="font-bold text-[14px] text-[var(--t)]">
                            {c.prTitle || `PR #${c.prNumber}`}
                          </p>
                          <p className="font-mono text-[12px] text-[var(--m)] mt-0.5 tabular-nums">
                            #{c.prNumber}
                          </p>
                        </td>

                        <td className="py-4 px-4 align-middle">
                          <div className="flex flex-wrap gap-2 items-center">
                            {actual.map((filePath) => {
                              const short = getShortPath(filePath);
                              const rank = predicted.indexOf(filePath);
                              const hit = rank !== -1 && rank < 10;
                              return hit ? (
                                <span
                                  key={filePath}
                                  className="px-2 py-1 bg-[var(--q)] border border-[var(--l)] rounded-[6px] font-mono text-[12px] text-[var(--t)] tabular-nums"
                                >
                                  #{rank + 1} {short}
                                </span>
                              ) : (
                                <span
                                  key={filePath}
                                  className="px-2 py-1 bg-transparent border border-dashed border-[var(--r)] text-[var(--r)] rounded-[6px] font-mono text-[12px] tabular-nums"
                                >
                                  missed {short}
                                </span>
                              );
                            })}
                          </div>
                        </td>

                        <td className="py-4 pl-4 align-middle text-right font-mono text-[13px] text-[var(--t)] tabular-nums">
                          {c.groundingVerifiedCount ?? 0} of {c.groundingTotalCount ?? actual.length}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
