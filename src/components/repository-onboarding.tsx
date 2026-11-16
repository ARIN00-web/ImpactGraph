"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

type Repository = {
  id: string;
  owner: string;
  name: string;
  githubUrl: string;
  indexingStatus: string;
  indexedFileCount: number;
  chunkCount: number;
  embeddingPendingCount: number;
  lastIndexedAt: string | null;
};

type RecentReport = {
  id: string;
  prNumber: number | null;
  summary: string | null;
  riskScore: number | null;
  createdAt: string;
  repository: { owner: string; name: string };
};

type EvalSummary = {
  recallAt5: number | null;
  recallAt10: number | null;
  mrr: number | null;
  groundingRate: number | null;
  totalCases: number;
};

type UserAccount = {
  name: string;
  email: string;
  avatarUrl: string | null;
};

type JobState = {
  phase: string;
  progress: number;
};

type PipelineResponse = {
  done?: boolean;
  progress?: number;
  status?: string;
  message?: string;
  error?: string;
};

type ConnectResponse = (Repository & { error?: string }) | { repository: Repository; error?: string };
type EvalRunSummary = EvalSummary & { createdAt: string };

function formatLastIndexed(dateStr: string | null): string {
  if (!dateStr) return "Never indexed";
  try {
    const d = new Date(dateStr);
    return `Indexed ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
  } catch {
    return "Indexed recently";
  }
}

function formatReportDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  } catch {
    return "Recent";
  }
}

async function safeJson<T = unknown>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(res.ok ? "Invalid response format from server" : `Server error (${res.status})`);
  }
}

export function RepositoryOnboarding({
  initialUser,
}: {
  initialUser: UserAccount;
}) {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(null);
  const [dependencyRows, setDependencyRows] = useState<Record<string, Array<{ sourcePath: string; importedPath: string }>>>({});
  const [recentReports, setRecentReports] = useState<RecentReport[]>([]);
  const [latestEval, setLatestEval] = useState<EvalSummary | null>(null);
  const user = initialUser;

  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [job, setJob] = useState<JobState | null>(null);
  const [error, setError] = useState("");

  async function loadRepositories() {
    const response = await fetch("/api/repositories");
    if (!response.ok) {
      const data = await safeJson<{ error?: string }>(response).catch(() => ({ error: undefined }));
      throw new Error(data.error ?? "Could not load repositories");
    }
    const data = await safeJson<Repository[]>(response);
    setRepositories(data);
    if (data.length > 0) {
      setSelectedRepoId((current) => current || data[0].id);
    } else {
      setSelectedRepoId(null);
    }
  }

  useEffect(() => {
    Promise.resolve()
      .then(loadRepositories)
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load repositories"))
      .finally(() => setLoading(false));

    // Load recent reports for this user
    fetch("/api/analyses")
      .then(async (res) => {
        if (!res.ok) return [];
        return safeJson<RecentReport[]>(res).catch(() => []);
      })
      .then((data) => {
        if (Array.isArray(data)) setRecentReports(data.slice(0, 3));
      })
      .catch(() => undefined);

    // Load latest eval runs for 2x2 grid
    fetch("/api/eval/run")
      .then(async (res) => {
        if (!res.ok) return [];
        return safeJson<EvalRunSummary[]>(res).catch(() => []);
      })
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const run = data[0];
          setLatestEval({
            recallAt5: run.recallAt5,
            recallAt10: run.recallAt10,
            mrr: run.mrr,
            groundingRate: run.groundingRate,
            totalCases: run.totalCases ?? 0,
          });
        }
      })
      .catch(() => undefined);

  }, []);

  const selectedRepo =
    repositories.find((r) => r.id === selectedRepoId) || repositories[0] || null;

  const repoDependencies = selectedRepo ? dependencyRows[selectedRepo.id] ?? [] : [];

  // Load indexed import relationships for the selected repository.
  useEffect(() => {
    const repoId = selectedRepo?.id;
    if (!repoId) return;
    fetch(`/api/repositories/${repoId}`)
      .then(async (res) => {
        if (!res.ok) return null;
        return safeJson<{ dependencies?: Array<{ sourcePath: string; importedPath: string }> }>(res).catch(() => null);
      })
      .then((data) => {
        if (data?.dependencies) {
          const dependencies = data.dependencies;
          setDependencyRows((current) => ({ ...current, [repoId]: dependencies }));
        }
      })
      .catch(() => undefined);
  }, [selectedRepo?.id]);

  async function connectRepository(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!url.trim()) return;
    setConnecting(true);
    setError("");
    try {
      const response = await fetch("/api/repositories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await safeJson<ConnectResponse>(response);
      if (!response.ok && response.status !== 409) {
        throw new Error(data.error ?? "Could not connect repository");
      }
      const repository = "repository" in data ? data.repository : data;
      setUrl("");
      await loadRepositories();
      await runPipeline(repository);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not connect repository");
    } finally {
      setConnecting(false);
    }
  }

  async function runPipeline(repository: Repository) {
    setActiveId(repository.id);
    setError("");
    try {
      if (repository.indexingStatus !== "ready") {
        let done = false;
        while (!done) {
          setJob({ phase: "Indexing source, test, and documentation files", progress: 0 });
          const response = await fetch(`/api/repositories/${repository.id}/index`, { method: "POST" });
          const data = await safeJson<PipelineResponse>(response);
          if (!response.ok) throw new Error(data.error ?? "Indexing failed");
          done = Boolean(data.done);
          setJob({ phase: done ? "Indexing complete" : "Indexing source files", progress: data.progress ?? 0 });
        }
      }

      setJob({ phase: "Generating embeddings for retrieved chunks", progress: 0 });
      const embeddingResponse = await fetch(`/api/repositories/${repository.id}/embed`, { method: "POST" });
      const embeddingData = await safeJson<PipelineResponse>(embeddingResponse);
      if (!embeddingResponse.ok && embeddingResponse.status !== 409) {
        throw new Error(embeddingData.error ?? "Embedding failed");
      }
      if (embeddingData.status === "quota_exhausted") {
        throw new Error(embeddingData.message || "Embedding quota reached. Use Finish embeddings to resume.");
      }
      setJob({ phase: "Repository ready for prediction", progress: 100 });
      await loadRepositories();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Repository pipeline failed");
    } finally {
      setActiveId(null);
      setJob(null);
    }
  }

  const selectedRepoName = selectedRepo
    ? `${selectedRepo.owner}/${selectedRepo.name}`
    : "";

  const evalRecall5 = typeof latestEval?.recallAt5 === "number" ? latestEval.recallAt5.toFixed(2) : "--";
  const evalRecall10 = typeof latestEval?.recallAt10 === "number" ? latestEval.recallAt10.toFixed(2) : "--";
  const evalMrr = typeof latestEval?.mrr === "number" ? latestEval.mrr.toFixed(2) : "--";
  const evalGrounding =
    typeof latestEval?.groundingRate === "number"
      ? `${Math.round(latestEval.groundingRate * 100)}%`
      : "--";

  const userInitial = user.name.trim().charAt(0).toUpperCase();
  const userName = user.name;
  const totalReposCount = repositories.length;

  return (
    <div>
      {/* Title with One-line Subhead */}
      <div className="pb-8">
        <h1 className="page-title text-[28px]">Repositories</h1>
        <p className="page-sub">
          Index a public repo, then predict what a PR could break.
        </p>
      </div>

      {/* Error state */}
      {error && (
        <div
          role="alert"
          className="mb-6 border border-[var(--r)] bg-[var(--q)] p-4 text-[14px] text-[var(--r)] rounded-[8px]"
        >
          <p className="font-bold">{error}</p>
          {(error.toLowerCase().includes("quota") || error.toLowerCase().includes("rate limit")) && (
            <p className="mt-1 text-[13px] text-[var(--t)]">
              API quota exceeded. Indexing cursor is saved. Click Finish embeddings to resume when quota resets.
            </p>
          )}
        </div>
      )}

      {/* Active Pipeline Progress */}
      {job && (
        <div className="mb-6 p-4 panel space-y-2">
          <div className="flex items-center justify-between text-[13px]">
            <span className="font-semibold text-[var(--t)] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--w)] animate-pulse" />
              {job.phase}
            </span>
            <span className="font-mono text-[var(--m)] tabular-nums">{job.progress}%</span>
          </div>
          <div className="h-1.5 w-full bg-[var(--q)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--w)] transition-all duration-300"
              style={{ width: `${Math.max(5, job.progress)}%` }}
            />
          </div>
        </div>
      )}

      {/* Main Grid: 7 cols (Connect & List) + 5 cols (Dependency map) */}
      <div className="grid grid-cols-12 gap-4 mb-4">
        {/* Panel (7 cols): Connect & Repository List */}
        <div className="col-span-12 lg:col-span-7 panel p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-[17px] font-bold text-[var(--t)]">Connect a repository</h2>
            <p className="text-[13px] text-[var(--m)] mt-1">
              Indexing resumes from its saved cursor and skips unchanged files.
            </p>

            <form onSubmit={connectRepository} className="mt-4 flex gap-2">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://github.com/owner/repository"
                required
                disabled={connecting || Boolean(activeId)}
                className="input-base flex-1 text-[13px]"
              />
              <button
                type="submit"
                disabled={connecting || Boolean(activeId) || !url.trim()}
                className="btn-primary text-[13px] px-4"
              >
                {connecting ? "Connecting…" : "Connect"}
              </button>
            </form>
          </div>

          <div className="mt-6 pt-6 border-t border-[var(--l)] min-h-[160px]">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 w-full bg-[var(--q)] rounded-[8px] animate-pulse" />
                ))}
              </div>
            ) : repositories.length === 0 ? (
              <div className="py-8 text-center text-[13px] text-[var(--m)]">
                No repositories connected yet. Paste a public GitHub URL above to begin.
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[11px] font-semibold text-[var(--m)] border-b border-[var(--l)]">
                    <th className="pb-2 font-medium">Repository</th>
                    <th className="pb-2 font-medium">Indexed</th>
                    <th className="pb-2 font-medium">Chunks</th>
                    <th className="pb-2 font-medium">Embeddings</th>
                    <th className="pb-2 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--l)]">
                  {repositories.map((repo) => {
                    const working = activeId === repo.id;
                    const isComplete = repo.indexingStatus === "ready" && repo.embeddingPendingCount === 0;
                    const embeddedCount = Math.max(0, repo.chunkCount - repo.embeddingPendingCount);
                    const isSelected = selectedRepo?.id === repo.id;

                    return (
                      <tr
                        key={repo.id}
                        className={`transition-colors ${
                          isSelected ? "bg-[var(--q)]" : "hover:bg-[rgba(255,255,255,0.02)]"
                        }`}
                      >
                        <td className="py-3.5 pr-3 align-middle">
                          <button type="button" onClick={() => setSelectedRepoId(repo.id)} aria-pressed={isSelected} className="block max-w-[160px] truncate text-left font-mono text-[13px] font-bold text-[var(--t)] hover:text-[var(--a)]">
                            {repo.owner}/{repo.name}
                          </button>
                          <p className="text-[11px] text-[var(--m)] mt-0.5">
                            {formatLastIndexed(repo.lastIndexedAt)}
                          </p>
                        </td>

                        {/* Files */}
                        <td className="py-3.5 px-3 align-middle">
                          <span className="font-mono text-[12px] text-[var(--t)] tabular-nums">{repo.indexedFileCount.toLocaleString()}</span>
                        </td>

                        {/* Chunks */}
                        <td className="py-3.5 px-3 align-middle">
                          <span className="font-mono text-[12px] text-[var(--t)] tabular-nums">{repo.chunkCount.toLocaleString()}</span>
                        </td>

                        {/* Embeddings */}
                        <td className="py-3.5 px-3 align-middle">
                          <div className="w-24">
                            <div className="h-1 w-full bg-[var(--q)] rounded-full overflow-hidden">
                              <div
                                className={`h-full ${isComplete ? "bg-[var(--ok)]" : "bg-[var(--w)]"}`}
                                style={{ width: `${repo.chunkCount > 0 ? (embeddedCount / repo.chunkCount) * 100 : 0}%` }}
                              />
                            </div>
                            <p className="font-mono text-[11px] text-[var(--t)] mt-1 tabular-nums">
                              {isComplete
                                ? repo.chunkCount.toLocaleString()
                                : `${embeddedCount} of ${repo.chunkCount}`}
                            </p>
                          </div>
                        </td>

                        {/* Action */}
                        <td className="py-3.5 pl-3 align-middle text-right">
                          {working ? (
                            <span className="text-[12px] text-[var(--m)]">Processing…</span>
                          ) : isComplete ? (
                            <Link
                              href={`/analyze?repositoryId=${repo.id}`}
                              className="btn-secondary text-[12px] py-1 px-3"
                            >
                              Analyze
                            </Link>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                runPipeline(repo);
                              }}
                              className="btn-primary text-[12px] py-1 px-3"
                            >
                              Finish embeddings
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Panel (5 cols): Indexed relationships */}
        <div className="col-span-12 lg:col-span-5 panel p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-[17px] font-bold text-[var(--t)]">Indexed relationships</h2>
            <p className="text-[13px] text-[var(--m)] mt-1">
              {selectedRepo
                ? `${selectedRepoName} · import relationships from indexed files`
                : "Connect a repository to inspect its indexed import relationships"}
            </p>
          </div>

          <div className="my-5 max-h-[310px] overflow-y-auto rounded-lg border border-[var(--l)] bg-[var(--g)] p-3">
            {!selectedRepo ? (
              <p className="py-8 text-center text-[13px] text-[var(--m)]">No repository connected yet. Paste a public GitHub URL to begin.</p>
            ) : repoDependencies.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-[var(--m)]">No import relationships are stored for this repository yet.</p>
            ) : (
              <ul className="space-y-2">
                {repoDependencies.map((edge) => (
                  <li key={`${edge.sourcePath}-${edge.importedPath}`} className="rounded-md border border-[var(--l)] bg-[var(--p)] p-2.5">
                    <p className="break-all font-mono text-[11px] text-[var(--t)]">{edge.sourcePath}</p>
                    <p className="my-1 text-[10px] text-[var(--a)]">imports</p>
                    <p className="break-all font-mono text-[11px] text-[var(--m)]">{edge.importedPath}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {selectedRepo && repoDependencies.length >= 60 && <p className="text-[10px] text-[var(--m)]">Showing the first 60 indexed relationships.</p>}
        </div>
      </div>

      {/* Bottom Row: Three 4-col panels */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Panel 1 (4 cols): Recent reports */}
        <div className="panel p-6 space-y-4">
          <h2 className="text-[16px] font-bold text-[var(--t)]">Recent reports</h2>

          {recentReports.length > 0 ? (
            <div className="divide-y divide-[var(--l)]">
              {recentReports.map((report) => (
                <div key={report.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/analyses/${report.id}`}
                      className="text-[13px] font-bold text-[var(--t)] hover:text-[var(--a)] line-clamp-1"
                    >
                      {report.summary || (report.prNumber ? `PR #${report.prNumber} review` : "Change review")}
                    </Link>
                    <p className="font-mono text-[12px] text-[var(--m)] mt-0.5 tabular-nums">
                      {report.prNumber ? `#${report.prNumber}, ` : ""}{formatReportDate(report.createdAt)}
                    </p>
                  </div>

                  <div className="font-mono text-[18px] font-bold text-[var(--r)] tabular-nums shrink-0">
                    {report.riskScore ?? "--"}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-[13px] text-[var(--m)]">
              No reports yet. Analyze a pull request to generate your first impact report.
            </div>
          )}
        </div>

        {/* Panel 2 (4 cols): Latest evaluation */}
        <div className="panel p-6 space-y-4">
          <div>
            <h2 className="text-[16px] font-bold text-[var(--t)]">Latest evaluation</h2>
            <p className="text-[12px] text-[var(--m)] mt-0.5">
              {latestEval ? `Run 1, ${latestEval.totalCases} merged PRs` : "No evaluation runs yet"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="bg-[var(--q)] p-3 rounded-[8px] border border-[var(--l)]">
              <p className="font-mono text-[22px] font-extrabold text-[var(--t)] tabular-nums">
                {evalRecall5}
              </p>
              <p className="text-[12px] text-[var(--m)] mt-1">Recall@5</p>
            </div>

            <div className="bg-[var(--q)] p-3 rounded-[8px] border border-[var(--l)]">
              <p className="font-mono text-[22px] font-extrabold text-[var(--t)] tabular-nums">
                {evalRecall10}
              </p>
              <p className="text-[12px] text-[var(--m)] mt-1">Recall@10</p>
            </div>

            <div className="bg-[var(--q)] p-3 rounded-[8px] border border-[var(--l)]">
              <p className="font-mono text-[22px] font-extrabold text-[var(--t)] tabular-nums">
                {evalMrr}
              </p>
              <p className="text-[12px] text-[var(--m)] mt-1">MRR</p>
            </div>

            <div className="bg-[var(--q)] p-3 rounded-[8px] border border-[var(--l)]">
              <p className="font-mono text-[22px] font-extrabold text-[var(--t)] tabular-nums">
                {evalGrounding}
              </p>
              <p className="text-[12px] text-[var(--m)] mt-1">Grounding</p>
            </div>
          </div>
        </div>

        {/* Panel 3 (4 cols): Account */}
        <div className="panel p-6 space-y-4">
          <h2 className="text-[16px] font-bold text-[var(--t)]">Account</h2>

          <div className="flex items-center gap-3 pb-3 border-b border-[var(--l)]">
            {user?.avatarUrl ? (
              <Image
                src={user.avatarUrl}
                alt={userName}
                width={40}
                height={40}
                unoptimized
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[var(--a)] text-[var(--a-text)] text-[15px] font-extrabold flex items-center justify-center shrink-0">
                {userInitial}
              </div>
            )}
            <div>
              <p className="font-bold text-[14px] text-[var(--t)]">{userName}</p>
              <p className="text-[12px] text-[var(--m)]">
                Signed in with Google
              </p>
            </div>
          </div>

          <div className="space-y-2.5 text-[13px]">
            <div className="flex justify-between items-center">
              <span className="text-[var(--m)]">Repositories</span>
              <span className="font-mono text-[var(--t)] tabular-nums">{totalReposCount}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
