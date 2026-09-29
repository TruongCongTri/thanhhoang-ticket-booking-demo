"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import gsap from "gsap";
import Checkout from "@/components/booking/Checkout";
import MyTrips from "@/components/booking/MyTrips";
import { onPageStart } from "@/lib/loading";
import { TRIPS_EVENT } from "@/lib/trips";
import {
  AIRLINES,
  AIRPORTS,
  ROUTE_EVENT,
  airport,
  formatClock,
  formatDuration,
  formatVND,
  normalize,
  searchFlights,
  type Airport,
  type Flight,
  type RouteEventDetail,
} from "@/lib/flights";
import { fill, intlLocale, plural, type Dictionary, type Locale } from "@/lib/i18n";

type T = Dictionary["dock"];
/** The dock's strings, plus checkout's and My trips'. */
type Strings = { dock: T; checkout: Dictionary["checkout"]; trips: Dictionary["trips"]; pass: Dictionary["pass"] };

type Trip = "oneway" | "round";
type Popover = null | "from" | "to" | "date" | "pax";
/** What the panel above the dock shows. */
type Phase = "idle" | "searching" | "results" | "checkout" | "trips";
/** Which way the fares on show fly: out, or back on a round trip. */
type Leg = "out" | "back";
/** Which date the calendar is setting. */
type Picking = "depart" | "return";

const subscribeNoop = () => () => {};
/** True after hydration; lets date defaults be computed on the client only. */
function useHydrated() {
  return useSyncExternalStore(subscribeNoop, () => true, () => false);
}

function clearTimers(ref: React.RefObject<number[]>) {
  ref.current.forEach(clearTimeout);
  ref.current = [];
}

/* ---- dates, as local "YYYY-MM-DD" strings (they compare correctly as text) ---- */

const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dateOf = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};
function localISO(offsetDays: number) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return isoOf(d);
}
function addDays(iso: string, days: number) {
  const d = dateOf(iso);
  d.setDate(d.getDate() + days);
  return isoOf(d);
}
function prettyDate(iso: string, locale: Locale) {
  if (!iso) return "—";
  return dateOf(iso).toLocaleDateString(intlLocale(locale), { weekday: "short", day: "2-digit", month: "short" });
}

