import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "node",
    fileParallelism: false,
    isolate: false,
    maxWorkers: 1,
    setupFiles: ["./tests/next-mocks.ts", "./tests/setup.ts"],
  },
  resolve: {
    alias: { "@": path.resolve("src") },
  },
});