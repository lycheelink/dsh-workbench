/**
 * Sync the vendored artifact consoles (寻优参数采集台 / Profiling 参数采集台 —
 * dual-mode standalone HTML) from their canonical repo source into the client
 * bundle as imported artifacts, stripping builder node-id noise (idempotent —
 * canonical pages/cloudflare-pages/dist/*.html are already clean).
 *
 * Usage: node scripts/sync-artifact.mjs [cardId] [src.html]
 *   With no args: sync every artifact in SOURCES.
 *   With a cardId ("model-oob-perf-optimize" | "ascend-profiler" | "veriflow"):
 *     sync just that one. A bare path as the first arg still works for the
 *     default card (legacy single-source mode).
 *
 * Since the 2026-09 migration, this repo is the single canonical source of
 * truth for the consoles (pages/cloudflare-pages/dist — the same files that
 * publish.sh deploys to https://dsh-tui.pages.dev). Edit them there, then run
 * this copy step to refresh the esbuild text-loader imports consumed by
 * src/client/artifacts.js — the vendored copies are what the browser bundle
 * embeds via <iframe srcDoc>. Keep them in sync, never hand-edit both.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = resolve(rootDir, "pages/cloudflare-pages/dist");
const outDir = resolve(rootDir, "src/client/artifacts");

/** cardId → canonical source (repo pages dist) + vendored output name. */
const SOURCES = {
  "model-oob-perf-optimize": {
    src: resolve(distDir, "perf-optimize-params.html"),
    out: "model-oob-perf-optimize.html"
  },
  "ascend-profiler": {
    src: resolve(distDir, "profiling-collect-params.html"),
    out: "ascend-profiler.html"
  },
  "veriflow": {
    src: resolve(distDir, "veriflow-params.html"),
    out: "veriflow.html"
  }
};
const DEFAULT_CARD = "model-oob-perf-optimize";

function syncOne(cardId, src) {
  const out = resolve(outDir, SOURCES[cardId].out);
  const html = readFileSync(src, "utf8");
  // Strip builder node-id noise (data-page-node-id="...") — pure renderer
  // tracing attributes the consoles' builder sprinkles on every element; they
  // only bloat the bundle. Hand-authored sources have none and pass through.
  const clean = html.replace(/ data-page-node-id="[^"]*"/g, "");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(out, clean, "utf8");
  console.log(`sync-artifact: ${cardId}`);
  console.log(
    `  ${html.length} → ${clean.length} bytes (${html.length - clean.length} stripped) → ${out}`
  );
}

// argv[1] = cardId (known) or an explicit source path (legacy single-source).
const arg1 = process.argv[2];
if (arg1 && !(arg1 in SOURCES)) {
  syncOne(DEFAULT_CARD, resolve(arg1));
} else if (arg1) {
  syncOne(arg1, SOURCES[arg1].src);
} else {
  for (const [cardId, spec] of Object.entries(SOURCES)) {
    syncOne(cardId, spec.src);
  }
}
