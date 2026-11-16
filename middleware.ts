import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get("impactgraph_session")?.value);
  const pathname = request.nextUrl.pathname;
  const protectedPage = pathname === "/dashboard" || pathname === "/analyze" || pathname.startsWith("/analyses") || pathname.startsWith("/eval") || pathname.startsWith("/profile");
  const protectedApi = pathname.startsWith("/api/") && !pathname.startsWith("/api/auth/");
  if (!hasSession && (protectedPage || protectedApi)) {
    if (protectedApi) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("auth", "required");
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/dashboard", "/analyze", "/analyses/:path*", "/eval/:path*", "/profile/:path*", "/api/:path*"] };
