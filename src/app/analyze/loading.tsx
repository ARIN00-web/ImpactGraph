import { AppShell } from "@/components/app-shell";

export default function AnalyzeLoading() {
  return (
    <AppShell>
      <div className="blast-container">
        <div className="pb-8 space-y-2 animate-pulse">
          <div className="h-8 bg-[var(--p)] rounded-[8px] w-56" />
          <div className="h-4 bg-[var(--p)] rounded-[8px] w-80" />
        </div>

        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-4 panel p-5 h-[480px] animate-pulse space-y-4">
            <div className="h-9 bg-[var(--q)] rounded-[8px]" />
            <div className="h-20 bg-[var(--q)] rounded-[8px]" />
            <div className="h-20 bg-[var(--q)] rounded-[8px]" />
          </div>

          <div className="col-span-12 lg:col-span-4 panel p-6 h-[480px] animate-pulse space-y-4">
            <div className="h-6 bg-[var(--q)] rounded w-3/4" />
            <div className="h-4 bg-[var(--q)] rounded w-1/2" />
            <div className="h-32 bg-[var(--q)] rounded-[8px]" />
            <div className="h-10 bg-[var(--q)] rounded-[8px] mt-auto" />
          </div>

          <div className="col-span-12 lg:col-span-4 panel p-6 h-[480px] animate-pulse space-y-4">
            <div className="h-6 bg-[var(--q)] rounded w-1/2" />
            <div className="space-y-3 pt-4">
              <div className="h-3 bg-[var(--q)] rounded" />
              <div className="h-3 bg-[var(--q)] rounded" />
              <div className="h-3 bg-[var(--q)] rounded" />
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
