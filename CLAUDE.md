# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`@lycheelink/dsh-workbench` is an **Enterprise Agent Workbench** plugin for the DeepSeek Harness (DSH) Web UI: a "scene-card" grid where each card opens a dynamic parameter form, and launching a card **creates a real host agent session and injects an assembled prompt** via the host `sessionController` (the same service the web client uses for new conversations). A "control room" view monitors those sessions.

It is a **pure incremental plugin** — it injects a sidebar nav entry + a full-page layer and a settings tab, and never replaces or disables any official plugin. It follows DSH's "everything is a plugin" architecture (Cordis + Typert Remote + storage domains).

- Source root: `/opt/workspace/github/dsh-workbench/` — the git repo, GitHub upstream `lycheelink/dsh-workbench` (imported 2026-09 as a single squashed commit; CI gate = `.github/workflows/test.yml`). A deployment copy of the plugin source still lives at `data/workspace/workbench/dsh-workbench/` (gitignored inside the `deployments/deepseek-harness` tree) and is what the live DSH profile symlinks via `install:dev` — treat the GitHub repo as canonical upstream.
- Design doc: `data/workspace/workbench/PDR.md` (Chinese) — full product intent, card data model, phase boundaries. It lives **outside this repo** (in the deployments tree); read it before changing card or launch semantics.
- Runtime deps `@deepseek-ai/*` are resolved from the DSH profile's `node_modules` (peer/dev), never bundled.

## Commands

```bash
npm run build         # build:host + build:client (esbuild)
npm run build:host    # src/index.js + remote/descriptors/typert → lib/*.js (ESM, node20, @deepseek-ai/* external)
npm run build:client  # src/client/index.jsx → lib/client.js (CJS bundle wrapped in the window.__ModuleLoader__.load({id,factory}) contract; react + @deepseek-ai/* external)
npm test              # node test/smoke.mjs && node test/rc-verify.mjs  — REQUIRES `npm run build` first (imports lib/)
npm run test:rc       # rc-verify alone
npm run setup:rc      # vendored real typert-loader/registry releases → .rc-verify/vendor (run once after clone for full test coverage)
npm run install:dev   # symlink this package → ~/.dsh/profiles/web/node_modules/dsh-workbench
npm run sync:artifact # refresh vendored artifact consoles from the repo's own canonical pages/cloudflare-pages/dist → src/client/artifacts/ (strip is idempotent); node scripts/sync-artifact.mjs [cardId]
npm run build:doc     # pages/cloudflare-pages/index.md + _template.html → dist/index.html (zero-dep python3, scripts/build-doc.py)
npm run check:doc     # rebuild + byte-compare dist/index.html against the md (drift gate; also in CI + publish --check)
npm run pack:release  # build + npm pack
./pages/publish.sh    # deploy pages/cloudflare-pages/dist → https://dsh-workbench.pages.dev (see --help; needs pages/publish.env, gitignored)
```

Notes:
- ESM (`"type": "module"`), target node20, react 18, zod v4, esbuild.
- `test/smoke.mjs` covers host logic + wire-artifact shape; `test/rc-verify.mjs` runs the **real** `@deepseek-ai` typert-loader/registry (0.1.5-rc.2 + 0.1.6-alpha.1) against the built `lib/` manifest. rc-verify **skips gracefully** (exit 0) if `.rc-verify/vendor` was never `setup:rc`-installed — don't read a clean skip as failure.
- Deploying into a live instance: `node scripts/install-dev.mjs` (symlink) or `dsh plugin --profile web add @lycheelink/dsh-workbench`. `cordis.patch.yml` + `dsh.plugin.json` are the bundle-patch / plugin-registration manifests consumed by that flow.

## Static pages (`pages/`) + publish flow

