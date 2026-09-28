import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.join(process.cwd(), "storage");

export function objectKey(companyId: string, kind: "drawings" | "technical-documents" | "certifications" | "brand"): string {
  return path.posix.join(companyId, kind, randomUUID());
}

function absolute(key: string): string {
  const full = path.resolve(root, key);
  if (!full.startsWith(path.resolve(root) + path.sep)) {
    throw new Error("invalid storage key");
  }
  return full;
}

export async function writeObject(key: string, bytes: Uint8Array): Promise<void> {
  const full = absolute(key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, bytes);
}

export async function readObject(key: string): Promise<Buffer> {
  return readFile(absolute(key));
}

export async function removeObject(key: string): Promise<void> {
  await rm(absolute(key), { force: true });
}
