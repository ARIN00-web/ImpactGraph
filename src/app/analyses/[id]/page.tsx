"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ImpactMap } from "@/components/impact-map";

type Evidence = {
  relevanceScore: number | null;
  snippet: string | null;
  document: { path: string | null; sha: string | null } | null;
  chunk: { startLine: number | null; endLine: number | null } | null;
};

type Finding = {
  finding: {
    id: string;
    component: string | null;
    filePath: string | null;
    impactType: string | null;
    confidence: number | null;
    reason: string | null;
    verified: boolean;
  };
  evidence: Evidence[];
};

type Report = {
  analysis: {
    id: string;
    repositoryId: string;
    inputType: string;
    inputText: string | null;
    prNumber: number | null;
    riskScore: number | null;
    summary: string | null;
    reviewDetails: {
      assessment?: string;
      strengths?: string[];
      recommendations?: string[];
      limitations?: string[];
      changedPaths?: string[];
      github?: { filesReturned: number; totalChangedFiles: number; sourceFilesCompared: number; truncatedAt100Files: boolean } | null;
      prDetails?: { title: string; author: string | null; url: string; baseBranch: string; headBranch: string; baseSha: string; headSha: string; commitCount: number; commits: Array<{ sha: string; message: string; author: string | null }>; commitsMayBeTruncated: boolean } | null;
      prImpact?: {
        files: Array<{ filename: string; status: string; additions: number; deletions: number; patch?: string; patchTruncated: boolean }>;
        findings: Array<{ id: string; title: string; severity: string; category: string; filePath: string; symbol: string | null; explanation: string; consequence: string; recommendation: string; confidence: string; confirmed: boolean; evidence: string[]; impactedConsumers: Array<{ path: string; symbol: string | null; evidence: string }> }>;
        testRecommendations: Array<{ path: string; reason: string }>;
        sourceFilesCompared: number;
        risk: { score: number; classification: string; factors: Record<string, { score: number | null; weight: number; contribution: number | null; reason: string }>; uncertainty: string[] };
        mergeReadiness: { status: string; complete: boolean; summary: string; beforeMerge: string[]; counts: Record<string, number> };
        diffAvailable: boolean;
      } | null;
    } | null;
    createdAt?: string;
  };
  repository?: { owner: string; name: string; defaultBranch: string | null };
  findings: Finding[];
  dependencies: { sourcePath: string; importedPath: string }[];
  changedPaths: string[];
  unindexedPaths: string[];
};

async function safeJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(response.ok ? "Invalid server response" : `Server error (${response.status})`);
  }
}

