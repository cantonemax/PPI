import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const cookieName = "ppi_session";

export type SessionPayload = {
  sub: string;
  companyId: string;
  email: string;
  kind?: "member" | "platform";
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

export async function readSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub || typeof payload.companyId !== "string" || typeof payload.email !== "string") {
      return null;
    }
    return {
      sub: payload.sub,
      companyId: payload.companyId,
      email: payload.email,
      kind: payload.kind === "platform" ? "platform" : "member",
    };
  } catch {
    return null;
  }
}

export async function writeSessionCookie(token: string): Promise<void> {
  (await cookies()).set(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(cookieName);
}
