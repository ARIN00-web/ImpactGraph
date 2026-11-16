import { AppShell } from "@/components/app-shell";

export default function Loading() {
  return (
    <AppShell>
      <main className="blast-container animate-pulse">
        {/* Title row */}
        <div className="mb-6 flex flex-col gap-2">
          <div className="h-4 w-32 rounded-[6px] bg-[var(--q)]" />
          <div className="h-8 w-72 rounded-[8px] bg-[var(--q)]" />
          <div className="h-4 w-96 rounded-[6px] bg-[var(--q)]" />
        </div>

        {/* 4 metric tiles (3 cols each) */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="panel p-5">
              <div className="h-3 w-20 rounded-[6px] bg-[var(--q)]" />
              <div className="mt-2 h-9 w-24 rounded-[8px] bg-[var(--q)]" />
              <div className="mt-2 h-3 w-32 rounded-[6px] bg-[var(--q)]" />
            </div>
          ))}
        </div>

        {/* 12-col cases */}
        <div className="panel p-5">
          <div className="h-4 w-40 rounded-[6px] bg-[var(--q)] mb-4" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 w-full rounded-[8px] bg-[var(--q)]" />
            ))}
          </div>
        </div>
      </main>
    </AppShell>
  );
}
