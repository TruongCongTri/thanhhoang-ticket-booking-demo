import { airport } from "@/lib/flights";
import type { BookedLeg } from "@/lib/trips";

/**
 * The day of travel for a booked flight, following Vietnamese carriers'
 * usual rules: counters close 40 min before a domestic departure (60 min
 * international), boarding starts 35 min before (50 min), and the gate
 * closes 15 min before (20 min) — by then you should be at the plane.
 */

const RULES = {
  domestic: { counterOpen: 120, counterClose: 40, boarding: 35, gateClose: 15 },
  international: { counterOpen: 180, counterClose: 60, boarding: 50, gateClose: 20 },
} as const;
const ONLINE_CHECKIN = 24 * 60; // online check-in opens 24 h before departure

export const isInternational = (leg: Pick<BookedLeg, "from" | "to">) => !!(airport(leg.from).intl || airport(leg.to).intl);

export type LegTimes = {
  onlineOpen: Date;
  counterOpen: Date;
  counterClose: Date;
  boarding: Date;
  gateClose: Date;
  departure: Date;
};

export function legTimes(leg: Pick<BookedLeg, "date" | "depart" | "from" | "to">): LegTimes {
  const [y, m, d] = leg.date.split("-").map(Number);
  const departure = new Date(y, m - 1, d, 0, leg.depart);
  const r = RULES[isInternational(leg) ? "international" : "domestic"];
  const before = (min: number) => new Date(departure.getTime() - min * 60000);
  return {
    onlineOpen: before(ONLINE_CHECKIN),
    counterOpen: before(r.counterOpen),
    counterClose: before(r.counterClose),
    boarding: before(r.boarding),
    gateClose: before(r.gateClose),
    departure,
  };
}

/**
 * Where the traveller stands right now, and minutes until the next deadline.
 * `urgent`: within the last hours — time to act.
 */
export type LegStage = "later" | "checkin" | "closed" | "boarding" | "gate" | "departed";
export function legStatus(times: LegTimes, now = new Date()): { stage: LegStage; left: number; urgent: boolean; soon: boolean } {
  const until = (d: Date) => Math.max(0, Math.round((d.getTime() - now.getTime()) / 60000));
  const t = now.getTime();
  if (t < times.onlineOpen.getTime()) return { stage: "later", left: until(times.onlineOpen), urgent: false, soon: false };
  if (t < times.counterClose.getTime()) {
    const left = until(times.counterClose);
    return { stage: "checkin", left, urgent: left <= 120, soon: true };
  }
  if (t < times.boarding.getTime()) return { stage: "closed", left: until(times.boarding), urgent: true, soon: true };
  if (t < times.gateClose.getTime()) return { stage: "boarding", left: until(times.gateClose), urgent: true, soon: true };
  if (t < times.departure.getTime()) return { stage: "gate", left: until(times.departure), urgent: true, soon: true };
  return { stage: "departed", left: 0, urgent: false, soon: false };
}

/* ---- seat, gate, terminal: stable per booking, leg and passenger ---- */

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function seatFor(code: string, leg: number, pax: number): string {
  const h = hash(`${code}-${leg}`);
  const row = 6 + (h % 30);
  const letters = "ABCDEFGHK";
  const start = (h >>> 8) % (letters.length - 3);
  return `${row}${letters[(start + pax) % letters.length]}`;
}

export function gateFor(code: string, leg: number): string {
  return String(1 + (hash(`${code}-gate-${leg}`) % 28));
}

/** Hà Nội and TP. Hồ Chí Minh fly international from terminal 2; everything else from terminal 1. */
export function terminalFor(leg: Pick<BookedLeg, "from" | "to">): string {
  return isInternational(leg) && (leg.from === "HAN" || leg.from === "SGN") ? "T2" : "T1";
}
