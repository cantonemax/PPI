import { spawn } from "node:child_process";
import "./next-mocks";

const port = 55436;
process.env.AUTH_SECRET = "qa-secret-qa-secret-qa-secret-qa";
process.env.APP_URL = "http://localhost:3000";
process.env.NODE_ENV = "test";

const { default: EmbeddedPostgres } = await import(
  "file:///C:/Users/m.cantone.MRC-ZBOOK-1/AppData/Local/Temp/ppi-qa/node_modules/embedded-postgres/dist/index.js"
);
const pg = new EmbeddedPostgres({
    databaseDir: "C:/Users/m.cantone.MRC-ZBOOK-1/AppData/Local/Temp/ppi-qa/sprint7c",
  user: "postgres",
  password: "postgres",
  port,
  persistent: false,
});
await pg.initialise();
await pg.start();
await pg.createDatabase("ppi");
process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${port}/ppi`;
await new Promise<void>((done, reject) => {
  const child = spawn("npx", ["prisma", "migrate", "deploy"], { cwd: process.cwd(), shell: true, env: process.env });
  child.on("exit", (code) => (code === 0 ? done() : reject(new Error(`migrate ${code}`))));
});

const stop = globalThis as { __ppiPg?: { stop: () => Promise<void> } };
stop.__ppiPg = pg;
