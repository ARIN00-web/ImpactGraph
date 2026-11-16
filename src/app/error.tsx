"use client";

import { AppShell } from "@/components/app-shell";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <AppShell>
      <main className="blast-container min-h-[70vh] flex items-center justify-center">
        <div className="panel max-w-lg w-full p-8 text-center border border-[var(--l)]">
          <p className="font-mono text-xs uppercase tracking-wider text-[var(--r)] mb-2">
            ImpactGraph / Request Failed
          </p>
          <h1 className="text-xl font-bold text-[var(--t)] mb-3">
            The report could not be completed
          </h1>
          <p className="text-sm text-[var(--m)] mb-6 leading-relaxed">
            Retry the request. If this persists, verify repository indexing, GitHub rate limits, or model quota.
          </p>
          <div className="flex justify-center gap-3">
            <button onClick={reset} className="btn-primary">
              Try again
            </button>
            <a href="/dashboard" className="btn-secondary">
              Go to Repositories
            </a>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
