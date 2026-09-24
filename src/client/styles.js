/**
 * Workbench styles. Injected once as a <style> element by the first component
 * that calls ensureWorkbenchStyles(). All selectors are prefixed with dsh-wb-
 * to avoid collisions with DSH's CSS modules.
 */
export const WORKBENCH_CSS = `
/* ── Left-sidebar nav entry ─────────────────────────────── */
/* Mirrors the host's "插件" panelRow (hHd-Xa_panelRow) so the entry reads as
 * a flat list row, not a card button: transparent bg, no border, 36px tall,
 * left-aligned, regular weight, 8px icon gap. Hover/active use the same host
 * design tokens as the sibling row. */
.dsh-wb-sidebar-nav {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  box-sizing: border-box;
  width: calc(100% - 4px);
  min-height: 36px;
  /* Row metrics match hHd-Xa_panelRow; the 8px bottom margin echoes the
   * panelList group gap that separates the 插件 group from the next section. */
  margin: 0 2px 8px;
  padding: 7px 8px;
  border: none;
  border-radius: 12px;
  background: transparent;
  color: var(--dsw-alias-label-primary, #0f1115);
  font: inherit;
  text-align: left;
  cursor: pointer;
  flex: none;
}
.dsh-wb-sidebar-nav:hover,
.dsh-wb-sidebar-nav-active {
  background: var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,0.08));
}
.dsh-wb-sidebar-nav:focus-visible {
  outline: 2px solid var(--dsw-alias-label-primary, #0f1115);
  outline-offset: -2px;
}
.dsh-wb-sidebar-nav svg { flex: none; }
.dsh-wb-sidebar-nav-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
/* Narrow rail: icon only, centered (host collapsed panelRow metrics). */
.dsh-wb-sidebar-nav.dsh-wb-compact {
  width: 36px;
  height: 36px;
  padding: 0;
  margin-left: auto;
  margin-right: auto;
  justify-content: center;
}
.dsh-wb-sidebar-nav.dsh-wb-compact .dsh-wb-sidebar-nav-label { display: none; }

/* ── Full-page layer ────────────────────────────────────── */
/* While the page is open, drop the covered columns out of the a11y tree and
 * keyboard order (visibility keeps them in layout, so the page's left edge and
 * the grid tracks stay put and the underlying conversation keeps its state). */
html[data-dsh-workbench-page-open] [class*="centerCol"],
html[data-dsh-workbench-page-open] [class*="detailsCol"] {
  visibility: hidden;
}

/* Design tokens shared by the page layer and the settings tab (which lives
 * outside .dsh-wb-page inside the host's settings page). Hardcoded fallbacks
 * keep both usable when DSH's --dsw-alias-* tokens are absent. */
.dsh-wb-page,
.dsh-wb-settings {
  --dsh-wb-brand: var(--dsw-alias-brand, #2d6cdf);
  --dsh-wb-border: var(--dsw-alias-border, rgba(128,128,128,0.25));
  --dsh-wb-bg: var(--dsw-alias-bg, #ffffff);
  --dsh-wb-bg-2: var(--dsw-alias-bg-hover, rgba(128,128,128,0.06));
  --dsh-wb-text: var(--dsw-alias-label, #1f2328);
  --dsh-wb-text-2: var(--dsw-alias-label-secondary, #656d76);
}
.dsh-wb-page {
  position: absolute;
  top: 0;
  bottom: 0;
  right: 0;
  z-index: 60;
  flex-direction: column;
  box-sizing: border-box;
  min-width: 0;
  background: var(--dsw-alias-bg-base, var(--dsh-wb-bg));
  color: var(--dsh-wb-text);
  font-size: 13px;
  line-height: 1.5;
  overflow: hidden;
}
.dsh-wb-page * { box-sizing: border-box; }

/* ── Header ─────────────────────────────────────────────── */
.dsh-wb-page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--dsh-wb-border);
  flex: 0 0 auto;
}
.dsh-wb-panel-title {
  font-weight: 600;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dsh-wb-nav { display: flex; gap: 4px; }
.dsh-wb-nav-btn {
  appearance: none;
  border: none;
  background: transparent;
  color: var(--dsh-wb-text-2);
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 6px;
  cursor: pointer;
}
.dsh-wb-nav-btn:hover { background: var(--dsh-wb-bg-2); }
.dsh-wb-nav-btn-active {
  background: color-mix(in srgb, var(--dsh-wb-brand) 14%, transparent);
  color: var(--dsh-wb-brand);
  font-weight: 600;
}
.dsh-wb-close-btn { font-size: 13px; padding: 3px 7px; }

/* ── Body ───────────────────────────────────────────────── */
.dsh-wb-page-body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 12px 16px;
}

/* ── Toolbar (search + filter chips) ────────────────────── */
.dsh-wb-toolbar { display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px; }
.dsh-wb-search {
  width: 100%;
  max-width: 340px;
  padding: 8px 12px;
  border: 1px solid var(--dsh-wb-border);
  border-radius: 10px;
  background: var(--dsh-wb-bg);
  color: var(--dsh-wb-text);
  font-size: 12px;
  outline: none;
}
.dsh-wb-search:focus {
  border-color: var(--dsh-wb-brand);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--dsh-wb-brand) 14%, transparent);
}
.dsh-wb-filters { display: flex; flex-wrap: wrap; gap: 6px; }
.dsh-wb-filter-chip {
  appearance: none;
  border: 1px solid var(--dsh-wb-border);
  background: transparent;
  color: var(--dsh-wb-text-2);
  font-size: 11px;
  padding: 3px 12px;
  border-radius: 999px;
  cursor: pointer;
  transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease;
}
.dsh-wb-filter-chip:hover { background: var(--dsh-wb-bg-2); }
.dsh-wb-filter-chip-active {
  background: var(--dsh-wb-brand);
  border-color: var(--dsh-wb-brand);
  color: #fff;
}
.dsh-wb-filter-chip-active:hover { background: var(--dsh-wb-brand); }

/* ── Card grid ──────────────────────────────────────────── */
.dsh-wb-card-list {
  display: grid;
  /* auto-fit (collapses empty tracks) so a partial row of cards fills evenly
   * instead of leaving trailing empty tracks; cap track width so vertical
   * cards keep good proportions; left-aligned reads more naturally than
   * centered when the grid is wider than its cards. */
  grid-template-columns: repeat(auto-fit, minmax(320px, 400px));
  justify-content: start;
  gap: 12px;
}
.dsh-wb-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  min-width: 0;
  text-align: left;
  padding: 14px 14px 12px;
  border: 1px solid var(--dsh-wb-border);
  border-radius: 12px;
  background: var(--dsh-wb-bg);
  color: var(--dsh-wb-text);
  cursor: pointer;
  transition: border-color 140ms ease, box-shadow 140ms ease, transform 140ms ease;
}
.dsh-wb-card:hover {
  transform: translateY(-2px);
  border-color: var(--dsh-wb-brand);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
}
.dsh-wb-card-icon-tile {
  flex: none;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  color: #fff;
}
.dsh-wb-card-body {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.dsh-wb-card-title { font-weight: 600; font-size: 14px; line-height: 1.4; }
.dsh-wb-card-category {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--dsh-wb-bg-2);
  color: var(--dsh-wb-text-2);
  white-space: nowrap;
}
.dsh-wb-card-desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.55;
  color: var(--dsh-wb-text-2);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.dsh-wb-card-footer {
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.dsh-wb-card-cta {
  font-size: 12px;
  color: var(--dsh-wb-brand);
  opacity: 0;
  transition: opacity 140ms ease;
}
.dsh-wb-card:hover .dsh-wb-card-cta { opacity: 1; }

/* ── Form view ──────────────────────────────────────────── */
.dsh-wb-back-btn {
  appearance: none;
  border: none;
  background: transparent;
  color: var(--dsh-wb-text-2);
  font-size: 12px;
  padding: 2px 0;
  cursor: pointer;
  margin-bottom: 6px;
}
.dsh-wb-back-btn:hover { color: var(--dsh-wb-brand); }
.dsh-wb-form-title { margin: 0 0 2px; font-size: 15px; font-weight: 600; }
.dsh-wb-form-subtitle { margin: 0 0 10px; font-size: 12px; color: var(--dsh-wb-text-2); }
.dsh-wb-form-view { display: flex; flex-direction: column; }

/* Artifact-format card: the console owns its scroll so its sticky output
   panel keeps floating; the iframe flex-fills the available body height. */
.dsh-wb-form-view--artifact { height: 100%; }
.dsh-wb-form-view--artifact .dsh-wb-artifact { flex: 1 1 auto; min-height: 0; margin-top: 10px; }
.dsh-wb-form-view--artifact iframe { display: block; width: 100%; height: 100%; border: 0; }

.dsh-wb-dynamic-form { display: flex; flex-direction: column; gap: 10px; }
.dsh-wb-form-group { display: flex; flex-direction: column; gap: 3px; }
.dsh-wb-form-label { font-size: 12px; font-weight: 500; }
.dsh-wb-required { color: var(--dsw-alias-danger, #dc3545); margin-right: 2px; }
.dsh-wb-input,
.dsh-wb-select,
.dsh-wb-textarea {
  width: 100%;
  padding: 6px 9px;
  border: 1px solid var(--dsh-wb-border);
  border-radius: 6px;
  background: var(--dsh-wb-bg);
  color: var(--dsh-wb-text);
  font-size: 12px;
  outline: none;
  font-family: inherit;
}
.dsh-wb-input:focus,
.dsh-wb-select:focus,
.dsh-wb-textarea:focus { border-color: var(--dsh-wb-brand); }
.dsh-wb-textarea { resize: vertical; }
.dsh-wb-form-desc { margin: 0; font-size: 11px; color: var(--dsh-wb-text-2); }

/* Conditional field groups: reveal with a fade/slide transition */
.dsh-wb-conditional-group {
  border-left: 2px solid var(--dsh-wb-brand);
  padding-left: 10px;
  margin-left: 2px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  animation: dsh-wb-fade-in 180ms ease;
}
.dsh-wb-conditional-field .dsh-wb-form-label {
  color: var(--dsh-wb-brand);
}
@keyframes dsh-wb-fade-in {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

.dsh-wb-file-input { display: flex; align-items: center; gap: 6px; }
.dsh-wb-file-input .dsh-wb-input { flex: 1 1 auto; }
.dsh-wb-file-hint { font-size: 11px; color: var(--dsh-wb-text-2); white-space: nowrap; }

/* ── Form actions ───────────────────────────────────────── */
.dsh-wb-form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 14px;
}
.dsh-wb-btn {
  appearance: none;
  border: 1px solid var(--dsh-wb-border);
  border-radius: 6px;
  background: var(--dsh-wb-bg);
  color: var(--dsh-wb-text);
  font-size: 12px;
  padding: 6px 14px;
  cursor: pointer;
}
.dsh-wb-btn-primary {
  background: var(--dsh-wb-brand);
  border-color: var(--dsh-wb-brand);
  color: #fff;
}
.dsh-wb-btn-primary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.dsh-wb-btn-secondary:hover { background: var(--dsh-wb-bg-2); }

.dsh-wb-error {
  margin-top: 8px;
  padding: 6px 10px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--dsw-alias-danger, #dc3545) 10%, transparent);
  color: var(--dsw-alias-danger, #dc3545);
  font-size: 12px;
}

/* ── Control room ───────────────────────────────────────── */
.dsh-wb-control-room-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
}
.dsh-wb-control-room-header .dsh-wb-back-btn { margin-bottom: 0; }
.dsh-wb-control-room-title { font-size: 15px; font-weight: 600; }
.dsh-wb-control-room-hint { margin: 0 0 10px; font-size: 12px; color: var(--dsh-wb-text-2); }
.dsh-wb-control-room-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 8px;
}
.dsh-wb-session-card {
  border: 1px solid var(--dsh-wb-border);
  border-radius: 8px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: var(--dsh-wb-bg);
}
.dsh-wb-session-status-row { display: flex; align-items: center; gap: 5px; }
.dsh-wb-session-status-dot { font-size: 12px; line-height: 1; }
.dsh-wb-session-status-label { font-size: 11px; font-weight: 600; }
.dsh-wb-session-delete {
  margin-left: auto;
  appearance: none;
  border: 1px solid var(--dsh-wb-border);
  border-radius: 6px;
  background: transparent;
  color: var(--dsh-wb-text-2);
  font-size: 10px;
  padding: 1px 7px;
  cursor: pointer;
  flex: none;
}
.dsh-wb-session-delete:hover {
  border-color: var(--dsw-alias-danger, #dc3545);
  color: var(--dsw-alias-danger, #dc3545);
}
.dsh-wb-session-delete-confirm {
  background: color-mix(in srgb, var(--dsw-alias-danger, #dc3545) 12%, transparent);
  border-color: var(--dsw-alias-danger, #dc3545);
  color: var(--dsw-alias-danger, #dc3545);
  font-weight: 600;
}
.dsh-wb-session-card-title { font-size: 12px; font-weight: 600; }
.dsh-wb-session-step { font-size: 11px; color: var(--dsh-wb-text-2); }
.dsh-wb-session-time { font-size: 10px; color: var(--dsh-wb-text-2); margin-top: auto; padding-top: 2px; }

.dsh-wb-empty {
  padding: 24px 0;
  text-align: center;
  color: var(--dsh-wb-text-2);
  font-size: 12px;
}

/* ── Settings tab ───────────────────────────────────────── */
.dsh-wb-settings { padding: 12px; }
.dsh-wb-settings h3 { margin: 0 0 4px; font-size: 15px; }
.dsh-wb-settings p { margin: 0 0 10px; font-size: 12px; color: var(--dsh-wb-text-2); }
.dsh-wb-settings-card-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.dsh-wb-settings-card-row {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--dsh-wb-border);
  border-radius: 6px;
}
.dsh-wb-settings-card-main { display: flex; align-items: center; gap: 8px; }
.dsh-wb-settings-card-id { font-size: 11px; color: var(--dsh-wb-text-2); font-family: ui-monospace, monospace; }
.dsh-wb-settings-card-category {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--dsh-wb-bg-2);
  color: var(--dsh-wb-text-2);
}
.dsh-wb-settings-card-actions { margin-left: auto; display: flex; gap: 6px; }
.dsh-wb-settings-editor {
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-top: 1px dashed var(--dsh-wb-border);
  padding-top: 10px;
}
.dsh-wb-prompt-textarea { font-family: ui-monospace, monospace; font-size: 11px; line-height: 1.5; }
/* .dsh-wb-settings p sets text-2 on every <p>; re-scope the editor labels/desc
   and the error/notice messages so their own colors win. */
.dsh-wb-settings-editor .dsh-wb-form-desc { margin: 0; }
.dsh-wb-settings-editor .dsh-wb-preview-label { margin: 0 0 4px; font-size: 11px; color: var(--dsh-wb-text-2); font-weight: 500; }
.dsh-wb-settings .dsh-wb-error { color: var(--dsw-alias-danger, #dc3545); }
.dsh-wb-settings .dsh-wb-notice { color: var(--dsh-wb-text); }
.dsh-wb-notice {
  margin-top: 8px;
  padding: 6px 10px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--dsh-wb-brand) 10%, transparent);
  font-size: 12px;
}
.dsh-wb-prompt-preview {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid var(--dsh-wb-border);
  border-radius: 6px;
  background: var(--dsh-wb-bg-2);
  color: var(--dsh-wb-text);
  font-family: ui-monospace, monospace;
  font-size: 11px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 260px;
  overflow: auto;
}
.dsh-wb-reset-confirm {
  background: color-mix(in srgb, var(--dsw-alias-danger, #dc3545) 12%, transparent);
  border-color: var(--dsw-alias-danger, #dc3545);
  color: var(--dsw-alias-danger, #dc3545);
  font-weight: 600;
}
`;

let stylesInjected = false;
const STYLE_ID = "dsh-workbench-styles";

/**
 * Inject the workbench stylesheet once. Safe to call from any component.
 */
export function ensureWorkbenchStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  try {
    if (document.getElementById(STYLE_ID)) return;
  } catch {}
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = WORKBENCH_CSS;
  document.head.appendChild(style);
}
