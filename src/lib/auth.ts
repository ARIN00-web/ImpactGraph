import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";

const SESSION_COOKIE = "impactgraph_session";
const STATE_COOKIE = "impactgraph_oauth_state";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function signState(value: string) {
  return createHmac("sha256", required("GOOGLE_CLIENT_SECRET")).update(value).digest("base64url");
}

export function getAuthOrigin() {
  return process.env.APP_URL ?? "http://localhost:3000";
}

export function getGoogleCallbackUrl() {
  return `${getAuthOrigin()}/api/auth/google/callback`;
}

export function createOAuthState() {
  const nonce = randomBytes(32).toString("base64url");
  return `${nonce}.${signState(nonce)}`;
}

export function isValidOAuthState(state: string, expected: string) {
  const [nonce, signature] = state.split(".");
  if (!nonce || !signature || state !== expected) return false;
  const actual = Buffer.from(signState(nonce));
  const received = Buffer.from(signature);
  return actual.length === received.length && timingSafeEqual(actual, received);
}

export function googleAuthUrl(state: string) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", required("GOOGLE_CLIENT_ID"));
  url.searchParams.set("redirect_uri", getGoogleCallbackUrl());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export async function setOAuthStateCookie(state: string) {
  (await cookies()).set(STATE_COOKIE, state, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 600,
  });
}

export async function clearOAuthStateCookie() {
  (await cookies()).delete(STATE_COOKIE);
}

export async function getOAuthStateCookie() {
  return (await cookies()).get(STATE_COOKIE)?.value;
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  await db.insert(sessions).values({ userId, tokenHash: hash(token), expiresAt: new Date(Date.now() + SESSION_TTL_MS) });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, hash(token)));
  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await db.select({ user: users }).from(sessions).innerJoin(users, eq(users.id, sessions.userId)).where(
    eq(sessions.tokenHash, hash(token)),
  ).limit(1);
  if (!row || row.user === null) return null;
  const [session] = await db.select({ expiresAt: sessions.expiresAt }).from(sessions).where(eq(sessions.tokenHash, hash(token))).limit(1);
  if (!session || session.expiresAt <= new Date()) {
    await db.delete(sessions).where(eq(sessions.tokenHash, hash(token)));
    return null;
  }
  return row.user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

export async function upsertGoogleUser(profile: { sub: string; email: string; name: string; picture?: string }) {
  const [existing] = await db.select().from(users).where(eq(users.googleSubject, profile.sub)).limit(1);
  if (existing) {
    const [updated] = await db.update(users).set({ email: profile.email, name: profile.name, avatarUrl: profile.picture ?? null, updatedAt: new Date() }).where(eq(users.id, existing.id)).returning();
    return updated;
  }
  const [created] = await db.insert(users).values({ googleSubject: profile.sub, email: profile.email, name: profile.name, avatarUrl: profile.picture ?? null }).returning();
  return created;
}

export async function exchangeGoogleCode(code: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: required("GOOGLE_CLIENT_ID"), client_secret: required("GOOGLE_CLIENT_SECRET"), redirect_uri: getGoogleCallbackUrl(), grant_type: "authorization_code" }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Google token exchange failed");
  const token = await response.json() as { id_token?: string };
  if (!token.id_token) throw new Error("Google identity token missing");
  const profileResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token.id_token)}`, { cache: "no-store" });
  if (!profileResponse.ok) throw new Error("Google identity validation failed");
  const profile = await profileResponse.json() as { sub?: string; email?: string; email_verified?: string | boolean; name?: string; picture?: string; aud?: string };
  const emailVerified = profile.email_verified === true || profile.email_verified === "true";
  if (profile.aud !== process.env.GOOGLE_CLIENT_ID || !profile.sub || !profile.email || !emailVerified || !profile.name) throw new Error("Invalid Google identity");
  return profile as { sub: string; email: string; name: string; picture?: string };
}
