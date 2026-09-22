/**
 * WorkbenchPanel: the full-page Enterprise Agent Workbench, rendered as a
 * chrome-less layer that exactly covers the DSH center column (and the details
 * column with it) while the sidebar stays interactive. This is a page — not a
 * popup drawer: it has no shadow, border or shrink of the underlying layout,
 * and the conversation tree beneath stays mounted (its state is preserved).
 *
 * The component is always mounted; `ui.open` only toggles CSS visibility so
 * in-flight form input and the control-room scroll position survive switching
 * to a session and back.
 *
 * Hosts three views: card grid, dynamic form, control room. Launching a card
 * closes the page and jumps the conversation column to the spawned session.
 */
import * as React from "react";
import { CardGrid } from "./CardGrid.jsx";
import { DynamicForm } from "./DynamicForm.jsx";
import { ControlRoom } from "./ControlRoom.jsx";
import { ArtifactCard } from "./ArtifactCard.jsx";
import { ARTIFACTS } from "./artifacts.js";
import { ensureWorkbenchStyles } from "./styles.js";
import { missingRequiredFields } from "../conditions.js";
import {
  useWorkbenchSnapshot,
  workbenchSetOpen,
  workbenchSetView,
  workbenchOpenCard,
  workbenchResetToGrid,
  workbenchSetError,
  workbenchSetCards,
  workbenchSetSessions
} from "./store.js";

const SIDEBAR_COL_SELECTOR = '[class*="sidebarCol"]';

const VIEW_TITLES = {
  grid: "gridTitle",
  form: "formTitle",
  "control-room": "controlRoomTitle"
};

