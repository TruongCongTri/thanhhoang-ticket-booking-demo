import Image from "next/image";
import { notFound } from "next/navigation";
import Scene from "@/components/scene/Scene";
import Choreography from "@/components/Choreography";
import BookingDock from "@/components/BookingDock";
import Loader from "@/components/Loader";
import LocaleSwitch from "@/components/LocaleSwitch";
import MyTripsLink from "@/components/MyTripsLink";
import Toaster from "@/components/Toaster";
import ThemeToggle from "@/components/ThemeToggle";
import Disclaimer from "@/components/Disclaimer";
import RouteList from "@/components/RouteList";
import { AIRLINES, DOMESTIC_AIRPORTS, INTERNATIONAL_POPULAR, POPULAR_ROUTES } from "@/lib/flights";
import { AUTHOR, BRAND, CONTACT } from "@/lib/brand";
import ContactButtons from "@/components/ContactButtons";
import { fill, hasLocale, intlLocale, type Dictionary, type Locale } from "@/lib/i18n";
import { getDictionary } from "./dictionaries";

/** The story's sections, top to bottom (the rail on the right links to each). */
const STAGES = ["top", "search", "airlines", "routes", "international", "ticket", "thanh-hoang"] as const;

/** The logo file is already loaded by the loading screen, so every copy loads eagerly. */
function Logo({ className }: { className: string }) {
  return (
    <Image
      src={BRAND.logo.src}
      width={BRAND.logo.width}
      height={BRAND.logo.height}
      alt={BRAND.name}
      loading="eager"
      className={`w-auto ${className}`}
    />
  );
}

