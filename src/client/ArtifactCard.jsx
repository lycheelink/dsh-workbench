/**
 * ArtifactCard: renders a vendored standalone HTML console (the model-oob
 * "寻优参数采集台" / ascend-profiler "Profiling 参数采集台" / veriflow
 * "验证流测试台") inside a sandboxed srcDoc iframe and bridges its state to
 * the workbench shell over postMessage.
 *
 * The console is dual-mode (it also runs standalone on Cloudflare Pages). In
 * embed mode the shell prepends a one-line script that sets
 * window.__DASH_EMBED__ = true, so the page hides its site-level header/footer
 * and the chat-paste trigger button, shows the embed-only「启动寻优」button, drops
 * its width cap, and reports through the bridge:
 *
 *   { bridge, kind: "state",  json, ready, warns }  — on every form change
 *   { bridge, kind: "launch" }                      — user clicked 启动寻优
 *   { bridge, kind: "resize", height }              — content height change
 *
 * and answers { bridge, kind: "pull" } with a fresh "state" post. The shell
 * feeds `json`/`ready` up so launch can gate on the console's own completeness
 * meter (the console is authoritative for required fields).
 *
 * Layout: the iframe is flex-filled by the artifact form view (see styles.js
 * .dsh-wb-form-view--artifact) so the console scrolls INSIDE itself and its
 * sticky output panel keeps floating — height growth is unnecessary.
 *
 * Security note: allow-same-origin + allow-scripts lets the vendored page run
 * scripts against the host origin (needed for its localStorage draft) — this
 * is acceptable ONLY because the artifact is a trusted bundle constant, never
 * user- or storage-supplied. allow-downloads keeps the console's "下载 JSON"
 * button functional inside the sandbox.
 */
import * as React from "react";
import { ARTIFACT_BRIDGE } from "./artifacts.js";

const EMBED_BOOTSTRAP = `<script>window.__DASH_EMBED__=true</scr${"ipt"}>`;

export function ArtifactCard({ html, onState, onLaunch, title = "" }) {
  const srcDoc = React.useMemo(
    () => EMBED_BOOTSTRAP + html,
    [html]
  );

  React.useEffect(() => {
    const onMessage = (event) => {
      if (!event.data || event.data.bridge !== ARTIFACT_BRIDGE) return;
      if (event.data.kind === "state") {
        onState?.({ json: event.data.json, ready: !!event.data.ready });
      } else if (event.data.kind === "launch") {
        onLaunch?.();
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onState, onLaunch]);

  // Belt-and-suspenders: the console posts its first "state" during its own
  // init, but a pull on load covers the case the shell's listener attaches
  // after the page's first render.
  const pull = React.useCallback(() => {
    window.postMessage({ bridge: ARTIFACT_BRIDGE, kind: "pull" }, "*");
  }, []);

  return (
    <div className="dsh-wb-artifact">
      <iframe
        title={title || "参数采集台"}
        srcDoc={srcDoc}
        sandbox="allow-scripts allow-same-origin allow-downloads"
        onLoad={pull}
        style={{ display: "block", width: "100%", height: "100%", border: "0" }}
      />
    </div>
  );
}