export function WorkbenchPanel({ api, t, openSession }) {
  const ui = useWorkbenchSnapshot();
  const [sidebarWidth, setSidebarWidth] = React.useState(0);

  // Inject styles once.
  React.useEffect(() => { ensureWorkbenchStyles(); }, []);

  // While the page is open the covered conversation/details columns are made
  // invisible (state preserved, but removed from the a11y tree and keyboard
  // order) so Tab/ATs never reach inputs hidden underneath the page.
  React.useEffect(() => {
    if (ui.open) {
      document.documentElement.setAttribute("data-dsh-workbench-page-open", "");
    } else {
      document.documentElement.removeAttribute("data-dsh-workbench-page-open");
    }
  }, [ui.open]);

  // Track the sidebar column width so the page always starts at its right edge
  // (drag-resize and collapse/expand included). Re-query on every open in case
  // the host re-rendered the column element.
  React.useEffect(() => {
    const col = document.querySelector(SIDEBAR_COL_SELECTOR);
    if (!col || typeof ResizeObserver === "undefined") return;
    const update = () => setSidebarWidth(col.getBoundingClientRect().width);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(col);
    return () => observer.disconnect();
  }, [ui.open]);

  const [formData, setFormData] = React.useState({});
  // Artifact-format cards report { json, ready } over the bridge; the console
  // itself is the authority on completeness (its 必填完成度 meter).
  const [artifactState, setArtifactState] = React.useState(null);
  const [launching, setLaunching] = React.useState(false);
  const [launchError, setLaunchError] = React.useState(null);

  const activeCard = React.useMemo(
    () => ui.cards.find((c) => c.id === ui.activeCardId) ?? null,
    [ui.cards, ui.activeCardId]
  );

  // Load cards on mount.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { cards } = await api.listCards();
        if (!cancelled) workbenchSetCards(cards);
      } catch (error) {
        if (!cancelled) workbenchSetError(String(error.message ?? error));
      }
    })();
    return () => { cancelled = true; };
  }, [api]);

  // Refresh sessions when entering control room.
  React.useEffect(() => {
    if (ui.view !== "control-room") return;
    let cancelled = false;
    (async () => {
      try {
        const { sessions } = await api.listSessions();
        if (!cancelled) workbenchSetSessions(sessions);
      } catch (error) {
        if (!cancelled) workbenchSetError(String(error.message ?? error));
      }
    })();
    return () => { cancelled = true; };
  }, [api, ui.view]);

  // Reset form data when a different card is opened.
  React.useEffect(() => {
    setFormData({});
    setArtifactState(null);
    setLaunchError(null);
  }, [ui.activeCardId]);

  // Determine required-field completeness for the Launch button. Artifact
  // cards are gated by the console's bridge `ready` flag (and must have
  // posted at least one state so we never enable before first paint).
  const canLaunch = React.useMemo(() => {
    if (!activeCard) return false;
    if (ARTIFACTS[activeCard.id]) return !!artifactState?.ready;
    return missingRequiredFields(activeCard, formData).length === 0;
  }, [activeCard, formData, artifactState]);

  const handleLaunch = async () => {
    if (!activeCard || !canLaunch || launching) return;
    setLaunching(true);
    setLaunchError(null);
    try {
      // Artifact cards launch with the console's structured SKILL input under
      // formData.perfConfig; the host treats it as the user-input block.
      const payload = ARTIFACTS[activeCard.id]
        ? { perfConfig: artifactState?.json }
        : formData;
      const { session } = await api.launchCardSession(activeCard.id, payload);
      // Refresh the control-room list and jump the conversation to the real
      // spawned session, then land back on a clean grid next time.
      try {
        const { sessions } = await api.listSessions();
        workbenchSetSessions(sessions);
      } catch { /* control room is best-effort */ }
      workbenchResetToGrid();
      workbenchSetOpen(false);
      if (session?.sessionId && typeof openSession === "function") {
        openSession(session.sessionId);
      }
    } catch (error) {
      setLaunchError(String(error.message ?? error));
    } finally {
      setLaunching(false);
    }
  };

  const handleDeleteSession = async (sessionId) => {
    try {
      await api.deleteSession(sessionId);
    } catch (error) {
      // A record that is already gone is as good as deleted (double-click or
      // a concurrent removal); only surface unexpected failures.
      if (error?.code !== "session-not-found") {
        workbenchSetError(String(error.message ?? error));
      }
    }
    try {
      const { sessions } = await api.listSessions();
      workbenchSetSessions(sessions);
    } catch { /* control room is best-effort */ }
  };

  return (
    <div
      className="dsh-wb-page"
      data-dsh-workbench-page="true"
      aria-hidden={!ui.open}
      style={{
        display: ui.open ? "flex" : "none",
        left: sidebarWidth
      }}
    >
      <div className="dsh-wb-page-header">
        <span className="dsh-wb-panel-title">{t("panelTitle")}</span>
        <div className="dsh-wb-nav">
          <button
            type="button"
            className={`dsh-wb-nav-btn${ui.view === "grid" ? " dsh-wb-nav-btn-active" : ""}`}
            onClick={() => workbenchSetView("grid")}
          >
            {t("gridTitle")}
          </button>
          <button
            type="button"
            className={`dsh-wb-nav-btn${ui.view === "control-room" ? " dsh-wb-nav-btn-active" : ""}`}
            onClick={() => workbenchSetView("control-room")}
          >
            {t("controlRoomTitle")}
          </button>
          <button
            type="button"
            className="dsh-wb-nav-btn dsh-wb-close-btn"
            onClick={() => workbenchSetOpen(false)}
            title={t("closeWorkbench")}
          >✕</button>
        </div>
      </div>

      <div className="dsh-wb-page-body">
        {ui.view === "grid" && (
          <CardGrid
            cards={ui.cards}
            t={t}
            onOpenCard={(cardId) => workbenchOpenCard(cardId)}
          />
        )}

        {ui.view === "form" && activeCard && (
          <div className={"dsh-wb-form-view" + (ARTIFACTS[activeCard.id] ? " dsh-wb-form-view--artifact" : "")}>
            <button
              type="button"
              className="dsh-wb-back-btn"
              onClick={() => workbenchSetView("grid")}
            >
              ← {t("back")}
            </button>
            <h3 className="dsh-wb-form-title">{activeCard.title}</h3>
            <p className="dsh-wb-form-subtitle">{t("formSubtitle")}</p>
            {ARTIFACTS[activeCard.id] ? (
              <ArtifactCard
                html={ARTIFACTS[activeCard.id]}
                onState={setArtifactState}
                onLaunch={handleLaunch}
                title={activeCard.title}
              />
            ) : (
              <DynamicForm
                card={activeCard}
                formData={formData}
                setFormData={setFormData}
                t={t}
              />
            )}
            {launchError && <div className="dsh-wb-error">{launchError}</div>}
            {/* Artifact cards own their launch via the console's「启动寻优」button
                (bridged over postMessage); the shell keeps only 取消 here. */}
            {!ARTIFACTS[activeCard.id] && (
              <div className="dsh-wb-form-actions">
                <button
                  type="button"
                  className="dsh-wb-btn dsh-wb-btn-secondary"
                  onClick={() => workbenchSetView("grid")}
                >
                  {t("cancel")}
                </button>
                <button
                  type="button"
                  className="dsh-wb-btn dsh-wb-btn-primary"
                  disabled={!canLaunch || launching}
                  onClick={handleLaunch}
                >
                  {launching ? t("loading") : t("launch")}
                </button>
              </div>
            )}
          </div>
        )}

        {ui.view === "control-room" && (
          <ControlRoom
            sessions={ui.sessions}
            t={t}
            onBack={() => workbenchSetView("grid")}
            onDelete={handleDeleteSession}
          />
        )}
      </div>
    </div>
  );
}
