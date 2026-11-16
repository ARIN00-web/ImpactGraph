"use client";

import { useEffect, useState } from "react";

type User = { name: string; email: string; avatarUrl: string | null };

export function AuthControl() {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    fetch("/api/auth/me")
      .then((response) => response.json())
      .then((data) => setUser(data.user))
      .catch(() => undefined);
  }, []);

  if (!user) {
    return (
      <a href="/api/auth/google" className="btn-primary text-xs py-1.5 px-3">
        Sign in with Google
      </a>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <a href="/dashboard" className="btn-secondary text-xs py-1.5 px-3 hidden sm:inline-flex">
        Dashboard
      </a>
      <span className="hidden text-sm text-[var(--m)] md:inline">{user.name}</span>
      <button
        onClick={() =>
          fetch("/api/auth/logout", { method: "POST" }).then(() => window.location.reload())
        }
        className="btn-secondary text-xs py-1.5 px-3"
      >
        Log out
      </button>
    </div>
  );
}
