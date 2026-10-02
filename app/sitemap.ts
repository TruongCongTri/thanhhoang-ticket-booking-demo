import type { MetadataRoute } from "next";
import { LOCALES } from "@/lib/i18n";
import { BUILT, pagePath, type StoryPageId } from "@/lib/pages";
import { SITE_URL } from "@/lib/site";

/** Every published page in both languages, each listing its other-language twin. */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages: (StoryPageId | "home")[] = ["home", ...BUILT];
  return pages.flatMap((page) =>
    LOCALES.map((locale) => ({
      url: `${SITE_URL}${pagePath(locale, page)}`,
      lastModified: new Date(),
      changeFrequency: page === "home" ? ("daily" as const) : ("monthly" as const),
      priority: page === "home" ? 1 : 0.7,
      alternates: { languages: Object.fromEntries(LOCALES.map((l) => [l, `${SITE_URL}${pagePath(l, page)}`])) },
    })),
  );
}
