/**
 * Toasts: short notices in the corner — a booking confirmed (with its
 * flight), something that went wrong, a flight that's coming up.
 * success = blue, warning = yellow (the site's warning colour), info = plain.
 */
export type ToastTone = "success" | "warning" | "info";
export type ToastDetail = { tone: ToastTone; title: string; body?: string; duration?: number };

export const TOAST_EVENT = "thanhhoang:toast";

export const TOAST_CLEAR = "thanhhoang:toast-clear";

/** Clears every toast on show (say, the code SMS once the code has been verified). */
export function clearToasts() {
  window.dispatchEvent(new Event(TOAST_CLEAR));
}

export function toast(tone: ToastTone, title: string, body?: string, duration?: number) {
  window.dispatchEvent(new CustomEvent<ToastDetail>(TOAST_EVENT, { detail: { tone, title, body, duration } }));
}
