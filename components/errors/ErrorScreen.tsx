"use client";

import { useEffect, useSyncExternalStore } from "react";
import { BRAND, CONTACT } from "@/lib/brand";
import { ERROR_COPY, localeOfPath } from "@/lib/error-copy";
import { fill, type Locale } from "@/lib/i18n";
import { pagePath } from "@/lib/pages";

/** The URL doesn't change while an error screen is up. */
const noSubscribe = () => () => {};

/** Deterministic "random" (the same field on every render, server and client). */
function rand(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}

/** The particles' triangles, scattered around the edges and clear in the middle (as the share card). */
const FIELD = (() => {
  const r = rand(404);
  const tris: { points: string; tone: number; opacity: number }[] = [];
  while (tris.length < 120) {
    const x = r() * 100;
    const y = r() * 100;
    if (((x - 50) / 34) ** 2 + ((y - 50) / 36) ** 2 < 1) continue;
    const s = 0.35 + r() ** 3 * 1.3;
    const a = r() * Math.PI * 2;
    const points = [0, 1, 2]
      .map((k) => {
        const t = a + (k * Math.PI * 2) / 3;
        return `${(x + Math.cos(t) * s).toFixed(2)},${(y + Math.sin(t) * s * 1.6).toFixed(2)}`;
      })
      .join(" ");
    tris.push({ points, tone: Math.floor(r() * 3), opacity: 0.2 + r() * 0.5 });
  }
  return tris;
})();
const TONES = ["var(--azure-fill)", "var(--saffron-fill)", "#f07a30"];

/**
 * The error and 404 screens: the logo, the code in large type, what happened,
 * and the ways on — home, try again, back, or call the hotline — over a still
 * field of the particles' triangles. Their language follows the URL (they can
 * render outside the page's layout, which would otherwise say).
 */
export default function ErrorScreen({
  kind,
  digest,
  onRetry,
}: {
  kind: "notFound" | "error";
  /** The server error's reference, to quote to support. */
  digest?: string;
  onRetry?: () => void;
}) {
  // the URL's language (Vietnamese in the server-rendered HTML)
  const locale = useSyncExternalStore<Locale>(
    noSubscribe,
    () => localeOfPath(window.location.pathname),
    () => "vi",
  );
  useEffect(() => {
    // Rendered inside the root layout, the page would wait under the loading
    // screen for a 3D scene that isn't here: start it now.
    document.documentElement.removeAttribute("data-loading");
  }, []);

  const t = ERROR_COPY[locale];
  const c = t[kind];
  const hotline = CONTACT.phones[0];
  return (
    <main className="error-screen" lang={locale}>
      <title>{`${c.code} · ${c.label} | ${BRAND.name}`}</title>
      <svg aria-hidden className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {FIELD.map((f, i) => (
          <polygon key={i} points={f.points} fill={TONES[f.tone]} fillOpacity={f.opacity} />
        ))}
      </svg>

      <a href={pagePath(locale, "home")} aria-label={t.home} className="absolute left-6 top-5 md:left-10">
        {/* eslint-disable-next-line @next/next/no-img-element -- may render outside Next's image setup (global error) */}
        <img src={BRAND.logo.src} alt={BRAND.name} width={BRAND.logo.width} height={BRAND.logo.height} className="h-11 w-auto md:h-12" />
      </a>

      <div className="relative mx-auto w-full max-w-[640px] px-6 text-center">
        <p className="t-label mb-4">{c.label}</p>
        <p aria-hidden className="error-code">
          {c.code}
        </p>
        <h1 className="t-heading mt-2">{c.title}</h1>
        <p className="t-body mx-auto mt-5 max-w-[480px] text-mist">{c.body}</p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <a href={pagePath(locale, "home")} className="btn-primary">
            {t.home}
          </a>
          {onRetry && (
            <button type="button" onClick={onRetry} className="btn-ghost">
              {t.retry}
            </button>
          )}
          <button type="button" onClick={() => history.back()} className="btn-ghost">
            {t.back}
          </button>
          <a href={`tel:${hotline.tel}`} className="btn-ghost">
            {fill(t.call, { phone: hotline.text })}
          </a>
        </div>
        {digest && (
          <p className="t-caption mt-8 text-ash">
            {t.ref}: <code>{digest}</code>
          </p>
        )}
      </div>
    </main>
  );
}
