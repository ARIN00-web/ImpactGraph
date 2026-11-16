import { NextResponse } from "next/server";
import { clearOAuthStateCookie, createSession, exchangeGoogleCode, getAuthOrigin, getOAuthStateCookie, isValidOAuthState, upsertGoogleUser } from "@/lib/auth";

function getFailureReason(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return /database|postgres|drizzle|failed query|enotfound|econnrefused|etimedout|connect timeout/i.test(message)
    ? "database"
    : "failed";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const expected = await getOAuthStateCookie();
  await clearOAuthStateCookie();
  if (error || !code || !state || !expected || !isValidOAuthState(state, expected)) return NextResponse.redirect(`${getAuthOrigin()}/?auth=failed`);
  try {
    const profile = await exchangeGoogleCode(code);
    const user = await upsertGoogleUser(profile);
    await createSession(user.id);
    return NextResponse.redirect(`${getAuthOrigin()}/dashboard`);
  } catch (error) {
    const reason = getFailureReason(error);
    console.error("Google OAuth callback failed:", reason, error instanceof Error ? error.name : "unknown error");
    return NextResponse.redirect(`${getAuthOrigin()}/?auth=${reason}`);
  }
}
