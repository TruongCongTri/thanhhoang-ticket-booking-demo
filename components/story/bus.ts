import type { StoryPageId } from "@/lib/pages";

/**
 * Shared state between the story pages and the particle scene, which lives in
 * their common layout and outlasts each page:
 * - `page`: the page on screen; the scene plays its script against #story;
 * - `override`: a morph that isn't the page's own scroll — the hand-off into
 *   the next page, back into the previous one, or a jump to a page picked
 *   from the menu. `t` 0..1; it stays up (at 1) across the route change until
 *   the new page's own scroll timeline shows the same thing, then the scene
 *   clears it.
 * - `hover`: the group the pointer is over (the org chart), and where.
 * - `lit`: per model that lights its groups in turn as its chapter scrolls
 *   by (the core values), the group lit right now — so the copy beside it
 *   shows the same one.
 */
export type FrameRef = { page: StoryPageId; index: number | "last" | "here" };
export type Override = { from: FrameRef; to: FrameRef; t: number };
export type Hover = { page: StoryPageId; group: number; x: number; y: number; top: number } | null;

type Listener = () => void;

/** A hover target on screen (CSS px): its centre, radius, and how far it has been revealed (0..1). */
export type ScreenNode = { group: number; x: number; y: number; r: number; shown: number };

let page: StoryPageId | null = null;
let nodes: { page: StoryPageId; list: ScreenNode[] } | null = null;
let override: Override | null = null;
let hover: Hover = null;
const pageListeners = new Set<Listener>();
const hoverListeners = new Set<Listener>();
// Kept on the window, not in this module: if the module is ever loaded twice
// (a hot reload in development), the scene and the copy still share one.
const shared = globalThis as typeof globalThis & {
  __thStoryLit?: { lit: Map<string, number>; listeners: Set<Listener> };
};
shared.__thStoryLit ??= { lit: new Map(), listeners: new Set() };
const lit = shared.__thStoryLit.lit;
const litListeners = shared.__thStoryLit.listeners;

export const storyBus = {
  get page() {
    return page;
  },
  setPage(next: StoryPageId | null) {
    if (next === page) return;
    page = next;
    pageListeners.forEach((l) => l());
  },
  onPage(l: Listener) {
    pageListeners.add(l);
    return () => void pageListeners.delete(l);
  },

  get override() {
    return override;
  },
  /** A morph driven from outside the page's scroll; null (or t = 0) hands back to the scroll. */
  setOverride(next: Override | null) {
    override = next && next.t > 0 ? next : null;
  },

  /** Where a model's hover targets are on screen right now (refreshed every frame; read it from a ticker). */
  get nodes() {
    return nodes;
  },
  setNodes(next: { page: StoryPageId; list: ScreenNode[] } | null) {
    nodes = next;
  },

  get hover() {
    return hover;
  },
  setHover(next: Hover) {
    if (next?.group === hover?.group && next?.page === hover?.page) {
      hover = next;
      return;
    }
    hover = next;
    hoverListeners.forEach((l) => l());
  },
  onHover(l: Listener) {
    hoverListeners.add(l);
    return () => void hoverListeners.delete(l);
  },

  /** The group a scroll-lit model has lit (1-based; 0 before the first). */
  litOf(model: string) {
    return lit.get(model) ?? 0;
  },
  setLit(model: string, group: number) {
    if (lit.get(model) === group) return;
    lit.set(model, group);
    litListeners.forEach((l) => l());
  },
  onLit(l: Listener) {
    litListeners.add(l);
    return () => void litListeners.delete(l);
  },
};

/**
 * Marks the next route change as seamless: the destination's first screen is
 * already showing (the hand-off draws it in place), so its entrance is skipped.
 * A short time window rather than a one-shot flag, so a page whose effects
 * run twice (React's development mode) still sees it.
 */
let seamlessAt = -Infinity;
export const markSeamless = () => {
  seamlessAt = performance.now();
};
export const isSeamless = () => performance.now() - seamlessAt < 2000;

/** Asks the page's smooth scrolling (Choreography) to stop: a hand-off is completing. */
export const HALT_SCROLL = "thanhhoang:halt-scroll";
export const haltScroll = () => window.dispatchEvent(new Event(HALT_SCROLL));
