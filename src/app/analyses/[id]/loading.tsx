import { AppShell } from "@/components/app-shell";

export default function ReportLoading() {
  return (
    <AppShell>
      <div className="blast-container space-y-6 animate-pulse">
        <div className="space-y-2">
          <div className="h-4 bg-[var(--p)] rounded w-64" />
          <div className="h-8 bg-[var(--p)] rounded w-96" />
        </div>

        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-4 panel h-64 p-6 space-y-4">
            <div className="h-4 bg-[var(--q)] rounded w-24" />
            <div className="h-16 bg-[var(--q)] rounded w-32" />
            <div className="h-2 bg-[var(--q)] rounded-full w-full" />
          </div>

          <div className="col-span-12 lg:col-span-8 panel h-64 p-6 space-y-4">
            <div className="h-5 bg-[var(--q)] rounded w-36" />
            <div className="h-4 bg-[var(--q)] rounded w-60" />
            <div className="h-32 bg-[var(--q)] rounded-[8px]" />
          </div>

          <div className="col-span-12 panel p-6 space-y-6">
            <div className="h-5 bg-[var(--q)] rounded w-28" />
            <div className="h-24 bg-[var(--q)] rounded-[8px]" />
            <div className="h-24 bg-[var(--q)] rounded-[8px]" />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
