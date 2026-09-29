import en from "@/dictionaries/en.json";
import vi from "@/dictionaries/vi.json";
import type { Dictionary, Locale } from "@/lib/i18n";

// Typed against the English dictionary, so a missing Vietnamese string fails
// the build. Server-only: pages hand client components just the part they need.
const dictionaries: Record<Locale, Dictionary> = { en, vi };

export const getDictionary = (locale: Locale): Dictionary => dictionaries[locale];
