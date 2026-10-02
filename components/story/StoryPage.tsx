import Choreography from "@/components/Choreography";
import Loader from "@/components/Loader";
import Footer from "@/components/site/Footer";
import Rail from "@/components/site/Rail";
import Stage from "@/components/site/Stage";
import NextHandoff from "./NextHandoff";
import PrevHandoff from "./PrevHandoff";
import StoryScript from "./StoryScript";
import { PageHero, finaleLine } from "./screens";
import { STAGES } from "./scripts";
import { BRAND } from "@/lib/brand";
import { fill, type Dictionary, type Locale } from "@/lib/i18n";
import { neighbours, pagePath, type StoryPageId } from "@/lib/pages";

/**
 * A story page: its chapters (the children, ending before the finale), the
 * finale — the particle logo over the closing line and the footer — and the
 * hand-offs to the pages either side.
 */
export default function StoryPage({
  id,
  t,
  locale,
  rail,
  children,
}: {
  id: StoryPageId;
  t: Dictionary;
  locale: Locale;
  /** The rail's name for each stage (STAGES[id]). */
  rail: Record<string, string>;
  children: React.ReactNode;
}) {
  const { prev, next } = neighbours(id);
  const stages = STAGES[id];
  const end = stages[stages.length - 1];
  return (
    <>
      <StoryScript page={id} />
      <Choreography />
      <Loader label={fill(t.loading, { brand: BRAND.name })} />
      <Rail label={t.rail.label} stages={stages.map((s) => ({ id: s, label: rail[s] }))} />
      {prev && (
        <PrevHandoff
          page={id}
          prev={prev}
          href={`${pagePath(locale, prev)}#${STAGES[prev][STAGES[prev].length - 1]}`}
          label={fill(t.pages.scrollPrev, { page: t.pages.names[prev] })}
        >
          <Footer t={t.footer} disclaimer={t.disclaimer} tagline={finaleLine(prev, t)} />
        </PrevHandoff>
      )}

      <div data-page>
        <main id="story" data-hide-while-loading className="relative z-10">
          <Stage id={stages[0]} side="hero">
            <PageHero id={id} t={t} locale={locale} live />
          </Stage>
          {children}
          <Stage id={end} side="end">
            <Footer t={t.footer} disclaimer={t.disclaimer} tagline={finaleLine(id, t)} />
          </Stage>
        </main>
        {next && (
          <NextHandoff
            page={id}
            next={next}
            href={pagePath(locale, next)}
            label={`${t.pages.next} · ${t.pages.names[next]}`}
          >
            <PageHero id={next} t={t} locale={locale} />
          </NextHandoff>
        )}
      </div>
    </>
  );
}
