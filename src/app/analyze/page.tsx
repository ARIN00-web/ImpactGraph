"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";

type Repository = { id: string; owner: string; name: string };

type PullRequest = {
  number: string | null;
  title: string | null;
  content: string | null;
  metadata?: {
    state?: string;
    author?: string | null;
    changedFiles?: number | null;
    htmlUrl?: string;
    createdAt?: string;
    paths?: Array<{ path: string; additions: number; deletions: number }>;
  };
};

function formatAge(dateStr?: string): string {
  if (!dateStr) return "recently";
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffDays = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    if (diffDays === 1) return "1 day ago";
    return `${diffDays} days ago`;
  } catch {
    return "recently";
  }
}

async function safeJson<T = unknown>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(res.ok ? "Invalid response from server" : `Server error (${res.status})`);
  }
}

export default function AnalyzePage() {
  const router = useRouter();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([]);
  const [loadedPrRepositoryId, setLoadedPrRepositoryId] = useState<string | null>(null);
  const [repositoryId, setRepositoryId] = useState("");
  const [activeTab, setActiveTab] = useState<"describe" | "open" | "merged">("open");
  const [prNumber, setPrNumber] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");

  // Load repositories for current user
  useEffect(() => {
    const preset = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("repositoryId");
    fetch("/api/repositories")
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not load repositories");
        return safeJson<Repository[]>(res);
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setRepositories(data);
          if (preset && data.some((r) => r.id === preset)) {
            setRepositoryId(preset);
          } else if (data.length > 0) {
            setRepositoryId(data[0].id);
          }
        }
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load repositories"));
  }, []);

  // When selected repository changes, load its PRs and dependency graph
  useEffect(() => {
    if (!repositoryId) return;

    fetch(`/api/repositories/${repositoryId}/prs`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await safeJson<{ error?: string }>(res).catch(() => ({ error: undefined }));
          throw new Error(data.error ?? "Could not load pull requests");
        }
        return safeJson<PullRequest[]>(res);
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setPullRequests(data);
        }
        setLoadedPrRepositoryId(repositoryId);
      })
      .catch((cause) => {
        setPullRequests([]);
        setError(cause instanceof Error ? cause.message : "Could not load pull requests");
        setLoadedPrRepositoryId(repositoryId);
      })
  }, [repositoryId]);

  const visiblePullRequests = useMemo(() => {
    if (activeTab === "describe") return [];
    return pullRequests.filter((pr) => (pr.metadata?.state ?? "merged") === activeTab);
  }, [pullRequests, activeTab]);

  const selectedPullRequest = useMemo(() => {
    if (!prNumber) return visiblePullRequests[0] || null;
    return visiblePullRequests.find((pr) => pr.number === prNumber) || visiblePullRequests[0] || null;
  }, [prNumber, visiblePullRequests]);

  const loadingPrs = Boolean(repositoryId && loadedPrRepositoryId !== repositoryId);

  async function submit(event: { preventDefault: () => void }) {
    event.preventDefault();
    if (!repositoryId) {
      setError("Please connect and select a repository first.");
      return;
    }
    const isPrMode = activeTab !== "describe";
    if (isPrMode && !selectedPullRequest?.number) {
      setError("Please select a pull request to analyze.");
      return;
    }
    if (!isPrMode && !description.trim()) {
      setError("Please describe the code change you want to analyze.");
      return;
    }

    setBusy(true);
    setError("");
    setElapsed(0);
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repositoryId,
          inputType: isPrMode ? "pr" : "description",
          prNumber: isPrMode ? Number(selectedPullRequest?.number) : undefined,
          description: !isPrMode ? description : undefined,
        }),
      });

      const data = await safeJson<{ analysisId?: string; error?: string }>(response);
      if (!response.ok) throw new Error(data.error ?? "Analysis failed. Try again.");
      router.push(`/analyses/${data.analysisId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Analysis failed. Check API rate limits and try again.");
    } finally {
      window.clearInterval(timer);
      setBusy(false);
    }
  }

  const currentRepo = repositories.find((r) => r.id === repositoryId);
  const repoLabel = currentRepo ? `${currentRepo.owner}/${currentRepo.name}` : "No repositories connected";

  // Build the changed paths list from the selected pull request response.
  const paths = selectedPullRequest?.metadata?.paths || [];

  return (
    <AppShell>
      <div className="blast-container">
        {/* Title row with Repository selector at right */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--l)] mb-6">
          <div>
            <h1 className="page-title text-[28px]">Analyze a change</h1>
            <p className="page-sub">
              Pick a PR or describe a change. Changed paths are added to retrieval.
            </p>
          </div>

          {/* Repo Select */}
          <div className="shrink-0">
            {repositories.length > 0 ? (
              <select
                value={repositoryId}
                onChange={(e) => setRepositoryId(e.target.value)}
                className="input-base font-mono text-[13px] py-1.5 px-3 bg-[var(--p)] cursor-pointer"
              >
                {repositories.map((repo) => (
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
          </div>
        </div>

        {/* Error alert */}
        {error && (
          <div
            role="alert"
            className="mb-6 border border-[var(--r)] bg-[var(--q)] p-4 text-[14px] text-[var(--r)] rounded-[8px]"
          >
            <p className="font-bold">{error}</p>
          </div>
        )}

        {/* 3 x 4-col Panels */}
        <div className="grid grid-cols-12 gap-4">
          {/* Left Panel (4 cols): Segmented Control & PR Rows */}
          <div className="col-span-12 lg:col-span-4 panel p-5 flex flex-col justify-between min-h-[420px]">
            <div>
              {/* Segmented control: Describe, Open PRs, Merged */}
              <div
                role="tablist"
                className="grid grid-cols-3 gap-1 p-1 bg-[var(--q)] rounded-[8px] border border-[var(--l)] mb-4 text-[13px]"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "describe"}
                  onClick={() => setActiveTab("describe")}
                  className={`py-1.5 rounded-[6px] text-center font-semibold transition-colors cursor-pointer ${
                    activeTab === "describe"
                      ? "bg-[var(--p)] text-[var(--t)]"
                      : "text-[var(--m)] hover:text-[var(--t)]"
                  }`}
                >
                  Describe
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "open"}
                  onClick={() => setActiveTab("open")}
                  className={`py-1.5 rounded-[6px] text-center font-semibold transition-colors cursor-pointer ${
                    activeTab === "open"
                      ? "bg-[var(--p)] text-[var(--t)]"
                      : "text-[var(--m)] hover:text-[var(--t)]"
                  }`}
                >
                  Open PRs
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "merged"}
                  onClick={() => setActiveTab("merged")}
                  className={`py-1.5 rounded-[6px] text-center font-semibold transition-colors cursor-pointer ${
                    activeTab === "merged"
                      ? "bg-[var(--p)] text-[var(--t)]"
                      : "text-[var(--m)] hover:text-[var(--t)]"
                  }`}
                >
                  Merged
                </button>
              </div>

              {/* PR Rows / Describe Info */}
              {activeTab === "describe" ? (
                <div className="p-4 rounded-[8px] bg-[var(--q)] border border-[var(--l)] text-[13px] text-[var(--m)] leading-relaxed">
                  <p className="font-semibold text-[var(--t)] mb-1">Manual change analysis</p>
                  Use the middle panel to draft or paste a commit description, refactor plan, or feature diff to test against indexed code chunks.
                </div>
              ) : repositories.length === 0 ? (
                <div className="py-12 text-center text-[13px] text-[var(--m)] space-y-3">
                  <p>No repository connected.</p>
                  <Link href="/dashboard" className="btn-secondary text-xs py-1.5 px-3 inline-block">
                    Connect a repository
                  </Link>
                </div>
              ) : loadingPrs ? (
                <div className="space-y-2 py-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-14 w-full rounded-[8px] bg-[var(--q)] animate-pulse" />
                  ))}
                </div>
              ) : visiblePullRequests.length === 0 ? (
                <div className="py-12 text-center text-[13px] text-[var(--m)]">
                  <p>No {activeTab} PRs found for {repoLabel}.</p>
                  <p className="text-xs text-[var(--m)] mt-1">Use the Describe tab to test any change description.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                  {visiblePullRequests.map((pr) => {
                    const isSelected = selectedPullRequest?.number === pr.number;
                    const prFilesCount = pr.metadata?.paths?.length ?? pr.metadata?.changedFiles ?? 0;
                    return (
                      <div
                        key={pr.number || pr.title}
                        role="button"
                        tabIndex={0}
                        onClick={() => setPrNumber(pr.number)}
                        onKeyDown={(e) => e.key === "Enter" && setPrNumber(pr.number)}
                        className={`p-3 rounded-[8px] border transition-all text-left cursor-pointer ${
                          isSelected
                            ? "bg-[var(--q)] border-[var(--a)] ring-1 ring-[var(--a)]"
                            : "bg-[var(--p)] border-[var(--l)] hover:bg-[var(--q)]"
                        }`}
                      >
                        <p className="text-[13px] font-bold text-[var(--t)] line-clamp-1">
                          {pr.title || "Untitled pull request"}
                        </p>
                        <p className="font-mono text-[11px] text-[var(--m)] mt-1.5 tabular-nums">
                          {pr.number ? `#${pr.number}, ` : ""}
                          {pr.metadata?.author ? `${pr.metadata.author}, ` : ""}
                          {formatAge(pr.metadata?.createdAt)}
                          {prFilesCount > 0 ? `, ${prFilesCount} files` : ""}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Middle Panel (4 cols): Selected PR Detail or Describe Textarea */}
          <div className="col-span-12 lg:col-span-4 panel p-5 flex flex-col justify-between min-h-[420px]">
            {activeTab === "describe" ? (
              <form onSubmit={submit} className="flex-1 flex flex-col justify-between">
                <div>
                  <h2 className="text-[17px] font-bold text-[var(--t)] mb-1">
                    Describe change
                  </h2>
                  <p className="text-[12px] text-[var(--m)] mb-4">
                    Describe the proposed diff or behavior for {repoLabel}.
                  </p>

                  <textarea
                    rows={12}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the behavior change, affected components, or refactor you plan to make."
                    disabled={busy || repositories.length === 0}
                    className="input-base w-full text-[13px] leading-relaxed resize-none font-sans"
                    required
                  />
                </div>

                <div className="pt-4 border-t border-[var(--l)] mt-4">
                  <button
                    type="submit"
                    disabled={busy || !description.trim() || repositories.length === 0}
                    className="btn-primary w-full text-[13px] py-2.5"
                  >
                    {busy ? `Analyzing change… (${elapsed}s)` : "Analyze change"}
                  </button>
                </div>
              </form>
            ) : selectedPullRequest ? (
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <h2 className="text-[17px] font-bold text-[var(--t)] leading-tight mb-1">
                    {selectedPullRequest.title}
                  </h2>
                  <p className="font-mono text-[12px] text-[var(--m)] mb-3 tabular-nums">
                    {selectedPullRequest.metadata?.author
                      ? `Opened by ${selectedPullRequest.metadata.author}`
                      : "Pull request review"}
                  </p>

                  {selectedPullRequest.content && (
                    <p className="text-[13px] text-[var(--m)] line-clamp-3 mb-4 leading-relaxed bg-[var(--q)] p-3 rounded-[8px] border border-[var(--l)]">
                      {selectedPullRequest.content}
                    </p>
                  )}

                  {/* Changed Paths */}
                  <div>
                    <p className="text-[12px] font-bold text-[var(--t)] mb-2">Changed paths</p>
                    {paths.length > 0 ? (
                      <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
                        {paths.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-[11px] font-mono py-1 px-2 rounded-[6px] bg-[var(--q)] border border-[var(--l)]"
                          >
                            <span className="truncate max-w-[200px] text-[var(--t)]">
                              {item.path}
                            </span>
                            <span className="text-[var(--m)] tabular-nums shrink-0 ml-2">
                              <span className="text-[var(--ok)]">+{item.additions}</span>{" "}
                              <span className="text-[var(--r)]">-{item.deletions}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[12px] text-[var(--m)]">Changed file paths are fetched from GitHub when the analysis is submitted{selectedPullRequest.metadata?.changedFiles != null ? ` · ${selectedPullRequest.metadata.changedFiles} files` : ""}.</p>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-[var(--l)] mt-4">
                  <button
                    type="button"
                    onClick={submit}
                    disabled={busy || repositories.length === 0}
                    className="btn-primary w-full text-[13px] py-2.5"
                  >
                    {busy ? `Analyzing pull request… (${elapsed}s)` : "Analyze pull request"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-between text-center py-12 text-[13px] text-[var(--m)]">
                <div>
                  <p className="font-semibold text-[var(--t)] mb-1">No pull request selected</p>
                  <p>Pick a pull request on the left or switch to the Describe tab.</p>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel: actual input context */}
          <div className="col-span-12 lg:col-span-4 panel p-5 min-h-[420px]">
            <div>
              <h2 className="text-[17px] font-bold text-[var(--t)]">Input details</h2>
              <p className="mt-1 text-[12px] text-[var(--m)]">Context that will be submitted for analysis.</p>
            </div>
            <dl className="mt-5 divide-y divide-[var(--l)] border-y border-[var(--l)] text-[12px]">
              <div className="flex items-start justify-between gap-4 py-3">
                <dt className="text-[var(--m)]">Repository</dt>
                <dd className="break-all text-right font-mono text-[var(--t)]">{repoLabel}</dd>
              </div>
              <div className="flex items-start justify-between gap-4 py-3">
                <dt className="text-[var(--m)]">Input type</dt>
                <dd className="text-right text-[var(--t)]">{activeTab === "describe" ? "Change description" : `${activeTab === "open" ? "Open" : "Merged"} pull request`}</dd>
              </div>
              {activeTab === "describe" ? (
                <div className="flex items-start justify-between gap-4 py-3">
                  <dt className="text-[var(--m)]">Description length</dt>
                  <dd className="font-mono text-[var(--t)]">{description.trim().length.toLocaleString()} characters</dd>
                </div>
              ) : selectedPullRequest ? (
                <>
                  <div className="flex items-start justify-between gap-4 py-3">
                    <dt className="text-[var(--m)]">Pull request</dt>
                    <dd className="text-right text-[var(--t)]">{selectedPullRequest.number ? `#${selectedPullRequest.number} · ` : ""}{selectedPullRequest.title}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-4 py-3">
                    <dt className="text-[var(--m)]">Changed files</dt>
                    <dd className="font-mono text-[var(--t)]">{paths.length > 0 ? paths.length.toLocaleString() : selectedPullRequest.metadata?.changedFiles ?? "Fetched on submit"}</dd>
                  </div>
                </>
              ) : null}
            </dl>
            {activeTab !== "describe" && selectedPullRequest && paths.length > 0 && (
              <ul className="mt-4 max-h-64 space-y-1.5 overflow-y-auto" aria-label="Changed files">
                {paths.map((item) => <li key={item.path} className="truncate rounded-md bg-[var(--q)] px-2.5 py-2 font-mono text-[11px] text-[var(--t)]" title={item.path}>{item.path}</li>)}
              </ul>
            )}
            {activeTab === "describe" && !description.trim() && (
              <p className="mt-4 text-[12px] leading-5 text-[var(--m)]">Describe the behavior or files involved in the proposed change to give retrieval useful context.</p>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
