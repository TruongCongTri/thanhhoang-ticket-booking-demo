import type en from "@/dictionaries/en.json";

/** Languages the site is published in; each lives under its own /[locale] path. */
export const LOCALES = ["vi", "en"] as const;
export type Locale = (typeof LOCALES)[number];
/** For visitors whose browser asks for neither. */
export const DEFAULT_LOCALE: Locale = "vi";
/** Remembers a language picked with the switcher (read by proxy.ts). */
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** Every dictionary has the shape of the English one. */
export type Dictionary = typeof en;
export type Plural = { one: string; other: string };

export const hasLocale = (value: string): value is Locale => (LOCALES as readonly string[]).includes(value);

/** BCP 47 tag for dates and numbers. */
export const intlLocale = (locale: Locale) => (locale === "vi" ? "vi-VN" : "en-GB");

/** Fills `{name}` placeholders. */
export function fill(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** Picks the singular or plural form for n, and fills `{n}` (plus any other vars). */
export function plural(forms: Plural, n: number, vars: Record<string, string | number> = {}): string {
  return fill(n === 1 ? forms.one : forms.other, { n, ...vars });
}