function Nav({ t, locale }: { t: Dictionary["nav"]; locale: Locale }) {
  return (
    <header data-nav data-hide-while-loading className="fixed inset-x-0 top-0 z-40">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-5 md:px-10">
        <a href="#top" aria-label={fill(t.home, { brand: BRAND.name })}>
          <Logo className="h-11 md:h-12" />
        </a>
        <nav className="hidden items-center gap-9 lg:flex" aria-label={t.primary}>
          {(["airlines", "routes", "international", "ticket"] as const).map((id) => (
            <a key={id} href={`#${id}`} className="link-wave t-nav text-ash">
              {t.links[id]}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-6">
          <LocaleSwitch locale={locale} label={t.language} />
          <ThemeToggle toLight={t.toLight} toDark={t.toDark} />
          <MyTripsLink label={t.myTrips} />
        </div>
      </div>
    </header>
  );
}

/** The progress rail: one dot per section; hover (or focus) shows its name, click jumps there. */
function Rail({ t }: { t: Dictionary["rail"] }) {
  return (
    <nav
      data-hide-while-loading
      aria-label={t.label}
      className="fixed right-6 top-1/2 z-30 hidden -translate-y-1/2 flex-col items-end gap-1 lg:flex"
    >
      <span data-counter aria-hidden className="t-caption mb-2 w-4 text-center text-ash">
        01
      </span>
      {STAGES.map((id, i) => (
        <a
          key={id}
          href={`#${id}`}
          data-dot
          data-active={i === 0 ? "" : undefined}
          className="rail-link group flex items-center gap-3 py-1.5"
        >
          <span className="rail-label t-nav whitespace-nowrap">{t.stages[id]}</span>
          <span className="flex w-4 justify-center">
            <span className="dot" />
          </span>
        </a>
      ))}
    </nav>
  );
}

/**
 * One chapter of the story: 1.5 screens of scroll (SECTION_VH in Scene.tsx),
 * with its copy scrolling freely while the 3D changes in step with it.
 */
function Stage({
  id,
  side,
  narrow = false,
  children,
}: {
  id: string;
  /**
   * "hero" = near the top of the first screen; "middle" = centred, for the
   * open-sky chapters; "left" / "right" = beside the model; "end" = at the
   * bottom, under the logo.
   */
  side: "hero" | "left" | "right" | "middle" | "end";
  /** A slimmer column, when the model beside it reaches toward the centre. */
  narrow?: boolean;
  children: React.ReactNode;
}) {
  const column =
    side === "right"
      ? narrow
        ? "lg:ml-auto lg:w-[42%] lg:pl-8"
        : "lg:ml-auto lg:w-1/2 lg:pl-12"
      : side === "left" || side === "hero"
        ? narrow
          ? "lg:w-[42%] lg:pr-8"
          : "lg:w-1/2 lg:pr-8"
        : side === "end"
          ? ""
          : "mx-auto max-w-[820px] text-center";
  // Scroll margins decide where a #link to the section lands: centred copy
  // lands mid-screen, the footer lands with the page's end.
  const align = {
    hero: "items-start pt-[46svh] md:pt-[18svh]",
    left: "items-center -scroll-mt-[25svh]",
    right: "items-center -scroll-mt-[25svh]",
    middle: "items-center -scroll-mt-[25svh]",
    // clear of the booking dock (and its tabs) fixed at the bottom of the screen
    end: "items-end pb-44 md:pb-56 -scroll-mt-[50svh]",
  }[side];
  return (
    <section id={id} data-stage className={`relative flex h-[150svh] ${align}`}>
      <div className="mx-auto w-full max-w-[1280px] px-6 md:px-10">
        <div className={column}>{children}</div>
      </div>
    </section>
  );
}

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
      <Nav t={t.nav} locale={locale} />
      <Rail t={t.rail} />

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
          <footer className="grid gap-8">
            <div className="grid gap-8 md:grid-cols-[1fr_1.3fr_auto] md:items-end md:gap-12">
              <div>
                {/* on phones the particle logo right above says it already */}
                <Logo className="hidden h-14 md:block" />
                <p className="t-body max-w-[360px] text-ash md:mt-4">{t.footer.tagline}</p>
              </div>
              {/* The ticket office */}
              <address className="grid gap-2 text-[15px] not-italic leading-relaxed text-mist">
                <span className="t-label">{t.footer.contactTitle}</span>
                <span>
                  <span className="text-ash">{t.footer.phone}: </span>
                  {CONTACT.phones.map((p, i) => (
                    <span key={p.tel}>
                      {i > 0 && <span className="text-ash"> – </span>}
                      <a href={`tel:${p.tel}`} className="link-wave whitespace-nowrap text-white">
                        {p.text}
                      </a>
                    </span>
                  ))}
                </span>
                <span>
                  <span className="text-ash">{t.footer.email}: </span>
                  <a href={`mailto:${CONTACT.email}`} className="link-wave text-white">
                    {CONTACT.email}
                  </a>
                </span>
                <span>
                  <span className="text-ash">{t.footer.address}: </span>
                  {t.footer.addressText}
                </span>
              </address>
              <nav className="flex flex-wrap gap-x-8 gap-y-3 md:flex-col md:items-end">
                {t.footer.links.map((l) => (
                  <a key={l} href="#" className="link-wave t-nav text-ash">
                    {l}
                  </a>
                ))}
              </nav>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-t border-white/10 pt-5">
              <p className="t-caption text-ash">{fill(t.footer.rights, brand)}</p>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <Disclaimer label={t.footer.disclaimer} t={t.disclaimer} />
                <span className="t-caption text-ash">
                  {t.footer.designedBy} –{" "}
                  <a href={AUTHOR.url} target="_blank" rel="noopener noreferrer" className="link-wave text-white">
                    {AUTHOR.name}
                  </a>
                </span>
              </div>
            </div>
          </footer>
        </Stage>
      </main>

      <BookingDock strings={{ dock: t.dock, checkout: t.checkout, trips: t.trips, pass: t.pass }} locale={locale} />
      <Toaster dismissLabel={t.toast.dismiss} />
      <ContactButtons t={t.contact} />
    </>
  );
}