Since the 2026-09 migration this repo is the **single canonical source of truth** for the three parameter consoles (寻优参数采集台 / Profiling 参数采集台 / 验证流测试台) — the same HTML files that `npm run sync:artifact` embeds into the client bundle and that `pages/publish.sh` deploys. **Edit them in `pages/cloudflare-pages/dist/`; never hand-edit `src/client/artifacts/*.html`** (run `sync:artifact` instead). The consoles are dual-mode: standalone on Cloudflare Pages + embedded (`window.__DASH_EMBED__=true`) in the plugin's sandboxed iframe.

- `pages/publish.sh` deploys `pages/cloudflare-pages/dist/` → `https://dsh-workbench.pages.dev` (wrangler project `dsh-workbench`). Credentials come from `pages/publish.env` (copy `pages/publish.env.example`, **never commit**). Modes: `--check` / `--dry-run` / `--force` / `--help`. It runs a pollution self-check (Prism token / copy-btn / `language-` DOM-rewrite markers) plus a doc-drift check (`scripts/build-doc.py --check`) plus a post-deploy byte-size spot check (Pages SPA-fallback returns index.html with HTTP 200 for missing paths).
- The **docs pages are generated**: every `pages/cloudflare-pages/<name>.md` renders to `dist/<name>.html` via `scripts/build-doc.py` (zero-dep stdlib; `npm run build:doc` / `check:doc`; currently `index` = site homepage/产品页, `dsh-quick-start` = DSH Web 安装手册, `dsh-tui-quick-start` = dsh-TUI 上手 — all sharing `_template.html`). **Edit the `.md`, never `dist/*.html`** — the md is the source of truth, and `test.yml` + `publish.sh --check` both byte-compare every page (committed HTML must equal the regenerated output). They are *not* artifact cards, so nothing enters `src/client/artifacts/`. The other dist pages are interactive consoles and stay hand-authored. Homepage link convention: `tile [标题](页.html) | 描述` (t-k renders inline md).
- The dist HTMLs are committed **clean** (builder `data-page-node-id` noise stripped) — these are the canonical files.
- CI caveat: `package-lock.json` pins ~70 transitive `@deepseek-ai/*` tarballs to `mirrors.huaweicloud.com`; the GitHub Actions `npm ci` depends on that mirror being reachable from runners. If it flakes, add a project `.npmrc` (`replace-registry-host=always` + registry) or demote the gate.

## Architecture

### Dual-face plugin (host + browser)

The same package ships two faces, both driven by shared "single sources of truth":

- **`src/schemas.js`** — all zod schemas: the `{ ok: true, value } | { ok: false, error: { code, message } }` envelope, card/session records, and per-method request/result schemas. Consumed by the host service, the descriptors, and the TYPERT manifest.
- **`src/descriptors.js`** — `DESCRIPTORS`: one `InvocationDescriptor` per Remote method. This is consumed **on both faces**: the host TYPERT manifest (`src/typert.js`) and the browser contribution (`src/remote.js` → `TYPERT_REMOTE`).
- **`src/typert.js`** — the host TYPERT manifest, discovered automatically through the package's `"./typert"` export. **Without this artifact the host never exposes `workbench/*` endpoints.** It registers 8 methods: `listCards / getCard / updateCard / resetCard / launchCardSession / listSessions / getSession / deleteSession`.

Every Remote method takes a single JSON `request` argument and returns the business envelope. Keep `schemas.js` → `descriptors.js` → `typert.js` in lockstep when touching the wire contract. Card prompt-template fields (`title / description / agentConfig.systemPrompt / agentConfig.allowedTools`) are user-editable via `updateCard`; overrides persist to the `workbench_cards` storage domain keyed by the card id (init applies them on boot) and `resetCard` rolls a built-in back to `src/cards.js`.

**Dual-shape schema/codec:** both manifest `schemas` and descriptor `codec`s must ship BOTH an eager zod v4 `schema` (host ≤0.1.5-rc.2 loader checks `_zod`) AND a `create()` factory returning a fresh schema (master / 0.1.6-alpha.1 lazy materialization). Dropping either breaks the other host line. `test/rc-verify.mjs` pins this with negative gates.

