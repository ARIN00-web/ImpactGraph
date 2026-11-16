import { NextResponse } from "next/server";
import { createOAuthState, googleAuthUrl, setOAuthStateCookie } from "@/lib/auth";

export async function GET() {
  try {
    const state = createOAuthState();
    await setOAuthStateCookie(state);
    return NextResponse.redirect(googleAuthUrl(state));
  } catch {
    return NextResponse.json({ error: "Google authentication is not configured" }, { status: 503 });
  }
}
