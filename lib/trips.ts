import type { Flight } from "@/lib/flights";

/**
 * Bookings, kept against the traveller's phone number — the only thing
 * anyone needs to find their flights again. In this demo they live in the
 * browser (localStorage); in production the same records would be saved by
 * the booking API.
 */

export type PayMethod = "vietqr" | "momo" | "zalopay" | "card";
export const PAY_METHODS: PayMethod[] = ["vietqr", "momo", "zalopay", "card"];

export type BookedLeg = Pick<Flight, "number" | "from" | "to" | "depart" | "arrive" | "duration" | "price"> & {
  airline: string;
  date: string; // YYYY-MM-DD
};

export type Booking = {
  code: string; // airline-style record locator, e.g. "K7Q2MX"
  phone: string; // normalised, e.g. "0912345678"
  email?: string;
  passengers: string[];
  legs: BookedLeg[];
  method: PayMethod;
  total: number; // VND
  createdAt: number;
};

/* ---- phone numbers (Vietnamese mobiles) ---- */

/** "+84 912 345 678", "84912345678", "0912.345.678" → "0912345678"; anything else → "". */
export function normalizePhone(input: string): string {
  let d = input.replace(/[^\d+]/g, "");
  if (d.startsWith("+84")) d = `0${d.slice(3)}`;
  else if (d.startsWith("84") && d.length === 11) d = `0${d.slice(2)}`;
  d = d.replace(/\D/g, "");
  return /^0[35789]\d{8}$/.test(d) ? d : "";
}

/** "0912345678" → "0912 345 678" */
export const formatPhone = (p: string) => (p.length === 10 ? `${p.slice(0, 4)} ${p.slice(4, 7)} ${p.slice(7)}` : p);

/* ---- fares ---- */

export const SERVICE_FEE = 99000; // per passenger per flight: airport and security charges
export const VAT = 0.1;

export function priceBreakdown(legs: { price: number }[], pax: number) {
  const fare = legs.reduce((s, l) => s + l.price, 0) * pax;
  const taxes = Math.round((fare * VAT) / 1000) * 1000;
  const fees = SERVICE_FEE * pax * legs.length;
  return { fare, taxes, fees, total: fare + taxes + fees };
}

/* ---- cards (for the mock card form) ---- */

export function luhnValid(num: string): boolean {
  const d = num.replace(/\D/g, "");
  if (d.length < 13 || d.length > 19) return false;
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

/** "MM/YY", not in the past. */
export function expiryValid(v: string, now = new Date()): boolean {
  const m = /^(\d{2})\/(\d{2})$/.exec(v.trim());
  if (!m) return false;
  const month = Number(m[1]);
  const year = 2000 + Number(m[2]);
  if (month < 1 || month > 12) return false;
  return year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1);
}

/* ---- storage ---- */

const KEY = "thanhhoang:trips:v1";
const LAST_PHONE = "thanhhoang:last-phone";

function readAll(): Record<string, Booking[]> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, Booking[]>;
  } catch {
    return {};
  }
}

/** Bookings for a phone number, newest first. */
export function tripsFor(phone: string): Booking[] {
  const p = normalizePhone(phone);
  return p ? (readAll()[p] ?? []).slice().sort((a, b) => b.createdAt - a.createdAt) : [];
}

export function saveBooking(b: Booking) {
  try {
    const all = readAll();
    all[b.phone] = [...(all[b.phone] ?? []), b];
    localStorage.setItem(KEY, JSON.stringify(all));
    localStorage.setItem(LAST_PHONE, b.phone);
  } catch {
    // storage unavailable (private mode): the confirmation still shows
  }
}

export function lastPhone(): string {
  try {
    return localStorage.getItem(LAST_PHONE) ?? "";
  } catch {
    return "";
  }
}

/** Six letters and digits, no look-alikes (0/O, 1/I). */
export function bookingCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

/* ---- one-time codes: looking up trips needs the phone itself ---- */

/*
 * Demo only: the code is made and checked in the browser. In production the
 * server sends it by SMS and verifies it; only the flow here would stay.
 */
const OTP_TTL = 5 * 60 * 1000;
const pendingOtp = new Map<string, { code: string; expires: number }>();
const VERIFIED = "thanhhoang:verified";

/** Issues a fresh 6-digit code for a phone number (and returns it, for the demo SMS). */
export function requestOtp(phone: string): string {
  const code = String(Math.floor(Math.random() * 1e6)).padStart(6, "0");
  pendingOtp.set(phone, { code, expires: Date.now() + OTP_TTL });
  return code;
}

export function verifyOtp(phone: string, code: string): boolean {
  const p = pendingOtp.get(phone);
  const ok = !!p && p.expires > Date.now() && p.code === code;
  if (ok) {
    pendingOtp.delete(phone);
    try {
      const all = new Set<string>(JSON.parse(sessionStorage.getItem(VERIFIED) ?? "[]"));
      all.add(phone);
      sessionStorage.setItem(VERIFIED, JSON.stringify([...all]));
    } catch {
      // no session storage: they'll just verify again next time
    }
  }
  return ok;
}

/** Verified already in this browser session — no second code needed. */
export function isVerified(phone: string): boolean {
  try {
    return (JSON.parse(sessionStorage.getItem(VERIFIED) ?? "[]") as string[]).includes(phone);
  } catch {
    return false;
  }
}

/** Window event: open the "My trips" panel (from the header link). */
export const TRIPS_EVENT = "thanhhoang:trips";
