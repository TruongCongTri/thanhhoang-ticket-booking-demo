"use client";

import { LOCALES, LOCALE_COOKIE, type Locale } from "@/lib/i18n";

/** Remembered for the next visit to "/" (proxy.ts reads it). */
function remember(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * EN / VI. Switching keeps your place: it opens the other language at the
 * section you're reading, and remembers the choice for next time.
 */
export default function LocaleSwitch({ locale, label }: { locale: Locale; label: string }) {
  const go = (e: React.MouseEvent<HTMLAnchorElement>, to: Locale) => {
    e.preventDefault();
    if (to === locale) return;
    remember(to);
    const here = document.querySelector("[data-dot][data-active]")?.getAttribute("href") ?? window.location.hash;
    // A full load on purpose: the other language is its own root layout, and
    // the particle intro then gathers straight into this section's model.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/${to}${here}`);
  };
  return (
    <span role="group" aria-label={label} className="t-nav hidden text-ash sm:inline">
      {LOCALES.map((l, i) => (
        <span key={l}>
          {i > 0 && " / "}
          <a
            href={`/${l}`}
            hrefLang={l}
            lang={l}
            aria-current={l === locale ? "true" : undefined}
            onClick={(e) => go(e, l)}
            className={l === locale ? "text-azure" : "link-wave"}
          >
            {l.toUpperCase()}
          </a>
        </span>
      ))}
    </span>
  );
}
