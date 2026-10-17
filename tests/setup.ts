import { spawn } from "node:child_process";
import fs from "node:fs";
import "./next-mocks";

const g = globalThis as typeof globalThis & {
  __ppiPg?: { stop: () => Promise<void> };
  __ppiPgReady?: Promise<void>;
};

const port = 55436;
process.env.AUTH_SECRET = "qa-secret-qa-secret-qa-secret-qa";
process.env.APP_URL = "http://localhost:3000";
process.env.NODE_ENV = "test";

const databaseDir =
  "C:/Users/m.cantone.MRC-ZBOOK-1/AppData/Local/Temp/ppi-qa/sprint7c";

function executeSql(sql: string): Promise<void> {
  return new Promise((done, reject) => {
    const child = spawn("npx", ["prisma", "db", "execute", "--stdin", "--schema", "prisma/schema.prisma"], {
      cwd: process.cwd(),
      shell: true,
      env: process.env,
    });
    let errors = "";
    child.stderr?.on("data", (chunk) => {
      errors += String(chunk);
    });
    child.on("exit", (code) => (code === 0 ? done() : reject(new Error(`sql ${code} ${errors}`))));
    child.stdin.write(sql);
    child.stdin.end();
  });
}

async function startPg() {
  const { default: EmbeddedPostgres } = await import(
    "file:///C:/Users/m.cantone.MRC-ZBOOK-1/AppData/Local/Temp/ppi-qa/node_modules/embedded-postgres/dist/index.js"
  );
  if (fs.existsSync(databaseDir)) {
    fs.rmSync(databaseDir, { recursive: true, force: true });
  }
  const pg = new EmbeddedPostgres({
    databaseDir,
    user: "postgres",
    password: "postgres",
    port,
    persistent: false,
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("ppi");
  process.env.DIRECT_URL = `postgresql://postgres:postgres@127.0.0.1:${port}/ppi`;
  process.env.DATABASE_URL = process.env.DIRECT_URL;
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
  await executeSql("ALTER ROLE ppi_app WITH LOGIN PASSWORD 'ppi-app-local'");
  process.env.DATABASE_URL = `postgresql://ppi_app:ppi-app-local@127.0.0.1:${port}/ppi`;
  g.__ppiPg = pg;
}

if (!g.__ppiPgReady) {
  g.__ppiPgReady = startPg();
}
await g.__ppiPgReady;