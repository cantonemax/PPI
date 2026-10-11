import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import "./next-mocks";

const g = globalThis as typeof globalThis & {
  __ppiPg?: { stop: () => Promise<void> };
  __ppiPgReady?: Promise<void>;
};

const port = 55436;
process.env.AUTH_SECRET = "qa-secret-qa-secret-qa-secret-qa";
process.env.APP_URL = "http://localhost:3002";
process.env.NODE_ENV = "test";

const databaseDir = path.join(os.tmpdir(), "ppi-qa", "sprint7c");

async function startPg() {
  const { default: EmbeddedPostgres } = await import("embedded-postgres");
  if (fs.existsSync(databaseDir)) {
    fs.rmSync(databaseDir, { recursive: true, force: true });
  }
  const pg = new EmbeddedPostgres({
    databaseDir,
    user: "postgres",
    password: "postgres",
    port,
    persistent: false,
    onLog: () => undefined,
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("ppi");
  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${port}/ppi`;
  await new Promise<void>((done, reject) => {
    const child = spawn("npx", ["prisma", "migrate", "deploy"], {
      cwd: process.cwd(),
      shell: true,
      env: process.env,
    });
    child.on("exit", (code) =>
      code === 0 ? done() : reject(new Error(`migrate ${code}`)),
    );
  });
  g.__ppiPg = pg;
}

if (!g.__ppiPgReady) {
  g.__ppiPgReady = startPg();
}
await g.__ppiPgReady;
