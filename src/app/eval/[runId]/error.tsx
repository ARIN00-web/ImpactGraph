"use client";

import Link from "next/link";
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
            Evaluation / Benchmark Error
          </p>
          <h1 className="text-xl font-bold text-[var(--t)] mb-3">
            Evaluation report failed to load
          </h1>
          <p className="text-sm text-[var(--m)] mb-6 leading-relaxed">
            The benchmark run data could not be retrieved. Check that the benchmark run exists or retry.
          </p>
          <div className="flex justify-center gap-3">
            <button onClick={reset} className="btn-primary">
              Retry
            </button>
            <Link href="/eval" className="btn-secondary">
              Back to Evaluation
            </Link>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
