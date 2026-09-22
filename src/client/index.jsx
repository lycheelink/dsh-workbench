/**
 * dsh-workbench browser plugin entry: mounts the workbench Remote
 * contribution, a left-sidebar "工作台" nav entry and a chrome-less full-page
 * workbench view that covers the DSH center column.
 *
 * The workbench is a pure incremental plugin: it injects a sidebar nav item
 * and a page layer without replacing or disabling any official plugin. The
 * page is mounted through the shell overlay layer (whose pointer-events pass
 * through everywhere except our own layer), so the sidebar underneath stays
 * fully interactive while the page is open.
 */
import * as React from "react";
import { createWorkbenchApi } from "./api.js";
import { WorkbenchPanel } from "./WorkbenchPanel.jsx";
import { SidebarNav } from "./SidebarNav.jsx";
import { zh, en } from "./locale.js";
import TYPERT_REMOTE from "../remote.js";

const NS = "workbench";

export const inject = ["remote", "slots", "locale", "sessions"];

export async function apply(ctx) {
  const disposers = [];
  try {
    const dispose = await ctx.remote.$mount(TYPERT_REMOTE);
    if (typeof dispose === "function") disposers.push(dispose);
  } catch (error) {
    for (const d of disposers.reverse()) await d();
    throw error;
  }

  const api = createWorkbenchApi(ctx);
  const t = ctx.locale.bind(NS);

  ctx.locale.register(NS, { zh, en });

  /**
   * Jump the DSH conversation column to a session (used after a card launch).
   * The session list must be refreshed first — the client's `sessions.open`
   * throws for sessions not yet present in the list catalog.
   */
  const openSession = async (sessionId) => {
    const sessions = ctx.sessions;
    if (!sessions || typeof sessions.refresh !== "function" || typeof sessions.open !== "function") {
      return;
    }
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        await sessions.refresh();
        sessions.open(sessionId);
        return;
      } catch {
        // The spawned session may lag behind the list; retry with backoff.
        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
      }
    }
  };

  // Left-sidebar "工作台" nav entry, mounted above the "工作区" section. It
  // renders no DOM of its own; the button it manages lives inside the sidebar.
  ctx.slots.inject("shell.overlay", () =>
    ctx.slots.register(
      {
        name: "shell.overlay",
        id: "dsh-workbench-sidebar-nav",
        order: 95,
        locale: NS,
        inject: () => ({ t })
      },
      SidebarNav
    )
  );

  // Full-page workbench layer, mounted at shell-overlay level so it spans the
  // whole app frame. The panel itself positions itself over the center column
  // (see WorkbenchPanel); the sidebar and any transient overlays stay usable.
  ctx.slots.inject("shell.overlay", () =>
    ctx.slots.register(
      {
        name: "shell.overlay",
        id: "dsh-workbench-page",
        order: 90,
        locale: NS,
        inject: () => ({ api, t, openSession })
      },
      WorkbenchPanel
    )
  );

  // A real settings tab for card management (add/remove scene cards).
  ctx.slots.inject("settings.plugins.tab", () =>
    ctx.slots.register(
      {
        name: "settings.plugins.tab",
        id: "dsh-workbench-resources",
        order: 85,
        label: () => t("panelTitle"),
        locale: NS,
        inject: () => ({ api, t })
      },
      WorkbenchSettingsTab
    )
  );

  return async () => {
    for (const d of disposers.reverse()) await d();
  };
}

/**
 * Settings tab placeholder for card management (Phase 3: enterprise governance).
 */
function WorkbenchSettingsTab({ api, t }) {
  const [cards, setCards] = React.useState(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { cards: list } = await api.listCards();
        if (!cancelled) setCards(list);
      } catch (error) {
        if (!cancelled) setCards([]);
      }
    })();
    return () => { cancelled = true; };
  }, [api]);

  return (
    <div className="dsh-wb-settings">
      <h3>{t("panelTitle")}</h3>
      <p>{t("controlRoomHint")}</p>
      {cards === null && <p>{t("loading")}</p>}
      {cards !== null && (
        <ul className="dsh-wb-settings-card-list">
          {cards.map((card) => (
            <li key={card.id}>
              <strong>{card.title}</strong>
              <span className="dsh-wb-settings-card-id">{card.id}</span>
              <span className="dsh-wb-settings-card-category">{card.category}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
