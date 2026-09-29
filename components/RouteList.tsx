"use client";

import {
  ROUTE_EVENT,
  airport,
  flightDuration,
  formatDuration,
  formatVND,
  fromPrice,
  type RouteEventDetail,
} from "@/lib/flights";
import { fill, type Dictionary } from "@/lib/i18n";

/**
 * Popular routes; tapping one searches it in the booking dock. Each route's
 * name stays on one line ("Hà Nội → TP. Hồ Chí Minh"); on narrower screens
 * the fare moves under it.
 */
export default function RouteList({
  routes,
  t,
}: {
  routes: [string, string][];
  t: Dictionary["routeList"];
}) {
  const pick = (from: string, to: string) =>
    window.dispatchEvent(new CustomEvent<RouteEventDetail>(ROUTE_EVENT, { detail: { from, to } }));

  return (
    <ul className="mt-9">
      {routes.map(([from, to], i) => {
        const a = airport(from).city;
        const b = airport(to).city;
        const fare = (
          <>
            {t.from} <span className="text-white">{formatVND(fromPrice(from, to))}</span>
          </>
        );
        return (
          // phones show the top three so the list doesn't bury the model
          <li key={`${from}-${to}`} className={i >= 3 ? "hidden md:block" : undefined}>
            <button
              onClick={() => pick(from, to)}
              aria-label={fill(t.search, { from: a, to: b })}
              className="group grid w-full grid-cols-1 items-baseline gap-x-6 py-3 text-left lg:grid-cols-[1fr_auto]"
            >
              <span className="min-w-0">
                <span className="block whitespace-nowrap text-[17px] tracking-[-0.02em] transition-colors group-hover:text-saffron sm:text-[20px] md:text-[18px] lg:text-[22px]">
                  {a} <span className="text-ash">→</span> {b}
                </span>
                <span className="t-caption mt-1 block text-ash">
                  {formatDuration(flightDuration(from, to))} · {t.direct}
                  <span className="font-extralight text-mist lg:hidden"> · {fare}</span>
                </span>
              </span>
              <span className="hidden text-right text-[15px] font-extralight whitespace-nowrap text-mist lg:block">{fare}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
