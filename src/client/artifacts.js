/**
 * Vendored HTML artifact consoles, keyed by workbench card id. A card listed
 * here renders its config surface as an embedded standalone HTML page
 * (see ArtifactCard) instead of the DynamicForm, and launches with the page's
 * own structured JSON output (formData.perfConfig).
 *
 * Sources are synced from their canonical editors via `npm run sync:artifact`
 * (see scripts/sync-artifact.mjs) — the .html import is an esbuild text-loader
 * string, never fetched at runtime, so the plugin stays offline self-contained.
 */
import modelOobPerfOptimizeHtml from "./artifacts/model-oob-perf-optimize.html";
import ascendProfilerHtml from "./artifacts/ascend-profiler.html";
import veriflowHtml from "./artifacts/veriflow.html";

export const ARTIFACTS = {
  "model-oob-perf-optimize": modelOobPerfOptimizeHtml,
  "ascend-profiler": ascendProfilerHtml,
  "veriflow": veriflowHtml
};

/** postMessage namespace spoken between the shell and embedded consoles. */
export const ARTIFACT_BRIDGE = "dsh-wb:artifact";
