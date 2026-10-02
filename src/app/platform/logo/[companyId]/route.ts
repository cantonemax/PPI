import { NextResponse } from "next/server";
import { readObject } from "@/lib/object-storage";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

function mediaType(key: string) {
  const lower = key.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/png";
}

export async function GET(request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const session = await readSession();
  if (!session || session.kind !== "platform") return NextResponse.redirect(new URL("/platform/login", request.url));
  const { companyId } = await params;
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { logoKey: true } });
  if (!company?.logoKey) return new NextResponse(null, { status: 404 });
  const bytes = await readObject(company.logoKey);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": mediaType(company.logoKey),
      "Cache-Control": "private, no-store",
    },
  });
}
