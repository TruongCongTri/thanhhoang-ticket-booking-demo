/**
 * Light / dark. The choice lives on <html data-theme>, is remembered in
 * localStorage, and follows the system setting until someone picks one.
 * The 3D scene watches the attribute and recolours its particles.
 */
export type Theme = "dark" | "light";
export const THEME_KEY = "thanhhoang:theme";

/**
 * Runs in <head>, before first paint: the remembered theme, else the
 * system's, so the page never flashes the wrong one.
 */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t!=="light"&&t!=="dark")t=window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export function currentTheme(): Theme {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

export function setTheme(theme: Theme, remember = true) {
  document.documentElement.setAttribute("data-theme", theme);
  if (!remember) return;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // not remembered; fine for this visit
  }
}

export function savedTheme(): Theme | null {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "light" || t === "dark" ? t : null;
  } catch {
    return null;
  }
}

/** Calls `fn` whenever the theme changes (from the toggle, or the system while unset). */
export function onThemeChange(fn: (theme: Theme) => void): () => void {
  const obs = new MutationObserver(() => fn(currentTheme()));
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => obs.disconnect();
}
