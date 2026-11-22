import { useSyncExternalStore } from 'react';
import type { LoaderTask } from './loader.config';

interface SiteLoaderApi {
  revealed: boolean;
  /** The model download the loader started, if any. */
  model: Promise<ArrayBuffer> | null;
  cancelModel: () => void;
  /** A task's real progress (0..1), or null if its size is unknown. */
  progress: (task: LoaderTask, fraction: number | null) => void;
  done: (...tasks: LoaderTask[]) => void;
  onReveal: (callback: () => void) => () => void;
}

declare global {
  interface Window {
    __siteLoader?: SiteLoaderApi;
  }
}

const loader = () => (typeof window === 'undefined' ? undefined : window.__siteLoader);

export const loaderProgress = (task: LoaderTask, fraction: number | null) =>
  loader()?.progress(task, fraction);

export const loaderDone = (...tasks: LoaderTask[]) => loader()?.done(...tasks);

export const isSiteRevealed = () => loader()?.revealed ?? true;

/** Hands over the loader's model download once, so it is never fetched twice. */
export function takeModelDownload() {
  const api = loader();
  const download = api?.model ?? null;
  if (api) api.model = null;
  return download;
}

export const cancelModelDownload = () => loader()?.cancelModel();

const subscribe = (callback: () => void) => loader()?.onReveal(callback) ?? (() => undefined);

/** True once the loading screen has started to fade away. */
export function useSiteRevealed() {
  return useSyncExternalStore(subscribe, isSiteRevealed, () => false);
}
