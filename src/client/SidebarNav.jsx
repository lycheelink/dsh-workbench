/**
 * SidebarNav: the "工作台" menu entry injected into the DSH left sidebar,
 * positioned directly above the "工作区" (workspace) section.
 *
 * The DSH host re-renders its sidebar React tree constantly, so this component
 * owns a real DOM <button> through a MutationObserver — the same pattern the
 * workbench previously used for its conversation-header tab. It tolerates
 * host-version drift by locating the workspace section by text + class names
 * rather than depending on one stable selector.
 *
 * Behaviour:
 *   - Clicking toggles the workbench full-page view (active highlight when open).
 *   - Navigating anywhere else in the sidebar (a session, 新建会话, 设置) while
 *     the page is open auto-closes it.
 *   - When the sidebar collapses to its narrow rail the button switches to
 *     icon-only (class `dsh-wb-compact`).
 */
import * as React from "react";
import { ensureWorkbenchStyles } from "./styles.js";
import { getWorkbenchSnapshot, workbenchSetOpen, useWorkbenchSnapshot } from "./store.js";

const NAV_SELECTOR = '[data-dsh-workbench-sidebar-nav="true"]';
const SIDEBAR_COL_SELECTOR = '[class*="sidebarCol"]';

const NAV_ICON = `
  <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
    <rect x="1.75" y="1.75" width="5.2" height="5.2" rx="1.3"/>
    <rect x="9.05" y="1.75" width="5.2" height="5.2" rx="1.3"/>
    <rect x="1.75" y="9.05" width="5.2" height="5.2" rx="1.3"/>
    <rect x="9.05" y="9.05" width="5.2" height="5.2" rx="1.3"/>
  </svg>`;

/**
 * Locate the sidebar content root and the workspace region.
 *
 * Host layout (newer builds):  sidebarCol > div > .hHd-Xa_root
 *   ├─ .hHd-Xa_logoRow        (brand + collapse)
 *   ├─ .hHd-Xa_newSession     (新建会话)
 *   ├─ .hHd-Xa_regionArea     └─ … > .bhn1Oq_root (工作区 section)
 *   └─ .hHd-Xa_footArea       (设置)
 *
 * Returns { root, region } where `root` is the sidebar content container and
 * `region` the workspace region the nav button is inserted in front of.
 */
function findSidebarRoot() {
  const label = [...document.querySelectorAll("span")].find(
    (s) => s.textContent?.trim() === "工作区" || s.textContent?.trim() === "Workspaces"
  );
  if (!label) return null;
  const wsSection = label.closest('[class*="root"]');
  if (!wsSection) return null;
  const region = wsSection.closest('[class*="regionArea"]') ?? wsSection.parentElement;
  const root = region?.closest('[class*="root"]') ?? region?.parentElement;
  if (!root) return null;
  return { root, region };
}

function makeNavButton(t) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.dshWorkbenchSidebarNav = "true";
  button.className = "dsh-wb-sidebar-nav";
  button.setAttribute("aria-label", t("sidebarNavLabel"));
  button.innerHTML = `${NAV_ICON}<span class="dsh-wb-sidebar-nav-label">${t("sidebarNavLabel")}</span>`;
  return button;
}

function syncButton(button, open, t) {
  if (!button || !button.isConnected) return;
  button.setAttribute("aria-pressed", open ? "true" : "false");
  button.title = open ? t("closeWorkbench") : t("openWorkbench");
  button.classList.toggle("dsh-wb-sidebar-nav-active", open);
}

function syncCompact(button) {
  if (!button || !button.isConnected) return;
  const col = button.closest(SIDEBAR_COL_SELECTOR);
  const width = col ? col.getBoundingClientRect().width : 0;
  button.classList.toggle("dsh-wb-compact", width > 0 && width < 100);
}

export function SidebarNav({ t }) {
  const ui = useWorkbenchSnapshot();

  React.useEffect(() => {
    ensureWorkbenchStyles();
    const button = makeNavButton(t);

    let widthObserver = null;
    if (typeof ResizeObserver !== "undefined") {
      widthObserver = new ResizeObserver(() => syncCompact(button));
    }
    const trackSidebarCol = () => {
      if (!widthObserver) return;
      const col = document.querySelector(SIDEBAR_COL_SELECTOR);
      // ResizeObserver.observe is idempotent per element — safe to re-call.
      if (col) widthObserver.observe(col);
    };

    const place = () => {
      const anchor = findSidebarRoot();
      if (!anchor) return;
      const { root, region } = anchor;
      // Remove stray copies the host may have left behind on re-render.
      document.querySelectorAll(NAV_SELECTOR).forEach((el) => {
        if (el !== button || el.parentElement !== root) el.remove();
      });
      const correctlyPlaced = button.parentElement === root
        && root.contains(button)
        && (region === null || region.previousElementSibling === button);
      if (!correctlyPlaced) {
        if (button.parentElement) button.parentElement.removeChild(button);
        if (region) root.insertBefore(button, region);
        else root.appendChild(button);
      }
      syncButton(button, getWorkbenchSnapshot().open, t);
      syncCompact(button);
      trackSidebarCol();
    };

    const onClick = () => workbenchSetOpen(!getWorkbenchSnapshot().open);
    button.addEventListener("click", onClick);

    // Auto-close the workbench page when the user navigates elsewhere in the
    // sidebar (a session row, 新建会话, 设置). Clicks inside the workbench page,
    // on our own toggle, or on the brand/collapse row are left alone.
    const onDocClick = (event) => {
      if (!getWorkbenchSnapshot().open) return;
      const target = event.target;
      if (!target?.closest || target.closest(NAV_SELECTOR)) return;
      if (target.closest(".dsh-wb-page")) return;
      const anchor = findSidebarRoot();
      if (!anchor || !anchor.root.contains(target)) return;
      if (target.closest('[class*="logoRow"]')) return;
      workbenchSetOpen(false);
    };

    const observer = new MutationObserver(place);
    observer.observe(document.body, { childList: true, subtree: true });

    document.addEventListener("click", onDocClick, true);
    place();

    return () => {
      observer.disconnect();
      if (widthObserver) widthObserver.disconnect();
      button.removeEventListener("click", onClick);
      button.remove();
      document.removeEventListener("click", onDocClick, true);
    };
  }, [t]);

  // Keep the active highlight in sync with the store.
  React.useEffect(() => {
    document.querySelectorAll(NAV_SELECTOR).forEach((el) => syncButton(el, ui.open, t));
  }, [ui.open, t]);

  return null;
}
