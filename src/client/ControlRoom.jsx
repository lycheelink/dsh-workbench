/**
 * Control Room: session status monitoring grid. Shows all sessions with their
 * current status (running / awaiting_decision / completed / failed) and step
 * descriptions, plus a per-card delete action.
 *
 * Deletion removes the workbench's own session record only (the real host
 * session, if any, is left in the conversation list). Active sessions
 * (running / awaiting_decision / created) require a two-step inline confirm
 * before the record is removed; terminal states delete on the first click.
 */
import * as React from "react";

const STATUS_CONFIG = {
  created: {
    icon: "◌",
    label: "statusCreated",
    color: "var(--dsw-alias-label-secondary, #656d76)"
  },
  running: {
    icon: "●",
    label: "statusRunning",
    color: "var(--dsw-alias-brand, #2d6cdf)"
  },
  awaiting_decision: {
    icon: "○",
    label: "statusAwaiting",
    color: "var(--dsw-alias-warning, #d97706)"
  },
  completed: {
    icon: "✓",
    label: "statusCompleted",
    color: "var(--dsw-alias-success, #2e9e5b)"
  },
  failed: {
    icon: "✕",
    label: "statusFailed",
    color: "var(--dsw-alias-danger, #dc3545)"
  }
};

const STATUS_ORDER = ["created", "running", "awaiting_decision", "completed", "failed"];

/** States where deleting a still-active record warrants a confirmation step. */
const ACTIVE_STATUSES = new Set(["created", "running", "awaiting_decision"]);

export function ControlRoom({ sessions, t, onBack, onDelete }) {
  // sessionId awaiting a second delete click (two-step confirm for active states)
  const [confirmingId, setConfirmingId] = React.useState(null);
  // Auto-reset a pending confirmation after a moment of inactivity.
  React.useEffect(() => {
    if (confirmingId === null) return;
    const timer = setTimeout(() => setConfirmingId(null), 4000);
    return () => clearTimeout(timer);
  }, [confirmingId]);

  // Sort: running first, then awaiting, completed, failed
  const sorted = [...sessions].sort((a, b) => {
    const oa = STATUS_ORDER.indexOf(a.status);
    const ob = STATUS_ORDER.indexOf(b.status);
    return oa - ob || b.createdAt.localeCompare(a.createdAt);
  });

  const handleDeleteClick = (session) => {
    if (!onDelete) return;
    if (ACTIVE_STATUSES.has(session.status) && confirmingId !== session.sessionId) {
      setConfirmingId(session.sessionId);
      return;
    }
    setConfirmingId(null);
    onDelete(session.sessionId);
  };

  return (
    <div className="dsh-wb-control-room" data-dsh-workbench-control-room="true">
      <div className="dsh-wb-control-room-header">
        <button type="button" className="dsh-wb-back-btn" onClick={onBack}>
          ← {t("back")}
        </button>
        <span className="dsh-wb-control-room-title">{t("controlRoomTitle")}</span>
      </div>
      <p className="dsh-wb-control-room-hint">{t("controlRoomHint")}</p>

      <div className="dsh-wb-control-room-grid">
        {sorted.map((session) => {
          const cfg = STATUS_CONFIG[session.status] ?? STATUS_CONFIG.running;
          const confirming = confirmingId === session.sessionId;
          return (
            <div key={session.sessionId} className="dsh-wb-session-card">
              <div className="dsh-wb-session-status-row">
                <span
                  className="dsh-wb-session-status-dot"
                  style={{ color: cfg.color }}
                >
                  {cfg.icon}
                </span>
                <span className="dsh-wb-session-status-label" style={{ color: cfg.color }}>
                  {t(cfg.label)}
                </span>
                {onDelete && (
                  <button
                    type="button"
                    className={`dsh-wb-session-delete${confirming ? " dsh-wb-session-delete-confirm" : ""}`}
                    onClick={() => handleDeleteClick(session)}
                    title={confirming ? t("confirmDelete") : t("delete")}
                  >
                    {confirming ? t("confirmDelete") : t("delete")}
                  </button>
                )}
              </div>
              <div className="dsh-wb-session-card-title">
                {session.cardTitle ?? session.cardId}
              </div>
              {session.stepDescription && (
                <div className="dsh-wb-session-step">{session.stepDescription}</div>
              )}
              <div className="dsh-wb-session-time">
                {new Date(session.createdAt).toLocaleString("zh-CN", {
                  month: "numeric",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit"
                })}
              </div>
            </div>
          );
        })}
      </div>

      {sorted.length === 0 && (
        <div className="dsh-wb-empty">{t("controlRoomEmpty")}</div>
      )}
    </div>
  );
}
