import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/cli.ts"],
    format: ["esm"],
    target: "node22",
    outDir: "dist",
    clean: true,
    sourcemap: true,
    splitting: false,
  },
  {
    entry: ["src/worker.ts"],
    format: ["esm"],
    target: "es2022",
    outDir: "dist",
    sourcemap: true,
    splitting: false,
    noExternal: [],
  },
]);
