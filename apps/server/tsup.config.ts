import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node22",
  platform: "node",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  // The shared package ships TypeScript sources, so it is bundled into the server build.
  noExternal: ["@puzzle/shared"],
});
