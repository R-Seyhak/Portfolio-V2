import { useSyncExternalStore } from 'react';

/**
 * Shared state for the page's single 3D canvas. It lives outside React so that
 * sections can use it without a provider, and without loading any 3D code.
 */
export interface SceneCanvasState {
  /** A section asked for 3D, so the canvas should load. */
  requested: boolean;
  /** WebGL stopped working, and every section should show its 2D version. */
  failed: boolean;
  /** Something is ready to be seen, so the canvas can fade in. */
  visible: boolean;
  /** At least one View is on screen. When false, nothing renders at all. */
  rendering: boolean;
}

const INITIAL: SceneCanvasState = { requested: false, failed: false, visible: false, rendering: false };

let state = INITIAL;
const listeners = new Set<() => void>();
const failureListeners = new Set<() => void>();
const activeViews = new Set<string>();

function update(patch: Partial<SceneCanvasState>) {
  const changed = (Object.keys(patch) as (keyof SceneCanvasState)[]).some(
    (key) => state[key] !== patch[key],
  );
  if (!changed) return;
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

export const requestSceneCanvas = () => update({ requested: true });
export const showSceneCanvas = () => update({ visible: true });

export function setViewActive(id: string, active: boolean) {
  if (active) activeViews.add(id);
  else activeViews.delete(id);
  update({ rendering: activeViews.size > 0 });
}

export function reportSceneFailure() {
  if (state.failed) return;
  update({ failed: true, visible: false, rendering: false });
  failureListeners.forEach((listener) => listener());
}

/** Runs when the canvas is lost. Returns a function that stops listening. */
export function onSceneFailure(listener: () => void) {
  if (state.failed) listener();
  failureListeners.add(listener);
  return () => {
    failureListeners.delete(listener);
  };
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useSceneCanvas = () => useSyncExternalStore(subscribe, () => state, () => INITIAL);