function formatDate(date?: string) {
  if (!date) return null;
  const value = new Date(date);
  return Number.isNaN(value.getTime())
    ? null
    : value.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function AnalysisReportPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [reRunning, setReRunning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    params.then(({ id }) =>
      fetch(`/api/analyses/${id}`)
        .then(async (response) => {
          const data = await safeJson<Report & { error?: string }>(response);
          if (!response.ok) throw new Error(data.error ?? "Could not load report");
          if (!cancelled) setReport(data);
        })
        .catch((cause) => {
          if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load report");
        })
    );
    return () => { cancelled = true; };
  }, [params]);

  const findings = useMemo(() => {
    if (!report) return [];
    return report.findings.slice().sort((a, b) => {
      if (a.finding.verified !== b.finding.verified) return a.finding.verified ? -1 : 1;
      return (b.finding.confidence ?? 0) - (a.finding.confidence ?? 0);
    });
  }, [report]);

  async function handleReRun() {
    if (!report || reRunning) return;
    setReRunning(true);
    setError("");
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repositoryId: report.analysis.repositoryId,
          inputType: report.analysis.inputType,
          prNumber: report.analysis.prNumber,
          description: report.analysis.inputText,
        }),
      });
      const data = await safeJson<{ analysisId?: string; error?: string }>(response);
      if (!response.ok) throw new Error(data.error ?? "Re-run failed. Try again.");
      if (data.analysisId) router.push(`/analyses/${data.analysisId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Re-run analysis failed");
    } finally {
      setReRunning(false);
    }
  }

  if (error) {
    return (
      <AppShell>
        <div className="blast-container">
          <div role="alert" className="panel max-w-2xl border-[var(--r)] p-6">
            <h2 className="font-bold text-[var(--r)]">Report unavailable</h2>
            <p className="mt-2 text-[13px] text-[var(--m)]">{error}</p>
            <Link href="/analyses" className="btn-secondary mt-5">Return to reports</Link>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!report) {
    return (
      <AppShell>
        <div className="blast-container animate-pulse space-y-5" aria-label="Loading analysis report">
          <div className="h-7 w-64 rounded bg-[var(--q)]" />
          <div className="h-64 rounded-xl bg-[var(--p)]" />
          <div className="h-72 rounded-xl bg-[var(--p)]" />
        </div>
      </AppShell>
    );
  }

  const score = report.analysis.riskScore;
  const groundedCount = report.findings.filter(({ finding }) => finding.verified).length;
  const unverifiedCount = report.findings.length - groundedCount;
  const title = report.analysis.prNumber
    ? (report.analysis.reviewDetails?.prDetails?.title || `Pull request #${report.analysis.prNumber}`)
    : "Change description analysis";
  const repoDisplay = report.repository
    ? `${report.repository.owner}/${report.repository.name}`
    : null;
  const created = formatDate(report.analysis.createdAt);
  const meta = [repoDisplay, created].filter(Boolean).join(" · ");
  const assessment = report.analysis.reviewDetails?.assessment ?? report.analysis.summary;
  const prImpact = report.analysis.reviewDetails?.prImpact;

  return (
    <AppShell>
      <div className="blast-container space-y-5">
        <header className="flex flex-col justify-between gap-4 border-b border-[var(--l)] pb-5 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <p className="font-mono text-[11px] text-[var(--m)]">{meta || "Saved analysis"}</p>
            <h2 className="mt-1 text-[24px] font-extrabold tracking-tight text-[var(--t)]">{title}</h2>
            {report.analysis.prNumber && report.analysis.reviewDetails?.prDetails && <p className="mt-1 text-[11px] text-[var(--m)]">PR #{report.analysis.prNumber}{report.analysis.reviewDetails.prDetails.author ? ` · by ${report.analysis.reviewDetails.prDetails.author}` : ""} · {report.analysis.reviewDetails.prDetails.baseBranch} → {report.analysis.reviewDetails.prDetails.headBranch} · {report.analysis.reviewDetails.prDetails.commitCount} commits · <a className="text-[var(--a)] hover:underline" href={report.analysis.reviewDetails.prDetails.url} target="_blank" rel="noreferrer">Open on GitHub</a></p>}
            {assessment && <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[var(--m)]">{assessment}</p>}
          </div>
          <button type="button" onClick={handleReRun} disabled={reRunning} className="btn-secondary shrink-0">
            {reRunning ? "Re-running…" : "Re-run analysis"}
          </button>
        </header>

        {error && <div role="alert" className="rounded-lg border border-[var(--r)] bg-[var(--q)] p-3 text-[13px] text-[var(--r)]">{error}</div>}

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
          <div className="panel p-5">
            <p className="text-[12px] font-semibold text-[var(--m)]">{prImpact ? "Deterministic risk score" : "Risk score"}</p>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-mono text-[42px] font-extrabold leading-none text-[var(--r)] tabular-nums">{score ?? "—"}</span>
              {score !== null && <span className="text-[13px] text-[var(--m)]">/ 100</span>}
            </div>
            {score !== null && <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--q)]"><div className="h-full bg-[var(--r)]" style={{ width: `${Math.min(100, Math.max(0, score))}%` }} /></div>}
            {score === null && <p className="mt-3 text-[12px] text-[var(--m)]">No deterministic PR risk score is available without a live GitHub pull request diff.</p>}
            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-[var(--l)] pt-4">
              <div><p className="font-mono text-[22px] font-bold text-[var(--ok)]">{groundedCount}</p><p className="text-[11px] text-[var(--m)]">Grounded findings</p></div>
              <div><p className="font-mono text-[22px] font-bold text-[var(--w)]">{unverifiedCount}</p><p className="text-[11px] text-[var(--m)]">Unverified</p></div>
            </div>
          </div>

          <div className="panel min-w-0 p-4 sm:p-5">
            <div className="mb-4">
              <h3 className="text-[15px] font-bold text-[var(--t)]">Dependency impact</h3>
              <p className="mt-1 text-[12px] text-[var(--m)]">Changed paths and importer relationships from the indexed repository.</p>
            </div>
            <ImpactMap
              changedPaths={report.changedPaths}
              unindexedPaths={report.unindexedPaths}
              edges={report.dependencies}
              findings={report.findings.map(({ finding, evidence }) => ({
                id: finding.id,
                filePath: finding.filePath,
                verified: finding.verified,
                component: finding.component,
                impactType: finding.impactType,
                confidence: finding.confidence,
                reason: finding.reason,
                evidence,
              }))}
            />
          </div>
        </section>

        {prImpact && <>
          {report.analysis.reviewDetails?.prDetails && <details className="panel p-5"><summary className="cursor-pointer text-[13px] font-bold text-[var(--t)]">Commit history ({report.analysis.reviewDetails.prDetails.commitCount} total)</summary><div className="mt-3 divide-y divide-[var(--l)]">{report.analysis.reviewDetails.prDetails.commits.map((commit) => <div key={commit.sha} className="py-2"><p className="text-[11px] text-[var(--t)]">{commit.message.split("\n")[0]}</p><p className="mt-1 font-mono text-[10px] text-[var(--m)]">{commit.sha.slice(0, 10)}{commit.author ? ` · ${commit.author}` : ""}</p></div>)}</div>{report.analysis.reviewDetails.prDetails.commitsMayBeTruncated && <p className="mt-2 text-[10px] text-[var(--m)]">Showing the first 200 commits only.</p>}</details>}
          <section className="panel p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--l)] pb-4">
              <div><h3 className="text-[16px] font-bold text-[var(--t)]">Merge readiness</h3><p className="mt-1 text-[12px] text-[var(--m)]">{prImpact.mergeReadiness.summary}</p></div>
              <span className="rounded-md border border-[var(--w)]/40 px-2.5 py-1 font-mono text-[11px] font-bold text-[var(--w)]">{prImpact.mergeReadiness.status}</span>
            </div>
            <p className="mt-4 text-[12px] text-[var(--m)]">{report.analysis.reviewDetails?.github?.filesReturned ?? prImpact.files.length} of {report.analysis.reviewDetails?.github?.totalChangedFiles ?? prImpact.files.length} changed files were listed; {prImpact.sourceFilesCompared} TypeScript/JavaScript source file(s) had both base and head text compared{report.analysis.reviewDetails?.github?.truncatedAt100Files ? ", with the changed-file list capped at 100" : ""}{prImpact.mergeReadiness.complete ? "." : "; evidence is incomplete."}</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              {Object.entries(prImpact.risk.factors).map(([name, factor]) => <div key={name} className="rounded-lg border border-[var(--l)] bg-[var(--g)] p-3"><p className="text-[11px] capitalize text-[var(--m)]">{name.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)}</p><p className="mt-1 font-mono text-[18px] font-bold text-[var(--t)]">{factor.score ?? "—"}<span className="ml-1 text-[10px] font-normal text-[var(--m)]">× {Math.round(factor.weight * 100)}%</span></p><p className="mt-1 text-[10px] leading-4 text-[var(--m)]">{factor.reason}</p></div>)}
            </div>
            <p className="mt-3 text-[10px] text-[var(--m)]">Score is a deterministic review signal, not a probability of production failure. Confidence measures evidence quality, not incident likelihood.</p>
            {(prImpact.mergeReadiness.beforeMerge.length > 0 || prImpact.risk.uncertainty.length > 0) && <div className="mt-4 grid gap-4 md:grid-cols-2">
              {prImpact.mergeReadiness.beforeMerge.length > 0 && <div><h4 className="text-[12px] font-semibold text-[var(--t)]">Before merging, you should</h4><ul className="mt-2 list-disc space-y-1 pl-5 text-[11px] leading-5 text-[var(--m)]">{prImpact.mergeReadiness.beforeMerge.map((item) => <li key={item}>{item}</li>)}</ul></div>}
              {prImpact.risk.uncertainty.length > 0 && <div><h4 className="text-[12px] font-semibold text-[var(--t)]">Evidence gaps</h4><ul className="mt-2 list-disc space-y-1 pl-5 text-[11px] leading-5 text-[var(--m)]">{prImpact.risk.uncertainty.map((item) => <li key={item}>{item}</li>)}</ul></div>}
            </div>}
          </section>

          <section className="panel p-5 sm:p-6">
            <div className="flex items-end justify-between gap-3 border-b border-[var(--l)] pb-4"><div><h3 className="text-[16px] font-bold text-[var(--t)]">Changed files and semantic review</h3><p className="mt-1 text-[12px] text-[var(--m)]">Actual GitHub file status and patch counts. Static findings are hypotheses unless explicitly confirmed by the evidence.</p></div><span className="font-mono text-[11px] text-[var(--m)]">{prImpact.files.length} files</span></div>
            <div className="mt-3 divide-y divide-[var(--l)]">{prImpact.files.map((file) => <details key={file.filename} className="py-3"><summary className="flex cursor-pointer flex-wrap justify-between gap-2 text-[12px]"><span className="break-all font-mono text-[var(--t)]">{file.filename}</span><span className="font-mono text-[10px] text-[var(--m)]">{file.status} · +{file.additions} / −{file.deletions}</span></summary>{file.patch ? <><pre className="mt-3 max-h-80 overflow-auto rounded-lg border border-[var(--l)] bg-[var(--g)] p-3 font-mono text-[10px] leading-5 text-[var(--m)]">{file.patch}</pre>{file.patchTruncated && <p className="mt-1 text-[10px] text-[var(--w)]">Displayed patch was truncated to keep the report bounded.</p>}</> : <p className="mt-3 text-[11px] text-[var(--m)]">GitHub did not provide a unified patch for this file.</p>}</details>)}</div>
          </section>

          <section className="panel p-5 sm:p-6">
            <h3 className="text-[16px] font-bold text-[var(--t)]">Static impact findings</h3>
            {prImpact.findings.length === 0 ? <p className="mt-3 text-[12px] text-[var(--m)]">No semantic compatibility or test coverage findings were identified. This is not proof that the PR is safe.</p> : <div className="mt-3 divide-y divide-[var(--l)]">{prImpact.findings.map((finding) => <details key={finding.id} className="py-3"><summary className="flex cursor-pointer flex-wrap items-center gap-2 text-[12px]"><span className="rounded border border-[var(--l)] px-2 py-0.5 text-[10px] uppercase text-[var(--m)]">{finding.severity}</span><span className="font-semibold text-[var(--t)]">{finding.title}</span><span className="font-mono text-[10px] text-[var(--m)]">{finding.filePath}</span></summary><div className="mt-3 grid gap-3 md:grid-cols-2"><div><p className="text-[11px] leading-5 text-[var(--t)]">{finding.explanation}</p><p className="mt-2 text-[11px] leading-5 text-[var(--m)]"><b className="text-[var(--t)]">Possible consequence:</b> {finding.consequence}</p><p className="mt-2 text-[11px] leading-5 text-[var(--m)]"><b className="text-[var(--t)]">Recommended action:</b> {finding.recommendation}</p></div><div><p className="text-[10px] uppercase text-[var(--m)]">Why am I seeing this?</p><ul className="mt-1 list-disc pl-5 text-[10px] leading-5 text-[var(--m)]">{finding.evidence.map((item) => <li key={item}>{item}</li>)}</ul>{finding.impactedConsumers.length > 0 && <div className="mt-3"><p className="text-[10px] uppercase text-[var(--m)]">Indexed consumers</p>{finding.impactedConsumers.map((consumer) => <p key={consumer.path} className="mt-1 font-mono text-[10px] text-[var(--t)]">{consumer.path} · {consumer.evidence}</p>)}</div>}<p className="mt-3 text-[10px] text-[var(--m)]">Analysis confidence: {finding.confidence}. A structural relationship does not prove a runtime defect.</p></div></div></details>)}</div>}
            {prImpact.testRecommendations.length > 0 && <div className="mt-4 border-t border-[var(--l)] pt-4"><h4 className="text-[12px] font-semibold text-[var(--t)]">Tests recommended (not executed)</h4>{prImpact.testRecommendations.map((test) => <p key={test.path} className="mt-2 font-mono text-[11px] text-[var(--a)]">{test.path}<span className="ml-2 font-sans text-[10px] text-[var(--m)]">{test.reason}</span></p>)}</div>}
          </section>
        </>}

        {((report.analysis.reviewDetails?.strengths?.length ?? 0) > 0 || (report.analysis.reviewDetails?.limitations?.length ?? 0) > 0) && (
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {report.analysis.reviewDetails?.strengths && report.analysis.reviewDetails.strengths.length > 0 && (
              <div className="panel p-5"><h3 className="text-[14px] font-bold text-[var(--t)]">Signals considered</h3><ul className="mt-3 list-disc space-y-1.5 pl-5 text-[12px] leading-5 text-[var(--m)]">{report.analysis.reviewDetails.strengths.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul></div>
            )}
            {report.analysis.reviewDetails?.limitations && report.analysis.reviewDetails.limitations.length > 0 && (
              <div className="panel p-5"><h3 className="text-[14px] font-bold text-[var(--t)]">Limitations</h3><ul className="mt-3 list-disc space-y-1.5 pl-5 text-[12px] leading-5 text-[var(--m)]">{report.analysis.reviewDetails.limitations.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul></div>
            )}
          </section>
        )}

        <section className="panel p-5 sm:p-6">
          <div className="flex items-end justify-between gap-3 border-b border-[var(--l)] pb-4">
            <div><h3 className="text-[16px] font-bold text-[var(--t)]">Findings</h3><p className="mt-1 text-[12px] text-[var(--m)]">Claims and evidence returned for this saved analysis.</p></div>
            <span className="font-mono text-[11px] text-[var(--m)]">{report.findings.length} total</span>
          </div>

          {findings.length === 0 ? (
            <div className="py-10 text-center text-[13px] text-[var(--m)]">No findings were returned for this analysis.</div>
          ) : (
            <div className="divide-y divide-[var(--l)]">
              {findings.map(({ finding, evidence }, index) => {
                const sourcePath = evidence[0]?.document?.path ?? finding.filePath;
                const startLine = evidence[0]?.chunk?.startLine;
                const endLine = evidence[0]?.chunk?.endLine;
                const branch = report.repository?.defaultBranch;
                const sourceUrl = report.repository && sourcePath && branch
                  ? `https://github.com/${report.repository.owner}/${report.repository.name}/blob/${branch}/${sourcePath}${startLine !== null && startLine !== undefined ? `#L${startLine}${endLine !== null && endLine !== undefined && endLine !== startLine ? `-L${endLine}` : ""}` : ""}`
                  : null;
                return (
                  <details key={finding.id} className="group py-4" open={index === 0}>
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-4 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--a)]">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${finding.verified ? "border-[var(--ok)]/40 text-[var(--ok)]" : "border-[var(--w)]/40 text-[var(--w)]"}`}>{finding.verified ? "Grounded" : "Unverified"}</span>
                          {finding.impactType && <span className="text-[10px] text-[var(--m)]">{finding.impactType}</span>}
                          {typeof finding.confidence === "number" && <span className="font-mono text-[10px] text-[var(--m)]">{Math.round(finding.confidence * 100)}% confidence</span>}
                        </div>
                        <h4 className="mt-2 text-[14px] font-bold text-[var(--t)]">{finding.component || sourcePath || `Finding ${index + 1}`}</h4>
                        {finding.reason && <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-[var(--m)]">{finding.reason}</p>}
                      </div>
                      <span className="shrink-0 text-[11px] text-[var(--a)] group-open:hidden">Details +</span>
                      <span className="hidden shrink-0 text-[11px] text-[var(--a)] group-open:inline">Close −</span>
                    </summary>

                    <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
                      <div>
                        {finding.filePath && <p className="break-all font-mono text-[11px] text-[var(--m)]">Affected file: {finding.filePath}</p>}
                        {finding.reason && <p className="mt-2 text-[12px] leading-6 text-[var(--t)]">{finding.reason}</p>}
                      </div>
                      <div className="min-w-0 overflow-hidden rounded-lg border border-[var(--l)] bg-[var(--g)]">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--l)] px-3 py-2 font-mono text-[10px] text-[var(--m)]">
                          <span className="break-all">{sourcePath || "Source reference unavailable"}{startLine != null ? ` · line ${startLine}${endLine != null && endLine !== startLine ? `-${endLine}` : ""}` : ""}</span>
                          {sourceUrl && <a href={sourceUrl} target="_blank" rel="noreferrer" className="shrink-0 text-[var(--a)] hover:underline">View source</a>}
                        </div>
                        {evidence.length === 0 ? (
                          <p className="p-3 text-[12px] text-[var(--m)]">No stored evidence is attached to this finding.</p>
                        ) : evidence.map((item, evidenceIndex) => (
                          <div key={`${finding.id}-${evidenceIndex}`} className="border-b border-[var(--l)] last:border-0">
                            {evidence.length > 1 && <p className="px-3 pt-2 font-mono text-[10px] text-[var(--m)]">Evidence {evidenceIndex + 1}{typeof item.relevanceScore === "number" ? ` · relevance ${item.relevanceScore.toFixed(2)}` : ""}</p>}
                            <pre className="max-h-72 overflow-auto whitespace-pre-wrap p-3 font-mono text-[11px] leading-5 text-[var(--t)]">{item.snippet || "No stored source snippet is available."}</pre>
                          </div>
                        ))}
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
