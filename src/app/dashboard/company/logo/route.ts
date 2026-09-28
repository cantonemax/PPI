import { NextResponse } from "next/server";
import { requireMember } from "@/lib/access";
import { readObject } from "@/lib/object-storage";

function mediaType(key: string) {
  const lower = key.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/png";
}

export async function GET(request: Request) {
  const { user } = await requireMember();
  if (!user.company.logoKey) return NextResponse.redirect(new URL("/brand/ditec-logo.png", request.url));
  const bytes = await readObject(user.company.logoKey);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": mediaType(user.company.logoKey),
      "Cache-Control": "private, no-store",
    },
  });
}
