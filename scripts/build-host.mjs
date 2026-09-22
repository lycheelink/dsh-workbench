/**
 * Build the host faces (service entry + typert/remote artifacts) as ESM for
 * Node. @deepseek-ai/* stays external (resolved from the profile's node_modules
 * at runtime); zod-like runtime deps, if any, would be bundled.
 */
import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

await build({
  entryPoints: [
    resolve(rootDir, "src/index.js"),
    resolve(rootDir, "src/remote.js"),
    resolve(rootDir, "src/descriptors.js"),
    resolve(rootDir, "src/typert.js")
  ],
  outdir: resolve(rootDir, "lib"),
  format: "esm",
  platform: "node",
  target: "node20",
  bundle: true,
  sourcemap: false,
  external: ["@deepseek-ai/*"],
  logLevel: "info"
});
for (const file of ["index.js", "remote.js", "descriptors.js", "typert.js"]) {
  const path = resolve(rootDir, "lib", file);
  writeFileSync(path, readFileSync(path, "utf8").replace(/[ \t]+$/gm, ""), "utf8");
}
console.log("build-host: wrote lib/index.js, lib/remote.js, lib/descriptors.js, lib/typert.js");
