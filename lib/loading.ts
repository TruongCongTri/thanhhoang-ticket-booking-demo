/**
 * Page-load handshake between the loader, the 3D scene and the page
 * choreography:
 * - `progress` (detail 0..1) as the scene builds its particles,
 * - `ready` when the scene can play,
 * - `start` once the page has jumped to any #section and is shown — the
 *   particles then gather into whatever that spot calls for.
 * Until `start`, <html> carries `data-loading`.
 */
export const LOAD = {
  progress: "thanhhoang:load-progress",
  ready: "thanhhoang:load-ready",
  start: "thanhhoang:load-start",
} as const;

/** Runs `fn` once the page has started (straight away if it already has). */
export function onPageStart(fn: () => void): () => void {
  if (!document.documentElement.hasAttribute("data-loading")) {
    fn();
    return () => {};
  }
  window.addEventListener(LOAD.start, fn, { once: true });
  return () => window.removeEventListener(LOAD.start, fn);
}
