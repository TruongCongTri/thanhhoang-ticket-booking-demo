import { LOCALES, hasLocale, type Locale } from "@/lib/i18n";

/**
 * The company tour after the home page, in reading order: each page is one
 * scroll story, and the end of each hands over to the start of the next.
 */
export const STORY_PAGES = ["about", "organization", "services", "achievements"] as const;
export type StoryPageId = (typeof STORY_PAGES)[number];

/** Each page's path segment, per language. */
export const SLUGS: Record<StoryPageId, Record<Locale, string>> = {
  about: { vi: "gioi-thieu", en: "about" },
  organization: { vi: "to-chuc", en: "organization" },
  services: { vi: "dich-vu", en: "services" },
  achievements: { vi: "thanh-tuu", en: "achievements" },
};

/** Pages that are published; the others show in the menu as coming soon. */
export const BUILT: readonly StoryPageId[] = ["about", "organization"];

export const isBuilt = (id: StoryPageId) => BUILT.includes(id);

export const pagePath = (locale: Locale, id: StoryPageId | "home") =>
  id === "home" ? `/${locale}` : `/${locale}/${SLUGS[id][locale]}`;

export function pageFromSlug(locale: Locale, slug: string): StoryPageId | null {
  return STORY_PAGES.find((id) => SLUGS[id][locale] === slug) ?? null;
}

/** The story page a path shows, if any. */
export function pageFromPath(pathname: string): StoryPageId | null {
  const [, locale, slug] = pathname.split("/");
  if (!locale || !slug || !hasLocale(locale)) return null;
  return pageFromSlug(locale, slug);
}

/**
 * The pages either side in the tour, when they're published. The home page
 * is not part of the scroll tour: it's reached by link.
 */
export function neighbours(id: StoryPageId): { prev: StoryPageId | null; next: StoryPageId | null } {
  const i = STORY_PAGES.indexOf(id);
  const at = (j: number) => (j >= 0 && j < STORY_PAGES.length && isBuilt(STORY_PAGES[j]) ? STORY_PAGES[j] : null);
  return { prev: at(i - 1), next: at(i + 1) };
}

/** The same page in another language (the home page for anything else). */
export function localizePath(pathname: string, to: Locale): string {
  const page = pageFromPath(pathname);
  return page ? pagePath(to, page) : `/${to}`;
}

/** Every published story page, for static generation. */
export const builtParams = () =>
  LOCALES.flatMap((locale) => BUILT.map((id) => ({ locale, slug: SLUGS[id][locale] })));