### Host side (`src/index.js`)

`WorkbenchService extends TypertRemoteService`, `static inject = ["storageDomain", "sessionController"]`. Persists to two storage domains opened in `[Service.init]()`: `workbench_cards` (user cards) and `workbench_sessions`. Built-in cards live in a cache (`src/cards.js`, 3 cards: `model-oob-perf-optimize` / `ascend-profiler` / `veriflow`); user cards load from the domain.

**Launch flow** (`launchCardSession`): payload-size bound (64 KiB) → required-field validation (basic + active conditional, shared `conditions.js`) → `file`-field server-path existence check → assemble structured prompt → create a real host session:

```
sessionController.create({ sessionId, agentPreset? })  // workbench sessionId doubles as the host sessionId
sessionController.prompt({ sessionId, requestId, mode: "queue", content: [{ type: "text", text: prompt }] }, AbortSignal)
```

Non-obvious invariants here:
- The card preset is passed to `create` **only if** the host's `agentPresets` roster lists it. Creating with an unknown preset then retrying the same id is unrecoverable on the host (dies on `signal.throwIfAborted`) — so never retry a failed create on the same `sessionId`.
- `prompt` is a cancellation-signaled Remote method: always pass a live `AbortSignal`. On host ≥0.1.5 a unique `requestId` + `mode: "queue"` are **required** or the prompt is rejected (`prompt rejected` / agent-busy).
- Missing `sessionController` degrades to a record-only `created` session, never a crash. `spawnAgent: false` config disables the real launch entirely.
- Control-room status is driven by a `ctx.on("session/event")` subscription registered in `init()`: `approval/asked → awaiting_decision`, `approval/decided | command/run | command/done → running`; unknown event types keep the current status (conservative by design).

**Sanitization boundary:** `formData` and the assembled `prompt` are server-local (model paths, PIDs, service URLs). `toWireSession()` and the wire schemas strip them — they must never cross the wire. The smoke test asserts this at both the service and schema boundaries.

**Artifact-format cards:** `model-oob-perf-optimize` (寻优参数采集台), `ascend-profiler` (Profiling 参数采集台) and `veriflow` (验证流测试台) each render a vendored HTML console (see client) instead of the DynamicForm. Their launch bypasses `missingRequiredFields` — the console's own 必填完成度 meter is authoritative — and instead requires a parseable `formData.perfConfig` object, which `buildArtifactPrompt` embeds verbatim as a JSON code block in the prompt shell (the card's scene/systemPrompt shell stays). The branch set is `ARTIFACT_FORM_CARD_IDS`; keep it in sync with `src/client/artifacts.js`.

### Client side (`src/client/`)

`index.jsx` mounts the Remote contribution via `ctx.remote.$mount(TYPERT_REMOTE)`, registers `zh`/`en` locale keys under `NS = "workbench"`, and injects into three slots:

- `shell.overlay` order 95 → `SidebarNav` — the "工作台" nav entry. **The host re-renders its sidebar React tree constantly**, so this owns a real DOM `<button>` through a `MutationObserver`, locating the "工作区" section by text + class names rather than one stable selector.
- `shell.overlay` order 90 → `WorkbenchPanel` — the full-page workbench. Always mounted; `ui.open` only toggles CSS visibility so in-flight form input and control-room scroll survive navigation away and back. Positions itself over the center column by tracking sidebar width with a `ResizeObserver`. While open it sets `data-dsh-workbench-page-open` on `<html>` so the covered columns drop out of the a11y/keyboard tree.
- `settings.plugins.tab` order 85 → `WorkbenchSettingsTab` (card management placeholder).

