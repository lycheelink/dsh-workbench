/**
 * Build the client face as a CJS bundle with react external (resolved by the
 * host page through the ModuleLoader seed table), then wrap the output into
 * the window.__ModuleLoader__.load({ id, factory }) contract.
 */
import { build } from "esbuild";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cjsOut = resolve(rootDir, "lib/client.cjs");
const clientOut = resolve(rootDir, "lib/client.js");

await build({
  entryPoints: [resolve(rootDir, "src/client/index.jsx")],
  outfile: cjsOut,
  format: "cjs",
  platform: "browser",
  target: "es2022",
  bundle: true,
  sourcemap: false,
  external: ["react", "react/*", "@deepseek-ai/*"],
  // Vendored dual-mode HTML consoles (寻优参数采集台) are imported as raw
  // strings and embedded via <iframe srcDoc>.
  loader: { ".html": "text" },
  logLevel: "info"
});

const raw = readFileSync(cjsOut, "utf8");
const indented = raw.split("\n").map((line) => {
  const normalized = line.trimEnd();
  return normalized ? "\t\t" + normalized : "";
}).join("\n");
const wrapped =
  "window.__ModuleLoader__.load({\n\tid: \"@lycheelink/dsh-workbench\",\n\tfactory: (require) => {\n\t\tvar module = { exports: {} };\n\t\tvar exports = module.exports;\n" +
  indented +
  "\n\t\treturn module.exports;\n\t}\n});\n";
writeFileSync(clientOut, wrapped, "utf8");
rmSync(cjsOut, { force: true });
console.log("build-client: wrote " + clientOut + " (" + wrapped.length + " bytes)");
