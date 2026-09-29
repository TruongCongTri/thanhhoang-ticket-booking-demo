"use client";

import { useEffect } from "react";
import { currentTheme, savedTheme, setTheme } from "@/lib/theme";

/**
 * Sun / moon. Both icons are rendered and CSS shows the right one for the
 * current <html data-theme>, so nothing depends on client state at hydration.
 */
export default function ThemeToggle({ toLight, toDark }: { toLight: string; toDark: string }) {
  // Until someone picks a theme, follow the system as it changes.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => {
      if (!savedTheme()) setTheme(mq.matches ? "light" : "dark", false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <button
      type="button"
      onClick={() => setTheme(currentTheme() === "light" ? "dark" : "light")}
      className="theme-toggle"
      aria-label={`${toLight} / ${toDark}`}
    >
      {/* shown in dark mode: switch to light */}
      <span className="theme-icon theme-icon-sun" title={toLight}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" />
        </svg>
      </span>
      {/* shown in light mode: switch to dark */}
      <span className="theme-icon theme-icon-moon" title={toDark}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
        </svg>
      </span>
    </button>
  );
}
