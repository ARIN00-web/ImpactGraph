"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  ChartNoAxesCombined,
  ChevronDown,
  FileClock,
  GitPullRequest,
  LayoutDashboard,
  LogOut,
  UserRound,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

type User = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
};

let lastKnownUser: User | null = null;

const navItems = [
  { href: "/dashboard", label: "Repositories", icon: LayoutDashboard },
  { href: "/analyze", label: "New analysis", icon: GitPullRequest },
  { href: "/analyses", label: "Reports", icon: FileClock },
  { href: "/eval", label: "Evaluation", icon: ChartNoAxesCombined },
];

function isActivePath(pathname: string, href: string) {
  return href === "/dashboard"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({
  children,
  initialUser,
}: {
  children: React.ReactNode;
  initialUser?: User | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(
    () => initialUser ?? lastKnownUser
  );
  const [authLoading, setAuthLoading] = useState(
    () => initialUser === undefined && lastKnownUser === null
  );
  const [authUnavailable, setAuthUnavailable] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialUser) {
      lastKnownUser = initialUser;
      return;
    }

    fetch("/api/auth/me")
      .then(async (res) => {
        if (!res.ok) {
          setAuthUnavailable(true);
          return null;
        }
        try {
          return await res.json();
        } catch {
          setAuthUnavailable(true);
          return null;
        }
      })
      .then((data) => {
        if (data && "user" in data) {
          lastKnownUser = data.user;
          setUser(data.user);
          setAuthUnavailable(false);
        }
      })
      .catch(() => setAuthUnavailable(true))
      .finally(() => setAuthLoading(false));
  }, [initialUser]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // A full navigation below also clears any stale in-memory account state.
    }
    lastKnownUser = null;
    router.replace("/");
  }

  const pageTitle =
    navItems.find((item) => isActivePath(pathname, item.href))?.label ??
    (pathname.startsWith("/profile")
      ? "Profile"
      : pathname.startsWith("/analyses/")
        ? "Analysis report"
        : "ImpactGraph");
  const visibleUser = initialUser ?? user;
  const initial = visibleUser?.name?.trim().charAt(0).toUpperCase() || "U";
  const displayName = visibleUser?.name?.trim() || "Account";

  const userMenu = authLoading ? (
    <div
      className="h-10 w-24 animate-pulse rounded-lg border border-[var(--l)] bg-[var(--q)]"
      aria-label="Loading account"
    />
  ) : visibleUser ? (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        className="flex min-h-10 items-center gap-2 rounded-lg border border-[var(--l)] bg-[var(--p)] px-2.5 text-left transition hover:bg-[var(--q)]"
      >
        {visibleUser.avatarUrl ? (
          <Image src={visibleUser.avatarUrl} alt="" width={28} height={28} unoptimized className="h-7 w-7 rounded-full object-cover" />
        ) : (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--a)] text-[12px] font-bold text-[var(--a-text)]">
            {initial}
          </span>
        )}
        <span className="hidden max-w-32 truncate text-[13px] font-semibold text-[var(--t)] sm:block">
          {displayName}
        </span>
        <ChevronDown size={14} className="text-[var(--m)]" aria-hidden="true" />
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-[var(--l)] bg-[var(--p)] p-2 shadow-2xl"
        >
          <div className="border-b border-[var(--l)] px-3 py-2.5">
            <p className="truncate text-[13px] font-bold text-[var(--t)]">{displayName}</p>
            <p className="truncate text-[12px] text-[var(--m)]">{visibleUser.email}</p>
          </div>
          <Link
            href="/profile"
            role="menuitem"
            onClick={() => setMenuOpen(false)}
            className="mt-1 flex min-h-10 items-center gap-2 rounded-lg px-3 text-[13px] text-[var(--t)] no-underline hover:bg-[var(--q)]"
          >
            <UserRound size={15} aria-hidden="true" /> Profile
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-[13px] text-[var(--m)] hover:bg-[var(--q)] hover:text-[var(--t)]"
          >
            <LogOut size={15} aria-hidden="true" /> Log out
          </button>
        </div>
      )}
    </div>
  ) : authUnavailable ? (
    <Link href="/profile" className="flex min-h-10 items-center rounded-lg border border-[var(--l)] bg-[var(--p)] px-3 text-[13px] font-semibold text-[var(--t)] no-underline hover:bg-[var(--q)]">
      Account
    </Link>
  ) : (
    <a href="/api/auth/google" className="btn-primary min-h-10 px-3 text-[13px]">
      Sign in
    </a>
  );

  return (
    <div className="min-h-screen bg-[var(--g)] text-[var(--t)] md:grid md:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="hidden border-r border-[var(--l)] bg-[var(--p)] md:sticky md:top-0 md:flex md:h-screen md:flex-col">
        <Link href="/dashboard" className="flex h-16 items-center border-b border-[var(--l)] px-6 text-[17px] font-extrabold tracking-tight text-[var(--t)] no-underline">
          ImpactGraph<span className="text-[var(--a)]">.</span>
        </Link>
        <nav aria-label="Main navigation" className="flex-1 space-y-1 px-3 py-5">
          <p className="mb-3 px-3 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--m)]">Workspace</p>
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = isActivePath(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-[13px] font-semibold no-underline transition ${
                  active
                    ? "bg-[var(--q)] text-[var(--t)] ring-1 ring-inset ring-[var(--l)]"
                    : "text-[var(--m)] hover:bg-[var(--q)] hover:text-[var(--t)]"
                }`}
              >
                <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-[var(--l)] p-4">
          <div className="flex items-center gap-3 rounded-lg bg-[var(--q)] p-3">
            {visibleUser?.avatarUrl ? (
              <Image src={visibleUser.avatarUrl} alt="" width={36} height={36} unoptimized className="h-9 w-9 rounded-full object-cover" />
            ) : (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--a)] text-[13px] font-bold text-[var(--a-text)]">
                {initial}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-[12px] font-bold text-[var(--t)]">{displayName}</p>
              <p className="truncate text-[11px] text-[var(--m)]">{visibleUser?.email ?? "Google account"}</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-40 border-b border-[var(--l)] bg-[var(--p)]/95 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-9">
            <div className="flex min-w-0 items-center gap-4">
              <Link href="/dashboard" className="text-[15px] font-extrabold tracking-tight text-[var(--t)] no-underline md:hidden">
                ImpactGraph<span className="text-[var(--a)]">.</span>
              </Link>
              <span className="hidden h-5 w-px bg-[var(--l)] md:block" />
              <h1 className="truncate text-[14px] font-bold text-[var(--t)]">{pageTitle}</h1>
            </div>
            <div className="flex shrink-0 items-center gap-2.5 sm:gap-3">
              <ThemeToggle />
              {userMenu}
            </div>
          </div>
          <nav aria-label="Main navigation" className="flex gap-1 overflow-x-auto border-t border-[var(--l)] px-3 py-2 md:hidden">
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = isActivePath(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-[12px] font-semibold no-underline ${
                    active ? "bg-[var(--q)] text-[var(--t)]" : "text-[var(--m)] hover:bg-[var(--q)]"
                  }`}
                >
                  <Icon size={15} aria-hidden="true" /> {label}
                </Link>
              );
            })}
          </nav>
        </header>
        <main className="min-h-[calc(100vh-64px)] w-full">{children}</main>
      </div>
    </div>
  );
}
