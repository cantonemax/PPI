import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { isServicePaused } from "@/lib/service-phase";

const protectedPaths = ["/dashboard", "/users"];

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/platform") && request.nextUrl.pathname !== "/platform/login") {
    const platformToken = request.cookies.get("ppi_platform")?.value ?? request.cookies.get("ppi_session")?.value;
    const secret = process.env.AUTH_SECRET;
    if (!platformToken || !secret) return NextResponse.redirect(new URL("/platform/login", request.url));
    try {
      const { payload } = await jwtVerify(platformToken, new TextEncoder().encode(secret));
      if (payload.kind !== "platform") return NextResponse.redirect(new URL("/platform/login", request.url));
      const response = NextResponse.next();
      if (!request.cookies.get("ppi_platform")?.value) {
        response.cookies.set("ppi_platform", platformToken, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 7 });
      }
      return response;
    } catch {
      return NextResponse.redirect(new URL("/platform/login", request.url));
    }
  }

  const isProtected = protectedPaths.some((path) => request.nextUrl.pathname.startsWith(path));
  if (!isProtected) return NextResponse.next();

  const token = request.cookies.get("ppi_session")?.value;
  const secret = process.env.AUTH_SECRET;
  if (!token || !secret) return NextResponse.redirect(new URL("/login", request.url));

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    if (!payload.sub || payload.kind === "platform" || typeof payload.companyId !== "string" || payload.companyId === "") {
      const response = NextResponse.redirect(new URL("/login", request.url));
      if (payload.kind === "platform" && !request.cookies.get("ppi_platform")?.value) {
        response.cookies.set("ppi_platform", token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 7 });
      }
      if (payload.kind === "platform") response.cookies.delete("ppi_session");
      return response;
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

export const config = { matcher: ["/dashboard/:path*", "/users/:path*", "/platform", "/platform/:path*"] };
