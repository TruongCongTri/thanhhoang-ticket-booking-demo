import { fill, type Dictionary, type Locale } from "@/lib/i18n";
import { BRAND } from "@/lib/brand";
import type { StoryPageId } from "@/lib/pages";

/**
 * A story page's first screen (its hero copy) and its last (the closing line
 * over the footer). The page draws them, and so do the hand-offs from the
 * pages either side — the same markup, so the route change is invisible.
 *
 * `live`: on the page itself, the copy carries its entrance animations;
 * inside a hand-off it's drawn still.
 */
export function PageHero({ id, t, live = false }: { id: StoryPageId; t: Dictionary; locale: Locale; live?: boolean }) {
  const fade = (delay: number) => (live ? { "data-fade": "hero", "data-delay": String(delay) } : {});
  const split = live ? { "data-split": "hero" } : {};
  const Title = live ? "h1" : "p";

  if (id === "organization") {
    const h = t.organization.hero;
    return (
      <>
        <p {...fade(0.2)} className="t-label mb-6">
          {h.label}
        </p>
        <Title {...split} className="t-display">
          {h.title}
        </Title>
        <p {...fade(0.6)} className="t-body mt-8 max-w-[480px] text-white">
          {h.body}
        </p>
      </>
    );
  }

  // about (and, until they're written, the pages still to come)
  const h = t.about.hero;
  return (
    <>
      <p {...fade(0.2)} className="t-label mb-6">
        {id === "about" ? h.label : t.pages.names[id]}
      </p>
      <Title {...split} className="t-display">
        {id === "about" ? h.title : t.pages.soon}
      </Title>
      {id === "about" && (
        <>
          <p {...fade(0.6)} className="t-body mt-8 max-w-[480px] text-white">
            {h.body}
          </p>
          <p {...fade(0.8)} className="t-caption mt-8 hidden max-w-[480px] text-ash md:block">
            {h.company} · {h.taxLabel} {h.tax}
          </p>
        </>
      )}
    </>
  );
}

/** A page's closing line, shown in the footer under the particle logo. */
export function finaleLine(id: StoryPageId, t: Dictionary) {
  const f = id === "organization" ? t.organization.finale : t.about.finale;
  return fill(f.title, { brand: BRAND.name });
}
