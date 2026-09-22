/**
 * Workbench UI state: panel open/close, active card, form values, and session
 * list. Uses the DSH `useSyncExternalStore`-style snapshot pattern.
 */
import { useSyncExternalStore } from "react";

let listeners = [];
let snapshot = {
  open: false,
  activeCardId: null,
  view: "grid", // 'grid' | 'form' | 'control-room'
  sessions: [],
  cards: [],
  loadingCards: false,
  loadingSessions: false,
  error: null
};

export function getWorkbenchSnapshot() {
  return snapshot;
}

function emit() {
  for (const listener of listeners) listener();
}

function setSnapshot(patch) {
  snapshot = { ...snapshot, ...patch };
  emit();
}

export function workbenchSetOpen(open) {
  setSnapshot({ open });
}

/**
 * Return to the scene-card grid after a successful launch: clear the active
 * card (its form state resets when WorkbenchPanel re-opens a different card)
 * and land back on the grid view.
 */
export function workbenchResetToGrid() {
  setSnapshot({ activeCardId: null, view: "grid", error: null });
}

export function workbenchSetView(view) {
  setSnapshot({ view });
}

export function workbenchOpenCard(cardId) {
  setSnapshot({ activeCardId: cardId, view: "form" });
}

export function workbenchSetSessions(sessions) {
  setSnapshot({ sessions });
}

export function workbenchSetCards(cards) {
  setSnapshot({ cards });
}

export function workbenchSetLoadingCards(loadingCards) {
  setSnapshot({ loadingCards });
}

export function workbenchSetLoadingSessions(loadingSessions) {
  setSnapshot({ loadingSessions });
}

export function workbenchSetError(error) {
  setSnapshot({ error });
}

export function useWorkbenchSnapshot() {
  return useSyncExternalStore(
    (onStoreChange) => {
      listeners.push(onStoreChange);
      return () => {
        listeners = listeners.filter((l) => l !== onStoreChange);
      };
    },
    () => snapshot
  );
}