import { redirect } from "next/navigation";
import { RepositoryOnboarding } from "@/components/repository-onboarding";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/?auth=required");

  return (
    <AppShell initialUser={user}>
      <div className="blast-container">
        <RepositoryOnboarding initialUser={user} />
      </div>
    </AppShell>
  );
}