- **`api.js`**: `WorkbenchApi` unwraps the envelope into values / thrown `WorkbenchApiError`. `createWorkbenchApi` reaches into `ctx.remote.namespaces.get("workbench").service` — a **TypeScript-private instance field**, the only working mechanism on host 0.1.2 (mirrors dsh-ssh-ops). **Re-audit on any host upgrade**; the 0.1.5 audit flags API breaks in this area.
- **`ctx.sessions` facade / `openSession`**: the host's `sessions` inject (from `dsh-api-session-controller`) has **no `.open(sessionId)`** on ≥0.1.5 — that call silently no-ops. To jump the conversation column to a spawned session, `index.jsx`'s `openSession` does `refresh()` (a real `session/list` RPC) then `retain(sessionId, { source: "mainView" })` (the workspace's `replaceMain` path) with a backoff retry loop, since `retain` throws for sessions not yet in the client catalog. Re-audit on host upgrade.
- **`store.js`**: module-level snapshot + `useSyncExternalStore` for UI state (open / activeCardId / view / sessions / cards). No react context.
- **`ArtifactCard.jsx` / `artifacts.js`** — card-format escape hatch: any card id listed in `ARTIFACTS` renders a vendored standalone HTML console (寻优参数采集台 / Profiling 参数采集台 / 验证流测试台) in a sandboxed `srcDoc` iframe instead of the DynamicForm, and launches with the console's own structured output (`formData.perfConfig`). The consoles are **dual-mode** (also run standalone on Cloudflare Pages); in embed the shell prepends `window.__DASH_EMBED__=true`, and the page bridges `{state: json/ready/warns}` + `{launch}` (the console's own「启动寻优」/「启动 Profiling」/「启动测试」button, embed-only) + `{resize: height}` over the `dsh-wb:artifact` postMessage namespace and answers a `pull`. The iframe is flex-filled by `.dsh-wb-form-view--artifact` so the console scrolls **inside itself** and its sticky output panel keeps floating; launch gates on the bridged `ready`, and the shell's bottom 启动 is dropped for artifact cards (the console owns launch). **Re-audit the `allow-same-origin`+`allow-scripts` sandbox on any change** — it lets the vendored page touch host-origin localStorage; acceptable only because the artifact is a trusted bundle constant, never user/storage-supplied.
- **`DynamicForm.jsx` / `CardGrid.jsx` / `ControlRoom.jsx`**: card grid + dynamic form (conditional sub-forms) + session-status grid. Control-room deletion removes the workbench record only — the real host session is left in the conversation list; active-status cards need a two-step inline confirm.
- **`conditions.js`** is shared verbatim with the host (pure, no deps). The condition grammar is deliberately minimal — `key == 'literal'` string equality only; malformed/unrecognized expressions evaluate to `false`. Don't extend the grammar in only one face.

### Card model (`src/cards.js` + `PDR.md` §3)

Each card is `{ id, title, description, icon, category, formSchema, conditionalFields?, agentConfig: { preset?, systemPrompt, allowedTools?, skills? } }`. Conventions: `FormField.key` aligns with the scene Skill's CLI args (`mode` → `--mode`); `select` option values match Skill enums exactly (no front-end translation layer); `conditionalFields[].when` references a control field from `formSchema`; `file` fields are **server-side absolute paths** validated for existence at launch time.

## Gotchas / verification

- `lib/` is the build output that consumers actually resolve (package.json `main`/`exports` all point there), and `.gitignore` only ignores the `.cjs` intermediate — always rebuild before testing or packing (`prepack` builds automatically).
- `src/client/artifacts/*.html` is a **copy** synced from the canonical `pages/cloudflare-pages/dist/` via `npm run sync:artifact` — never hand-edit the vendored copy or the next sync silently overwrites it. The embed-mode CSS + bridge code live in the canonical page; standalone and embed share that one source.
- `test/smoke.mjs` builds a `WorkbenchService` without a live cordis context (`Object.create(WorkbenchService.prototype)` + stubbed `ctx`); it does not spin up a host.
- To verify a real browser run of the client bundle you need the actual DSH host profile (`install:dev` into `~/.dsh/profiles/web`, then run the DSH web instance) — there is no standalone client harness. 0.1.2 host settings pages only work on the loopback entry (upstream design), so test through a localhost/SSH tunnel, not LAN.
