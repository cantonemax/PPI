import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { isServicePaused } from "@/lib/service-phase";

const protectedPaths = ["/dashboard", "/users"];

export async function middleware(request: NextRequest) {
  const isProtected = protectedPaths.some((path) => request.nextUrl.pathname.startsWith(path));
  if (!isProtected) return NextResponse.next();

  const token = request.cookies.get("ppi_session")?.value;
  const secret = process.env.AUTH_SECRET;
  if (!token || !secret) return NextResponse.redirect(new URL("/login", request.url));

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    if (!payload.sub || typeof payload.companyId !== "string") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  } catch {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isServicePaused(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard/paused";
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = { matcher: ["/dashboard/:path*", "/users/:path*"] };
