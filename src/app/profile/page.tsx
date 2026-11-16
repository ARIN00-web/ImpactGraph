import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { repositories } from "@/db/schema";
import { AppShell } from "@/components/app-shell";
import { LogoutButton } from "@/components/logout-button";
import { getCurrentUser } from "@/lib/auth";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/?auth=required");

  const [repositoryCount] = await db
    .select({ total: count() })
    .from(repositories)
    .where(eq(repositories.userId, user.id));

  const initial = user.name.trim().charAt(0).toUpperCase() || "U";
  const githubConnected = Boolean(process.env.GITHUB_TOKEN);

  return (
    <AppShell initialUser={user}>
      <div className="blast-container">
        <div className="pb-8">
          <h1 className="page-title">Profile</h1>
          <p className="page-sub">Account details and repository access settings.</p>
        </div>

        <div className="grid grid-cols-12 gap-4">
          <section className="col-span-12 md:col-span-6 panel p-6 flex flex-col justify-between">
            <div>
              <h2 className="text-[17px] font-bold text-[var(--t)] mb-4">Account</h2>
              <div className="flex items-center gap-4">
                {user.avatarUrl ? (
                  <Image
                    src={user.avatarUrl}
                    alt={user.name}
                    width={56}
                    height={56}
                    unoptimized
                    className="w-14 h-14 rounded-full object-cover border border-[var(--l)]"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-[var(--a)] text-[var(--a-text)] text-[20px] font-extrabold flex items-center justify-center shrink-0">
                    {initial}
                  </div>
                )}
                <div>
                  <p className="text-[17px] font-bold text-[var(--t)]">{user.name}</p>
                  <p className="text-[14px] text-[var(--m)]">{user.email}</p>
                  <span className="inline-block mt-1 text-[12px] text-[var(--m)] bg-[var(--q)] px-2 py-0.5 rounded-[6px] border border-[var(--l)]">
                    Signed in with Google
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-[var(--l)] flex items-center gap-3">
              <LogoutButton />
            </div>
          </section>

          <section className="col-span-12 md:col-span-6 panel p-6">
            <h2 className="text-[17px] font-bold text-[var(--t)] mb-4">GitHub access</h2>
            <p className="mb-3 text-[13px] leading-6 text-[var(--m)]">
              ImpactGraph uses GitHub&apos;s REST API to read public repositories and pull request changes. A server token is optional and raises the API rate limit.
            </p>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-[var(--l)]">
                <span className="text-[14px] text-[var(--m)]">Server token</span>
                <span className={`text-[14px] font-bold ${githubConnected ? "text-[var(--ok)]" : "text-[var(--m)]"}`}>
                  {githubConnected ? "Configured" : "Optional"}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-[14px] text-[var(--m)]">Repositories connected</span>
                <span className="font-mono text-[14px] text-[var(--t)] tabular-nums">
                  {Number(repositoryCount.total)}
                </span>
              </div>
            </div>
          </section>

          <section className="col-span-12 panel p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[17px] font-bold text-[var(--t)]">Repository workspace</h2>
              <Link href="/dashboard" className="btn-secondary text-[13px] py-1.5 px-3">
                Manage repositories
              </Link>
            </div>
            <p className="text-[14px] text-[var(--m)]">
              ImpactGraph indexes public repositories, extracts AST structural chunks, generates vector embeddings, and builds the dependency blast map.
            </p>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
