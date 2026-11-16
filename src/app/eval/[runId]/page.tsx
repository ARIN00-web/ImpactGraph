"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";

type Case = {
  prNumber: number;
  prTitle: string | null;
  predictedFiles: string[] | null;
  actualFiles: string[] | null;
  hitAt5: boolean | null;
  hitAt10: boolean | null;
  recallAt5: number | null;
  recallAt10: number | null;
  reciprocalRank: number | null;
  groundingVerifiedCount?: number;
  groundingTotalCount?: number;
};

type Data = {
  run: {
    id: string;
    repositoryId: string;
    status: string;
    recallAt5: number | null;
    recallAt10: number | null;
    mrr: number | null;
    groundingRate: number | null;
    totalCases: number;
    cursor: number;
    createdAt?: string;
  };
  cases: Case[];
};

type Repository = { id: string; owner: string; name: string };

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

export default function EvaluationRunPage({ params }: { params: Promise<{ runId: string }> }) {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [repository, setRepository] = useState<Repository | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    params.then(({ runId }) =>
      fetch(`/api/eval/${runId}`)
        .then(async (response) => {
          if (!response.ok) {
            const errData = await safeJson<{ error?: string }>(response).catch(() => ({ error: undefined }));
            throw new Error(errData.error ?? "Could not load evaluation");
          }
          const value = await safeJson<Data>(response);
          setData(value);

          if (value.run?.repositoryId) {
            fetch("/api/repositories")
              .then(async (res) => {
                if (!res.ok) return [];
                return safeJson<Repository[]>(res).catch(() => []);
              })
              .then((repos: Repository[]) => {
                const found = repos.find((r) => r.id === value.run.repositoryId);
                if (found) setRepository(found);
              })
              .catch(() => undefined);
          }
        })
        .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load evaluation"))
    );
  }, [params]);

  async function continueRun() {
    if (!data) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/eval/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repositoryId: data.run.repositoryId, evalRunId: data.run.id }),
      });
      const value = await safeJson<Data & { error?: string }>(response);
      if (!response.ok) throw new Error(value.error ?? "Could not continue evaluation");
      setData(value);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not continue evaluation");
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) {
    return (
      <AppShell>
        <div className="blast-container">
          <div
            role="alert"
            className="border border-[var(--r)] bg-[var(--q)] p-6 text-[14px] text-[var(--r)] rounded-[12px] max-w-xl"
          >
            <p className="font-bold">{error}</p>
            <div className="mt-4">
              <Link href="/eval" className="btn-secondary">
                Back to evaluation
              </Link>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell>
        <div className="blast-container space-y-6 animate-pulse">
          <div className="space-y-2">
            <div className="h-8 bg-[var(--p)] rounded w-64" />
            <div className="h-4 bg-[var(--p)] rounded w-96" />
          </div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="panel h-28" />
            ))}
          </div>
          <div className="panel h-96" />
        </div>
      </AppShell>
    );
  }

  const repoName = repository ? `${repository.owner}/${repository.name}` : "";
  const runLabel = `Run on ${repoName || "repository"}`;
  const totalMergedPrs = data.run.totalCases || 0;

  const recall5Val = typeof data.run.recallAt5 === "number" ? data.run.recallAt5.toFixed(2) : "--";
  const recall10Val = typeof data.run.recallAt10 === "number" ? data.run.recallAt10.toFixed(2) : "--";
  const mrrVal = typeof data.run.mrr === "number" ? data.run.mrr.toFixed(2) : "--";
  const groundingVal =
    typeof data.run.groundingRate === "number"
      ? `${Math.round(data.run.groundingRate * 100)}%`
      : "--";

  const casesList: Case[] = data.cases || [];

  return (
    <AppShell>
      <div className="blast-container">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-8">
          <div>
            <h1 className="page-title text-[28px]">
              {runLabel}
            </h1>
            <p className="page-sub text-[14px] text-[var(--m)] mt-1">
              {totalMergedPrs} merged PRs. Retrieval saw only each title and description, never the diff.
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-3">
            {data.run.status !== "complete" && (
              <button
                type="button"
                onClick={continueRun}
                disabled={busy}
                className="btn-primary"
              >
                {busy ? "Continuing…" : "Continue run"}
              </button>
            )}
            <button
              type="button"
              onClick={() => router.push("/eval")}
              className="btn-secondary"
            >
              Start new run
            </button>
          </div>
        </div>

        {/* Four 3-col metric tiles */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div className="panel p-5">
            <p className="text-[13px] text-[var(--m)]">Recall@5</p>
            <p className="font-mono text-[30px] font-extrabold text-[var(--t)] tabular-nums mt-2 leading-none">
              {recall5Val}
            </p>
            <p className="text-[12px] text-[var(--m)] mt-2">Expected files in the top 5</p>
          </div>

          <div className="panel p-5">
            <p className="text-[13px] text-[var(--m)]">Recall@10</p>
            <p className="font-mono text-[30px] font-extrabold text-[var(--t)] tabular-nums mt-2 leading-none">
              {recall10Val}
            </p>
            <p className="text-[12px] text-[var(--m)] mt-2">Expected files in the top 10</p>
          </div>

          <div className="panel p-5">
            <p className="text-[13px] text-[var(--m)]">MRR</p>
            <p className="font-mono text-[30px] font-extrabold text-[var(--t)] tabular-nums mt-2 leading-none">
              {mrrVal}
            </p>
            <p className="text-[12px] text-[var(--m)] mt-2">Rank of first expected file</p>
          </div>

          <div className="panel p-5">
            <p className="text-[13px] text-[var(--m)]">Grounding</p>
            <p className="font-mono text-[30px] font-extrabold text-[var(--t)] tabular-nums mt-2 leading-none">
              {groundingVal}
            </p>
            <p className="text-[12px] text-[var(--m)] mt-2">Findings with valid evidence</p>
          </div>
        </div>

        {/* 12-col Cases Panel */}
        <div className="panel p-6">
          <div className="pb-4 border-b border-[var(--l)]">
            <h2 className="text-[16px] font-bold text-[var(--t)]">Cases in run</h2>
            <p className="text-[13px] text-[var(--m)] mt-0.5">
              Where retrieval ranked each changed file
            </p>
          </div>

          <div className="overflow-x-auto pt-4 min-h-[160px]">
            {casesList.length === 0 ? (
              <div className="py-12 text-center text-[13px] text-[var(--m)]">
                No benchmark cases recorded for this evaluation run.
              </div>
            ) : (
              <table className="w-full text-left text-[13px] border-collapse min-w-[680px]">
                <thead>
                  <tr className="border-b border-[var(--l)] text-[12px] text-[var(--m)]">
                    <th className="py-3 pr-4 font-medium w-[280px]">Merged PR</th>
                    <th className="py-3 px-4 font-medium">Changed files</th>
                    <th className="py-3 pl-4 text-right font-medium w-[120px]">Grounding</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--l)]">
                  {casesList.map((c) => {
                    const actual = Array.isArray(c.actualFiles) ? c.actualFiles : [];
                    const predicted = Array.isArray(c.predictedFiles) ? c.predictedFiles : [];

                    const verifiedCount = c.groundingVerifiedCount ?? 0;
                    const totalCount = c.groundingTotalCount ?? actual.length;

                    return (
                      <tr key={c.prNumber} className="hover:bg-[var(--q)] transition-colors">
                        <td className="py-4 pr-4 align-middle">
                          <p className="font-bold text-[14px] text-[var(--t)]">
                            {c.prTitle || `Pull request #${c.prNumber}`}
                          </p>
                          <p className="font-mono text-[12px] text-[var(--m)] mt-0.5 tabular-nums">
                            #{c.prNumber}
                          </p>
                        </td>

                        <td className="py-4 px-4 align-middle">
                          <div className="flex flex-wrap gap-2 items-center">
                            {actual.map((rawFile) => {
                              const shortFile = getShortPath(rawFile);
                              const rankIndex = predicted.findIndex((p) => {
                                const pShort = getShortPath(p);
                                return (
                                  pShort.toLowerCase() === shortFile.toLowerCase() ||
                                  p.toLowerCase().includes(shortFile.toLowerCase())
                                );
                              });

                              const isHit = rankIndex !== -1 && rankIndex < 10;
                              const rank = rankIndex + 1;

                              if (isHit) {
                                return (
                                  <span
                                    key={rawFile}
                                    className="px-2 py-1 bg-[var(--q)] border border-[var(--l)] rounded-[6px] font-mono text-[12px] text-[var(--t)] tabular-nums"
                                  >
                                    #{rank} {shortFile}
                                  </span>
                                );
                              } else {
                                return (
                                  <span
                                    key={rawFile}
                                    className="px-2 py-1 bg-transparent border border-dashed border-[var(--r)] text-[var(--r)] rounded-[6px] font-mono text-[12px] tabular-nums"
                                  >
                                    missed {shortFile}
                                  </span>
                                );
                              }
                            })}
                          </div>
                        </td>

                        <td className="py-4 pl-4 align-middle text-right font-mono text-[13px] text-[var(--t)] tabular-nums">
                          {verifiedCount} of {totalCount}
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