export default function BookingDock({ strings, locale }: { strings: Strings; locale: Locale }) {
  const t = strings.dock;
  const hydrated = useHydrated();
  const [trip, setTrip] = useState<Trip>("oneway");
  const [from, setFrom] = useState("HAN");
  const [to, setTo] = useState("SGN");
  const [depart, setDepart] = useState("");
  const [ret, setRet] = useState(""); // kept when switching to one-way and back
  const [picking, setPicking] = useState<Picking>("depart");
  const [adults, setAdults] = useState(1);
  const [kids, setKids] = useState(0);
  const [popover, setPopover] = useState<Popover>(null);
  const [sheet, setSheet] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [leg, setLeg] = useState<Leg>("out");
  const [api, setApi] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Record<Leg, Flight[]>>({ out: [], back: [] });
  const [chosen, setChosen] = useState<Record<Leg, Flight | null>>({ out: null, back: null });
  const [tripsPhone, setTripsPhone] = useState("");
  const [lastSearch, setLastSearch] = useState(""); // what the fares on show were searched for

  const rootRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const swapRef = useRef<HTMLSpanElement>(null);
  const timers = useRef<number[]>([]);
  const panelHeight = useRef(0);

  const departDate = depart || (hydrated ? localISO(7) : "");
  const returnDate = ret || (departDate ? addDays(departDate, 3) : "");
  const pax = adults + kids;
  // A picked fare only drives the dock's button while the fares are on show.
  const selected = phase === "results" ? chosen[leg] : null;
  const legFrom = leg === "out" ? from : to;
  const legTo = leg === "out" ? to : from;

  /** Remembers the panel's height, so the next view can grow or shrink from it. */
  const notePanelHeight = () => {
    panelHeight.current = panelRef.current?.offsetHeight ?? 0;
  };

  /**
   * Fans out to every airline; each "API" answers at its own pace. Once the
   * last one has, the status list bows out and the fares come in.
   */
  const runSearch = useCallback(
    (f: string, dest: string, which: Leg = "out", date = departDate) => {
      clearTimers(timers);
      notePanelHeight();
      setPopover(null);
      setLeg(which);
      setChosen((c) => (which === "out" ? { out: null, back: null } : { ...c, back: null }));
      setPhase("searching");
      setApi({});
      setResults((r) => ({ ...r, [which]: searchFlights(f, dest, date) }));
      if (which === "out") setLastSearch(`${f}-${dest}-${date}-${returnDate}-${trip}-${adults + kids}`);
      let answered = 0;
      AIRLINES.forEach((al) => {
        timers.current.push(
          window.setTimeout(() => {
            setApi((s) => ({ ...s, [al.code]: true }));
            if (++answered < AIRLINES.length) return;
            timers.current.push(
              window.setTimeout(() => {
                const rows = listRef.current?.children;
                const show = () => {
                  notePanelHeight();
                  setPhase("results");
                };
                if (!rows?.length) return show();
                gsap.to(rows, { y: -10, autoAlpha: 0, duration: 0.3, ease: "power2.in", stagger: 0.035, onComplete: show });
              }, 380),
            );
          }, 300 + Math.random() * 1300),
        );
      });
    },
    [departDate, returnDate, trip, adults, kids],
  );

  /** Continue: a round trip picks its return next; then on to checkout. */
  const onPrimary = () => {
    setSheet(false);
    if (!selected) return runSearch(from, to);
    notePanelHeight();
    if (trip === "round" && leg === "out") return runSearch(to, from, "back", returnDate);
    setPhase("checkout");
  };

  /** Closes whichever panel is open (fares, checkout, My trips): it sinks back into the dock, then goes. */
  const closing = useRef(false);
  const closePanel = useCallback(() => {
    clearTimers(timers);
    const reset = () => {
      closing.current = false;
      setPhase("idle");
      setChosen({ out: null, back: null });
    };
    const el = rootRef.current?.querySelector<HTMLElement>("[data-panel]");
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return reset();
    if (closing.current) return;
    closing.current = true;
    gsap.to(el, { y: 22, scale: 0.985, autoAlpha: 0, duration: 0.32, ease: "power2.in", onComplete: reset });
  }, []);

  const openTrips = useCallback((phone = "") => {
    clearTimers(timers);
    setPopover(null);
    setSheet(false);
    setTripsPhone(phone);
    setPhase("trips");
  }, []);

  const swap = () => {
    setFrom(to);
    setTo(from);
    if (swapRef.current) gsap.fromTo(swapRef.current, { rotate: 0 }, { rotate: 180, duration: 0.5, ease: "power3.inOut" });
  };

  const openDates = (which: Picking) => {
    setPicking(which);
    setPopover(popover === "date" && picking === which ? null : "date");
  };
  /** Departure first; on a round trip the calendar then asks for the return. */
  const pickDate = (iso: string) => {
    if (picking === "depart") {
      setDepart(iso);
      if (returnDate < iso) setRet(addDays(iso, 3));
      if (trip === "round") setPicking("return");
      else setPopover(null);
    } else {
      setRet(iso);
      setPopover(null);
    }
  };

  // Entrance, once the loading screen lifts
  useEffect(() => {
    let tween: gsap.core.Tween | undefined;
    const stopWaiting = onPageStart(() => {
      tween = gsap.fromTo(
        dockRef.current,
        { y: 140, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 1.3, ease: "expo.out", delay: 0.9, clearProps: "transform" },
      );
    });
    return () => {
      stopWaiting();
      tween?.kill();
    };
  }, []);

  const panelOpen = phase !== "idle";
  const showingFares = phase === "searching" || phase === "results";

  // Searching ⇄ results (and outbound ⇄ return): the panel glides from its
  // old height to its new one, and the new rows rise in one after another.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel || !showingFares) return;
    const to = panel.offsetHeight;
    const fromH = panelHeight.current;
    panelHeight.current = 0;
    if (fromH) gsap.fromTo(panel, { height: fromH }, { height: to, duration: 0.55, ease: "power3.inOut", clearProps: "height" });
    else
      gsap.fromTo(
        panel,
        { y: 24, scale: 0.985, autoAlpha: 0 },
        { y: 0, scale: 1, autoAlpha: 1, duration: 0.55, ease: "power3.out", clearProps: "transform" },
      );
    const rows = listRef.current?.children;
    if (rows?.length)
      gsap.fromTo(
        rows,
        { y: 18, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.5, ease: "power3.out", stagger: phase === "results" ? 0.06 : 0.04, delay: fromH ? 0.15 : 0.1 },
      );
  }, [phase, leg, showingFares]);

  // Route rows elsewhere on the page can prefill + search.
  useEffect(() => {
    const onRoute = (e: Event) => {
      const { from: f, to: dest } = (e as CustomEvent<RouteEventDetail>).detail;
      setFrom(f);
      setTo(dest);
      runSearch(f, dest);
    };
    window.addEventListener(ROUTE_EVENT, onRoute);
    return () => window.removeEventListener(ROUTE_EVENT, onRoute);
  }, [runSearch]);

  // "My trips" in the header opens the lookup here.
  useEffect(() => {
    // the header link toggles: a second click closes the panel again
    const onTrips = () => (phase === "trips" ? closePanel() : openTrips());
    window.addEventListener(TRIPS_EVENT, onTrips);
    return () => window.removeEventListener(TRIPS_EVENT, onTrips);
  }, [openTrips, closePanel, phase]);

  // Outside click + Escape
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setPopover(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (popover) setPopover(null);
      else if (phase === "checkout") setPhase("results");
      else if (panelOpen) closePanel();
      else setSheet(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [popover, panelOpen, phase, closePanel]);

  useEffect(() => () => clearTimers(timers), []);

  const legResults = results[leg];
  const answered = Object.keys(api).length;
  const carriers = new Set(legResults.map((r) => r.airline.code)).size;
  const chosenPrice = (chosen.out?.price ?? 0) + (leg === "back" ? (chosen.back?.price ?? 0) : 0);
  // The dock's button: busy while airlines answer; "Select a fare" (disabled)
  // while the fares for exactly this search are on show and none is picked;
  // a changed route, date or party makes it a fresh search again.
  const searching = phase === "searching";
  const searchKey = `${from}-${to}-${departDate}-${returnDate}-${trip}-${pax}`;
  const needFare = phase === "results" && !selected && searchKey === lastSearch;
  // While checking out, the dock can't start another search; its ✕ aborts the checkout.
  const inCheckout = phase === "checkout";
  const primaryDisabled = from === to || searching || needFare || inCheckout;
  const primaryLabel = inCheckout
    ? t.checkingOut
    : searching
    ? t.searching
    : needFare
      ? t.selectFare
      : selected
        ? fill(t.continueWith, { price: formatVND(chosenPrice * pax) })
        : t.searchFlights;
  const dates = trip === "round" ? `${prettyDate(departDate, locale)} – ${prettyDate(returnDate, locale)}` : prettyDate(departDate, locale);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-3 md:px-6 md:pb-6">
      <div ref={rootRef} className="pointer-events-auto relative w-full max-w-[1040px]">
        {showingFares && (
          <div
            ref={panelRef}
            data-panel
            className="dock-surface absolute inset-x-0 bottom-full z-20 mb-12 flex max-h-[min(62svh,560px)] origin-bottom flex-col overflow-hidden"
            role="region"
            aria-live="polite"
            aria-label={t.results}
          >
            {/* Pinned header: the search, its status and a way out; the flights scroll beneath */}
            <div className="shrink-0 border-b border-white/[0.08] px-6 pt-5 pb-4 md:pt-6">
              <div className="mb-3 flex items-start justify-between gap-4">
                <p className="t-nav text-ash">
                  {trip === "round"
                    ? fill(leg === "out" ? t.outboundTitle : t.returnTitle, { from: legFrom, to: legTo })
                    : `${from} → ${to}`}{" "}
                  · {dates} · {plural(t.passengers, pax)}
                </p>
                <button onClick={closePanel} className="t-nav -mt-1 text-ash transition-colors hover:text-saffron" aria-label={t.closeResults}>
                  {t.close}
                </button>
              </div>
              <h3 key={`${phase}-${leg}`} className="t-heading-2xs fade-up">
                {phase === "searching" ? (
                  fill(t.asking, { n: AIRLINES.length })
                ) : (
                  <>
                    {fill(t.liveFares, { n: legResults.length, m: carriers })}
                    {trip === "round" && <span className="text-ash"> · {leg === "out" ? t.outbound : t.inbound}</span>}
                  </>
                )}
              </h3>
              {phase === "searching" && (
                // how many airlines have answered
                <div className="mt-3 flex items-center gap-3" aria-label={fill(t.progress, { n: answered, m: AIRLINES.length })}>
                  <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/10">
                    <span
                      className="block h-full rounded-full bg-azure transition-[width] duration-500 ease-out"
                      style={{ width: `${(answered / AIRLINES.length) * 100}%` }}
                    />
                  </span>
                  <span className="t-caption tabular-nums text-ash">
                    {answered}/{AIRLINES.length}
                  </span>
                </div>
              )}
              {phase === "results" && leg === "back" && chosen.out && (
                <p className="t-caption mt-2 flex flex-wrap items-center gap-x-3 text-ash">
                  <span className="text-azure">
                    ✓ {fill(t.chosenOutbound, { flight: chosen.out.number, time: formatClock(chosen.out.depart) })}
                  </span>
                  <button
                    onClick={() => {
                      notePanelHeight();
                      setLeg("out");
                    }}
                    className="link-wave uppercase tracking-[0.05em]"
                  >
                    {t.changeOutbound}
                  </button>
                </p>
              )}
            </div>

            <div data-lenis-prevent className="scroll-thin panel-scroll min-h-0 flex-1 overflow-y-auto py-4">
            {phase === "searching" ? (
              <>
                <ul ref={listRef} className="grid gap-x-8 gap-y-3 sm:grid-cols-2 md:grid-cols-3">
                  {AIRLINES.map((al) => {
                    const done = api[al.code];
                    const n = legResults.filter((r) => r.airline.code === al.code).length;
                    return (
                      <li key={al.code} className="flex items-center gap-3 text-[15px]">
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${done ? "bg-azure" : "animate-pulse bg-azure/40"}`}
                          aria-hidden
                        />
                        <span className={done ? "text-white" : "text-ash"}>{al.name}</span>
                        <span className="t-caption ml-auto text-ash">
                          {done ? (n ? plural(t.fares, n) : t.noSeats) : t.querying}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <>
                <ul ref={listRef} className="-mx-3">
                  {legResults.map((f, i) => {
                    const active = selected?.id === f.id;
                    return (
                      <li key={f.id}>
                        <button
                          onClick={() => setChosen((c) => ({ ...c, [leg]: active ? null : f }))}
                          aria-pressed={active}
                          className={`group grid w-full grid-cols-[1fr_auto] items-center gap-x-6 gap-y-1 rounded-[18px] px-3 py-3 text-left transition-colors md:grid-cols-[180px_1fr_150px_90px] ${
                            active ? "bg-azure/15 ring-1 ring-azure/60" : "hover:bg-white/[0.04]"
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-[15px]">{f.airline.name}</span>
                            <span className="t-caption text-ash">
                              {f.number}
                              {i === 0 && <span className="text-saffron"> · {t.cheapest}</span>}
                            </span>
                          </span>
                          <span className="order-3 col-span-2 flex items-center gap-3 md:order-none md:col-span-1">
                            <span className="text-[22px] tracking-[-0.02em]">{formatClock(f.depart)}</span>
                            <span className="relative h-px flex-1 bg-white/20">
                              <span className="t-caption absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-ash">
                                {formatDuration(f.duration)} · {t.direct}
                              </span>
                            </span>
                            <span className="text-[22px] tracking-[-0.02em]">{formatClock(f.arrive)}</span>
                          </span>
                          <span className="text-right">
                            <span className="block text-[18px]">{formatVND(f.price)}</span>
                            <span className={`t-caption ${f.seatsLeft <= 3 ? "text-saffron" : "text-ash"}`}>
                              {plural(t.seatsLeft, f.seatsLeft)}
                            </span>
                          </span>
                          <span
                            className={`t-nav hidden text-right transition-colors md:block ${
                              active ? "text-azure" : "text-ash group-hover:text-saffron"
                            }`}
                          >
                            {active ? t.selected : t.select}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
            </div>
          </div>
        )}

        {phase === "checkout" && chosen.out && (
          <Checkout
            t={strings.checkout}
            locale={locale}
            legs={[
              { flight: chosen.out, date: departDate },
              ...(trip === "round" && chosen.back ? [{ flight: chosen.back, date: returnDate }] : []),
            ]}
            adults={adults}
            kids={kids}
            onCancel={() => setPhase("results")}
            onDone={closePanel}
            onViewTrips={(phone) => openTrips(phone)}
          />
        )}

        {phase === "trips" && (
          <MyTrips
            key={tripsPhone}
            t={strings.trips}
            tc={strings.checkout}
            tt={strings.pass}
            locale={locale}
            initialPhone={tripsPhone}
            onClose={closePanel}
          />
        )}

        {(popover === "from" || popover === "to") && (
          <AirportList
            key={popover}
            t={t}
            value={popover === "from" ? from : to}
            exclude={popover === "from" ? to : from}
            className={popover === "from" ? "md:left-0" : "md:left-[220px]"}
            onPick={(code) => {
              if (popover === "from") setFrom(code);
              else setTo(code);
              setPopover(popover === "from" ? "to" : null);
            }}
          />
        )}

        {popover === "date" && hydrated && (
          <DatePicker
            t={t}
            locale={locale}
            trip={trip}
            depart={departDate}
            ret={returnDate}
            picking={picking}
            onPicking={setPicking}
            onPick={pickDate}
          />
        )}

        {popover === "pax" && (
          <div className="dock-surface absolute inset-x-0 bottom-full z-30 mb-12 p-5 md:left-auto md:right-[180px] md:w-[300px]">
            <Stepper t={t} label={t.adults} hint={t.adultsHint} value={adults} min={1} max={9 - kids} onChange={setAdults} />
            <Stepper t={t} label={t.children} hint={t.childrenHint} value={kids} min={0} max={9 - adults} onChange={setKids} />
          </div>
        )}

        <div ref={dockRef} className="dock-surface dock-tabbed relative invisible">
          {/* Trip type as folder tabs on the dock's top edge; switching keeps both dates */}
          <div role="tablist" aria-label={t.tripType} className="folder-tabs">
            {(["oneway", "round"] as const).map((kind) => (
              <button
                key={kind}
                role="tab"
                aria-selected={trip === kind}
                onClick={() => setTrip(kind)}
                className={`folder-tab ${trip === kind ? "folder-tab-active" : ""}`}
              >
                {kind === "oneway" ? t.oneWay : t.roundTrip}
              </button>
            ))}
          </div>

          {/* Full form: always on desktop, an upward sheet on mobile */}
          <div className={`${sheet ? "block" : "hidden"} p-2 md:block`}>
            <div className="grid grid-cols-2 gap-1 md:flex md:items-stretch">
              <FieldButton label={t.from} active={popover === "from"} onClick={() => setPopover(popover === "from" ? null : "from")}>
                <span className="text-[22px] leading-none tracking-[-0.02em]">{from}</span>
                <span className="t-caption block truncate text-mist">{airport(from).city}</span>
              </FieldButton>

              <button
                onClick={swap}
                aria-label={t.swap}
                className="hidden shrink-0 items-center justify-center self-center rounded-full p-2 text-ash transition-colors hover:text-saffron md:flex"
              >
                <span ref={swapRef} className="inline-block text-[18px]">⇄</span>
              </button>

              <FieldButton label={t.to} active={popover === "to"} onClick={() => setPopover(popover === "to" ? null : "to")}>
                <span className="text-[22px] leading-none tracking-[-0.02em]">{to}</span>
                <span className="t-caption block truncate text-mist">{airport(to).city}</span>
              </FieldButton>

              <FieldButton
                label={t.depart}
                active={popover === "date" && picking === "depart"}
                onClick={() => openDates("depart")}
                className={trip === "round" ? "" : "col-span-2 md:col-span-1"}
              >
                <span className="block truncate text-[17px] leading-tight">{prettyDate(departDate, locale)}</span>
              </FieldButton>
              {trip === "round" && (
                <FieldButton label={t.return} active={popover === "date" && picking === "return"} onClick={() => openDates("return")}>
                  <span className="block truncate text-[17px] leading-tight">{prettyDate(returnDate, locale)}</span>
                </FieldButton>
              )}

              <FieldButton
                label={t.travellers}
                active={popover === "pax"}
                onClick={() => setPopover(popover === "pax" ? null : "pax")}
                className="col-span-2 md:col-span-1"
              >
                <span className="text-[22px] leading-none tracking-[-0.02em]">{pax}</span>
                <span className="t-caption block truncate text-mist">
                  {plural(t.adultCount, adults)}
                  {kids ? `, ${plural(t.childCount, kids)}` : ""}
                </span>
              </FieldButton>

              <span className="hidden items-center gap-2 md:mr-4 md:ml-auto md:flex md:self-center">
                <button
                  onClick={onPrimary}
                  disabled={primaryDisabled}
                  aria-busy={searching}
                  className="btn-primary md:px-7 md:py-4"
                >
                  {searching && <span className="spinner" aria-hidden />}
                  {primaryLabel}
                </button>
                {inCheckout && <AbortButton label={t.abortCheckout} onClick={closePanel} />}
              </span>
            </div>
          </div>

          {/* Mobile bar */}
          <div className="flex items-center gap-2 p-2 md:hidden">
            <button
              onClick={() => setSheet((s) => !s)}
              aria-expanded={sheet}
              className="min-w-0 flex-1 rounded-[18px] px-3 py-1.5 text-left"
            >
              <span className="block truncate text-[18px] leading-tight">
                {from} → {to}
              </span>
              <span className="t-caption block truncate text-ash">
                {sheet ? t.hideOptions : fill(t.mobileSummary, { date: dates, n: pax })}
              </span>
            </button>
            <button onClick={onPrimary} disabled={primaryDisabled} aria-busy={searching} className="btn-primary shrink-0">
              {searching && <span className="spinner" aria-hidden />}
              {inCheckout ? t.paying : searching ? t.searching : needFare ? t.selectFare : selected ? t.continue : t.search}
            </button>
            {inCheckout && <AbortButton label={t.abortCheckout} onClick={closePanel} />}
          </div>
        </div>
      </div>
    </div>
  );
}

/** ✕ beside the dock's button: abandons the checkout in progress. */
function AbortButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="btn-ghost abort-btn shrink-0">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  );
}

function FieldButton({
  label,
  active,
  onClick,
  className = "",
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-expanded={active}
      className={`field min-w-0 rounded-[18px] px-4 py-2.5 text-left md:w-[150px] ${active ? "field-active" : ""} ${className}`}
    >
      <span className="field-label t-caption mb-1.5 block uppercase tracking-[0.05em]">{label}</span>
      {children}
    </button>
  );
}

/**
 * Calendar in the airport picker's style: months in one scrolling column
 * (two side by side on wider screens). On a round trip it highlights the
 * whole stay, and the tabs on top say which date the next tap sets.
 */
function DatePicker({
  t,
  locale,
  trip,
  depart,
  ret,
  picking,
  onPicking,
  onPick,
}: {
  t: T;
  locale: Locale;
  trip: Trip;
  depart: string;
  ret: string;
  picking: Picking;
  onPicking: (p: Picking) => void;
  onPick: (iso: string) => void;
}) {
  const lang = intlLocale(locale);
  const today = localISO(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const months = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => new Date(now.getFullYear(), now.getMonth() + i, 1));
  }, []);
  // Monday-first weekday initials, in the page's language (2024-01-01 was a Monday).
  const weekdays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(lang, { weekday: "narrow" })),
    [lang],
  );
  const round = trip === "round";
  const minDate = picking === "return" ? depart : today;

  // Open on the month being set.
  useEffect(() => {
    const target = (picking === "return" ? ret : depart).slice(0, 7);
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-month="${target}"]`);
    if (el && scrollRef.current) scrollRef.current.scrollTop = el.offsetTop - scrollRef.current.offsetTop;
  }, [picking, depart, ret]);

  const tabs: [Picking, string, string][] = round
    ? [
        ["depart", t.depart, depart],
        ["return", t.return, ret],
      ]
    : [["depart", t.depart, depart]];

  return (
    <div
      role="dialog"
      aria-label={round ? t.pickReturn : t.pickDepart}
      className="dock-surface absolute inset-x-0 bottom-full z-30 mb-12 p-4 md:left-auto md:right-[120px] md:w-[620px] md:p-5"
    >
      <div className="mb-3 flex items-end gap-2">
        {tabs.map(([key, label, iso]) => (
          <button
            key={key}
            onClick={() => onPicking(key)}
            aria-pressed={picking === key}
            className={`field rounded-[14px] px-3 py-2 text-left ${picking === key ? "field-active" : ""}`}
          >
            <span className="field-label t-caption block uppercase tracking-[0.05em]">{label}</span>
            <span className="text-[16px]">{prettyDate(iso, locale)}</span>
          </button>
        ))}
        <p className="t-caption ml-auto hidden pb-2 text-ash md:block">{picking === "return" ? t.pickReturn : t.pickDepart}</p>
      </div>

      <div ref={scrollRef} data-lenis-prevent className="scroll-thin relative max-h-[300px] overflow-y-auto pr-2">
        <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
          {months.map((m) => {
            const key = isoOf(m).slice(0, 7);
            const blanks = (m.getDay() + 6) % 7;
            const days = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
            return (
              <section key={key} data-month={key}>
                <h4 className="t-nav mb-2 text-white">
                  {m.toLocaleDateString(lang, { month: "long", year: "numeric" })}
                </h4>
                <div className="grid grid-cols-7 text-center">
                  {weekdays.map((w, i) => (
                    <span key={i} className="t-caption pb-1 text-ash">
                      {w}
                    </span>
                  ))}
                  {Array.from({ length: blanks }, (_, i) => (
                    <span key={`b${i}`} />
                  ))}
                  {Array.from({ length: days }, (_, i) => {
                    const iso = `${key}-${pad(i + 1)}`;
                    const disabled = iso < minDate;
                    const end = iso === depart || (round && iso === ret);
                    const inStay = round && iso > depart && iso < ret;
                    return (
                      <span key={iso} className={`py-0.5 ${inStay ? "bg-azure/15" : ""} ${round && iso === depart && ret > depart ? "rounded-l-full bg-azure/15" : ""} ${round && iso === ret && ret > depart ? "rounded-r-full bg-azure/15" : ""}`}>
                        <button
                          onClick={() => onPick(iso)}
                          disabled={disabled}
                          aria-pressed={end}
                          aria-label={prettyDate(iso, locale)}
                          className={`day mx-auto block h-8 w-8 rounded-full text-[14px] tabular-nums ${end ? "day-active" : ""} ${iso === today ? "day-today" : ""}`}
                        >
                          {i + 1}
                        </button>
                      </span>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Stepper({
  t,
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  t: T;
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <div className="text-[15px]">{label}</div>
        <div className="t-caption text-ash">{hint}</div>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={fill(t.fewer, { what: label.toLowerCase() })}
          className="h-8 w-8 rounded-full text-[18px] text-ash transition-colors hover:text-saffron disabled:opacity-30"
        >
          −
        </button>
        <span className="w-4 text-center text-[18px]">{value}</span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={fill(t.more, { what: label.toLowerCase() })}
          className="h-8 w-8 rounded-full text-[18px] text-ash transition-colors hover:text-saffron disabled:opacity-30"
        >
          +
        </button>
      </div>
    </div>
  );
}

/** Airport search: Vietnam first, then international destinations. */
function AirportList({
  t,
  value,
  exclude,
  className,
  onPick,
}: {
  t: T;
  value: string;
  exclude: string;
  className: string;
  onPick: (code: string) => void;
}) {
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const list = useMemo(() => {
    const nq = normalize(q.trim());
    return AIRPORTS.filter((a) => !nq || normalize(`${a.code} ${a.city} ${a.name}`).includes(nq));
  }, [q]);
  const groups: [string, Airport[]][] = [
    [t.domesticGroup, list.filter((a) => !a.intl)],
    [t.internationalGroup, list.filter((a) => a.intl)],
  ];

  useEffect(() => {
    if (window.matchMedia("(min-width: 768px)").matches) inputRef.current?.focus();
  }, []);

  return (
    <div className={`dock-surface absolute inset-x-0 bottom-full z-30 mb-12 p-3 md:right-auto md:w-[380px] ${className}`}>
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          const first = list.find((a) => a.code !== exclude);
          if (e.key === "Enter" && first) onPick(first.code);
        }}
        placeholder={t.airportPlaceholder}
        aria-label={t.searchAirports}
        className="w-full bg-transparent px-3 py-2 text-[18px] font-extralight text-white outline-none placeholder:text-ash"
      />
      <div data-lenis-prevent className="scroll-thin mt-1 max-h-72 overflow-y-auto pr-1">
        {groups.map(([title, items]) =>
          items.length ? (
            <div key={title} role="group" aria-label={title}>
              <p className="t-caption px-3 pt-3 pb-1 uppercase tracking-[0.05em] text-azure">{title}</p>
              <ul role="listbox" aria-label={title}>
                {items.map((a) => (
                  <li key={a.code} role="option" aria-selected={a.code === value}>
                    <button
                      onClick={() => onPick(a.code)}
                      disabled={a.code === exclude}
                      className={`group flex w-full items-baseline gap-3 rounded-[14px] px-3 py-2.5 text-left transition-colors hover:bg-white/[0.05] disabled:opacity-30 ${
                        a.code === value ? "text-azure" : ""
                      }`}
                    >
                      <span className="t-nav w-10 shrink-0 transition-colors group-hover:text-saffron">{a.code}</span>
                      <span className="truncate text-[15px] transition-colors group-hover:text-saffron">{a.city}</span>
                      <span className="t-caption ml-auto shrink-0 text-ash">{a.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null,
        )}
        {!list.length && <p className="px-3 py-3 text-[15px] text-ash">{fill(t.noMatch, { q })}</p>}
      </div>
    </div>
  );
}
