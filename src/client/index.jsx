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
import { ensureWorkbenchStyles } from "./styles.js";
import { workbenchSetCards } from "./store.js";
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

  // Inject the workbench stylesheet up front (idempotent) so the settings tab
  // is styled even if the workbench panel has never been opened.
  ensureWorkbenchStyles();

  /**
   * Jump the DSH conversation column to a session (used after a card launch).
   * The session list must be refreshed first — `sessions.retain` (the host
   * workspace's open-a-conversation path) throws for sessions not yet present
   * in the client catalog.
   */
  const openSession = async (sessionId) => {
    const sessions = ctx.sessions;
    if (!sessions || typeof sessions.refresh !== "function" || typeof sessions.retain !== "function") {
      return;
    }
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        await sessions.refresh();
        // The host facade has no sessions.open; replaceMain uses
        // retain(id, { source: "mainView" }) to bring a conversation forward.
        sessions.retain(sessionId, { source: "mainView" });
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

/** Split a comma/Chinese-comma separated tool list into trimmed, non-empty names. */
function splitTools(text) {
  return (text ?? "")
    .split(/[,，]/)
    .map((tool) => tool.trim())
    .filter(Boolean);
}

/**
 * Read-only prompt preview mirroring the host's buildPrompt static sections
 * (src/index.js buildPrompt / buildArtifactPrompt): scene shell + system
 * instruction + allowed tools. The 用户输入参数 section is a placeholder — the
 * host fills it from the user's form submission at launch time.
 */
function promptPreviewText(draft, t) {
  const tools = splitTools(draft.toolsText);
  const lines = [
    `# 场景：${draft.title || "…"}`,
    "",
    "## 任务说明",
    draft.description || "…",
    "",
    "## 系统指令",
    draft.systemPrompt || "…",
    "",
    "## 用户输入参数",
    t("userInputSectionPlaceholder")
  ];
  if (tools.length > 0) {
    lines.push("", "## 可用工具", ...tools.map((tool) => `- \`${tool}\``));
  }
  return lines.join("\n");
}

/**
 * Settings tab for card prompt-template management (lightweight editor). Each
 * card row can expand into an inline editor for the 4 prompt-template fields
 * (scene title / task description / system instruction / allowed tools);
 * saving persists an override on the host, resetting restores the built-in
 * default. Writes flow through the workbench store so the workbench panel's
 * grid reflects the updated templates immediately.
 */
function WorkbenchSettingsTab({ api, t }) {
  const [cards, setCards] = React.useState(null);
  const [editingId, setEditingId] = React.useState(null);
  const [draft, setDraft] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [notice, setNotice] = React.useState(null);
  const [resetArmed, setResetArmed] = React.useState(false);

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

  const beginEdit = (card) => {
    setEditingId(card.id);
    setDraft({
      title: card.title ?? "",
      description: card.description ?? "",
      systemPrompt: card.agentConfig?.systemPrompt ?? "",
      toolsText: (card.agentConfig?.allowedTools ?? []).join(", ")
    });
    setError(null);
    setNotice(null);
    setResetArmed(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
    setError(null);
    setNotice(null);
    setResetArmed(false);
  };

  /** Refetch cards after a write; keep the workbench panel grid in sync too. */
  const refreshCards = async (noticeText) => {
    const { cards: list } = await api.listCards();
    setCards(list);
    workbenchSetCards(list);
    setEditingId(null);
    setDraft(null);
    setResetArmed(false);
    setNotice(noticeText);
  };

  const save = async () => {
    const title = draft.title.trim();
    const description = draft.description.trim();
    const systemPrompt = draft.systemPrompt.trim();
    if (!title || !description || !systemPrompt) {
      setError(t("cardSaveFailed"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.updateCard(editingId, {
        title,
        description,
        systemPrompt,
        allowedTools: splitTools(draft.toolsText)
      });
      await refreshCards(t("cardSaved"));
    } catch (err) {
      setError(err?.message ?? t("cardSaveFailed"));
    } finally {
      setBusy(false);
    }
  };

  /** Two-step inline confirm: first click arms, second click resets. */
  const reset = async () => {
    if (!resetArmed) {
      setResetArmed(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.resetCard(editingId);
      await refreshCards(t("cardReset"));
    } catch (err) {
      setError(err?.message ?? t("cardSaveFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dsh-wb-settings">
      <h3>{t("panelTitle")}</h3>
      <p>{t("controlRoomHint")}</p>
      {cards === null && <p>{t("loading")}</p>}
      {notice && <p className="dsh-wb-notice">{notice}</p>}
      {error && <p className="dsh-wb-error">{error}</p>}
      {cards !== null && (
        <ul className="dsh-wb-settings-card-list">
          {cards.map((card) => (
            <li key={card.id} className="dsh-wb-settings-card-row">
              <div className="dsh-wb-settings-card-main">
                <strong>{card.title}</strong>
                <span className="dsh-wb-settings-card-id">{card.id}</span>
                <span className="dsh-wb-settings-card-category">{card.category}</span>
                <span className="dsh-wb-settings-card-actions">
                  <button
                    className="dsh-wb-btn dsh-wb-btn-secondary"
                    onClick={() => (editingId === card.id ? cancelEdit() : beginEdit(card))}
                  >
                    {editingId === card.id ? t("cancel") : t("editCardTemplate")}
                  </button>
                </span>
              </div>
              {editingId === card.id && draft && (
                <div className="dsh-wb-settings-editor">
                  <div className="dsh-wb-form-group">
                    <label className="dsh-wb-form-label">{t("fieldSceneTitle")}</label>
                    <input
                      className="dsh-wb-input"
                      value={draft.title}
                      onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    />
                  </div>
                  <div className="dsh-wb-form-group">
                    <label className="dsh-wb-form-label">{t("fieldTaskDescription")}</label>
                    <textarea
                      className="dsh-wb-textarea"
                      rows={3}
                      value={draft.description}
                      onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    />
                  </div>
                  <div className="dsh-wb-form-group">
                    <label className="dsh-wb-form-label">{t("fieldSystemInstruction")}</label>
                    <textarea
                      className="dsh-wb-textarea dsh-wb-prompt-textarea"
                      rows={8}
                      value={draft.systemPrompt}
                      onChange={(e) => setDraft({ ...draft, systemPrompt: e.target.value })}
                    />
                  </div>
                  <div className="dsh-wb-form-group">
                    <label className="dsh-wb-form-label">{t("fieldAllowedTools")}</label>
                    <input
                      className="dsh-wb-input"
                      value={draft.toolsText}
                      placeholder={t("toolsHint")}
                      onChange={(e) => setDraft({ ...draft, toolsText: e.target.value })}
                    />
                    <p className="dsh-wb-form-desc">{t("toolsHint")}</p>
                  </div>
                  <p className="dsh-wb-preview-label">{t("promptPreview")}</p>
                  <pre className="dsh-wb-prompt-preview">{promptPreviewText(draft, t)}</pre>
                  <div className="dsh-wb-form-actions">
                    <button className="dsh-wb-btn dsh-wb-btn-primary" disabled={busy} onClick={save}>
                      {t("save")}
                    </button>
                    <button
                      className={`dsh-wb-btn dsh-wb-btn-secondary${resetArmed ? " dsh-wb-reset-confirm" : ""}`}
                      disabled={busy}
                      onClick={reset}
                    >
                      {resetArmed ? t("confirmReset") : t("resetDefault")}
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
