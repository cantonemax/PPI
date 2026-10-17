import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { PlatformRole } from "@/lib/platform-access";

const cookieName = "ppi_session";
const platformCookieName = "ppi_platform";

export type SessionPayload = {
  sub: string;
  companyId: string;
  email: string;
  kind?: "member" | "platform";
  platformRole?: PlatformRole;
};

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET;
  if (!value) {
    throw new Error("AUTH_SECRET is required");
  }
  return new TextEncoder().encode(value);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
}

async function readCookie(name: string): Promise<SessionPayload | null> {
  const token = (await cookies()).get(name)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub || typeof payload.companyId !== "string" || typeof payload.email !== "string") {
      return null;
    }
    const kind = payload.kind === "platform" ? "platform" : "member";
    const role = payload.platformRole === "PLATFORM_ADMIN" || payload.platformRole === "READ_ONLY" || payload.platformRole === "SUPER_ADMIN" ? payload.platformRole : undefined;
    if (kind === "platform" && !role) return null;
    return {
      sub: payload.sub,
      companyId: payload.companyId,
      email: payload.email,
      kind,
      platformRole: kind === "platform" ? role : undefined,
    };
  } catch {
    return null;
  }
}

export async function readSession(): Promise<SessionPayload | null> {
  const session = await readCookie(cookieName);
  if (!session || session.kind === "platform") return null;
  return session;
}

export async function readPlatformSession(): Promise<SessionPayload | null> {
  const session = await readCookie(platformCookieName);
  if (session?.kind === "platform") return session;
  const legacy = await readCookie(cookieName);
  return legacy?.kind === "platform" ? legacy : null;
}

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
};

export async function writeSessionCookie(token: string): Promise<void> {
  (await cookies()).set(cookieName, token, cookieOptions);
}

export async function writePlatformCookie(token: string): Promise<void> {
  (await cookies()).set(platformCookieName, token, cookieOptions);
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(cookieName);
}

export async function clearPlatformCookie(): Promise<void> {
  (await cookies()).delete(platformCookieName);
}
