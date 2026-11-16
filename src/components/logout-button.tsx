"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    router.replace("/");
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="btn-secondary text-[13px] py-1.5 px-3"
    >
      Log out
    </button>
  );
}
