import type { Locale } from "@/lib/i18n";

/**
 * The site's public address, for canonical links, the sitemap, social cards
 * and structured data. Set NEXT_PUBLIC_SITE_URL in production; on Vercel the
 * production domain is picked up on its own; locally it's the dev server.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
).replace(/\/$/, "");

/** Open Graph locale per language. */
export const OG_LOCALE: Record<Locale, string> = { vi: "vi_VN", en: "en_US" };

/** The language search engines get when none of the others match the visitor. */
export const X_DEFAULT: Locale = "vi";
