import Link from "next/link";
import { notFound } from "next/navigation";
import Scene from "@/components/scene/LazyScene";
import Choreography from "@/components/Choreography";
import BookingDock from "@/components/BookingDock";
import Loader from "@/components/Loader";
import Toaster from "@/components/Toaster";
import RouteList from "@/components/RouteList";
import { AIRLINES, DOMESTIC_AIRPORTS, INTERNATIONAL_POPULAR, POPULAR_ROUTES } from "@/lib/flights";
import { BRAND } from "@/lib/brand";
import { pagePath } from "@/lib/pages";
import Header from "@/components/site/Header";
import Footer from "@/components/site/Footer";
import Rail from "@/components/site/Rail";
import Stage from "@/components/site/Stage";
import ContactButtons from "@/components/ContactButtons";
import { fill, hasLocale, intlLocale } from "@/lib/i18n";
import { getDictionary } from "./dictionaries";

/** The story's sections, top to bottom (the rail on the right links to each). */
const STAGES = ["top", "search", "airlines", "routes", "international", "ticket", "thanh-hoang"] as const;

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();
  const t = getDictionary(locale);
  const brand = { brand: BRAND.name };

  return (
    <>
      <Scene labels={t.archipelagos} />
      <Choreography />
      <Loader label={fill(t.loading, brand)} />
      <Header
        t={t.nav}
        pages={t.pages}
        locale={locale}
        home="#top"
        links={(["airlines", "routes", "international", "ticket"] as const).map((id) => ({ href: `#${id}`, label: t.nav.links[id] }))}
      />
      <Rail label={t.rail.label} stages={STAGES.map((id) => ({ id, label: t.rail.stages[id] }))} />

      <main id="story" data-hide-while-loading className="relative z-10">
        {/* 0 · Plane */}
        <Stage id="top" side="hero">
          <p data-fade="hero" data-delay="0.2" className="t-label mb-6">
            {t.hero.label}
          </p>
          <h1 data-split="hero" className="t-display">
            {t.hero.title}
          </h1>
          <p data-fade="hero" data-delay="0.6" className="t-body mt-8 max-w-[480px] text-white">
            {fill(t.hero.body, brand)}
          </p>
          <a
            data-fade="hero"
            data-delay="0.8"
            href="#search"
            className="link-wave t-nav mt-10 inline-flex items-center gap-3 text-ash"
          >
            {t.hero.cta} <span aria-hidden>↓</span>
          </a>
        </Stage>

        {/* 1 · No model: the plane dissolves into the open sky */}
        <Stage id="search" side="middle">
          <p data-fade className="t-label mb-6">
            {t.search.label}
          </p>
          <h2 data-split className="t-heading-lg">
            {t.search.title}
          </h2>
          <p data-fade className="t-body mx-auto mt-8 max-w-[480px] text-mist">
            {fill(t.search.body, brand)}
          </p>
          <dl data-fade className="mx-auto mt-12 grid max-w-[520px] grid-cols-3 gap-6">
            {(
              [
                [AIRLINES.length, "", t.search.stats.airlines],
                [DOMESTIC_AIRPORTS.length, "", t.search.stats.airports],
                [1400, "+", t.search.stats.flights],
              ] as const
            ).map(([n, suffix, label]) => (
              <div key={label} className="flex flex-col">
                <dt className="t-caption order-2 mt-2 uppercase tracking-[0.05em] text-ash">{label}</dt>
                <dd data-count={n} data-suffix={suffix} className="t-heading -order-1 tabular-nums">
                  {n.toLocaleString(intlLocale(locale))}
                  {suffix}
                </dd>
              </div>
            ))}
          </dl>
        </Stage>

        {/* 2 · Still sky; Vietnam gathers from the south */}
        <Stage id="airlines" side="middle">
          <p data-fade className="t-label mb-6">
            {t.airlines.label}
          </p>
          <h2 data-split className="t-heading-lg">
            {t.airlines.title}
          </h2>
          <p data-fade className="t-body mx-auto mt-8 max-w-[480px] text-mist">
            {fill(t.airlines.body, brand)}
          </p>
          <ul data-fade className="mx-auto mt-10 grid max-w-[560px] grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
            {AIRLINES.map((a) => (
              <li key={a.code} className="flex items-baseline justify-center gap-3">
                <span className="t-caption w-6 text-azure">{a.code}</span>
                <span className="text-[18px] font-extralight md:text-[20px]">{a.name}</span>
              </li>
            ))}
          </ul>
        </Stage>

        {/* 3 · Vietnam and its domestic flights — narrow: Hoàng Sa and Trường Sa reach toward the middle */}
        <Stage id="routes" side="right" narrow>
          <p data-fade className="t-label mb-6">
            {t.routes.label}
          </p>
          <h2 data-split className="t-heading-lg">
            {t.routes.title}
          </h2>
          <p data-fade className="t-body mt-6 hidden max-w-[480px] text-mist md:block">
            {fill(t.routes.body, { count: DOMESTIC_AIRPORTS.length })}
          </p>
          <div data-fade>
            <RouteList routes={POPULAR_ROUTES} t={t.routeList} />
          </div>
        </Stage>

        {/* 4 · The globe, South-East Asia turning forward, and international flights */}
        <Stage id="international" side="left" narrow>
          <p data-fade className="t-label mb-6">
            {t.international.label}
          </p>
          <h2 data-split className="t-heading-lg">
            {t.international.title}
          </h2>
          <p data-fade className="t-body mt-6 hidden max-w-[480px] text-mist md:block">
            {t.international.body}
          </p>
          <div data-fade>
            <RouteList routes={INTERNATIONAL_POPULAR} t={t.routeList} />
          </div>
        </Stage>

        {/* 5 · Boarding pass */}
        <Stage id="ticket" side="right">
          <p data-fade className="t-label mb-6">
            {t.ticket.label}
          </p>
          <h2 data-split className="t-heading-lg">
            {t.ticket.title}
          </h2>
          <p data-fade className="t-body mt-8 max-w-[480px] text-mist">
            {t.ticket.body}
          </p>
          <ol data-fade className="mt-12 grid max-w-[520px] grid-cols-3 gap-6">
            {t.ticket.steps.map(({ title, sub }, i) => (
              <li key={title}>
                <span className="t-caption text-saffron">{String(i + 1).padStart(2, "0")}</span>
                <span className="t-heading-2xs mt-1 block">{title}</span>
                <span className="t-caption mt-1 block text-ash">{sub}</span>
              </li>
            ))}
          </ol>
        </Stage>

        {/* 6 · The company logo, drawn in particles above the footer */}
        <Stage id="thanh-hoang" side="end">
          <Footer t={t.footer} disclaimer={t.disclaimer}>
            {/* On to the company pages: the start of the scroll tour */}
            <p className="mt-6">
              <span className="t-label block">{t.homeAbout.label}</span>
              <Link
                href={pagePath(locale, "about")}
                className="link-wave t-nav mt-3 inline-flex items-center gap-3 text-white"
              >
                {t.homeAbout.cta} <span aria-hidden>→</span>
              </Link>
            </p>
          </Footer>
        </Stage>
      </main>

      <BookingDock strings={{ dock: t.dock, checkout: t.checkout, trips: t.trips, pass: t.pass }} locale={locale} />
      <Toaster dismissLabel={t.toast.dismiss} />
      <ContactButtons t={t.contact} />
    </>
  );
}
