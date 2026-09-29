"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { airport, formatClock, formatDuration, formatVND, type Flight } from "@/lib/flights";
import { fill, intlLocale, type Dictionary, type Locale } from "@/lib/i18n";
import {
  PAY_METHODS,
  bookingCode,
  expiryValid,
  formatPhone,
  luhnValid,
  normalizePhone,
  priceBreakdown,
  saveBooking,
  type Booking,
  type PayMethod,
} from "@/lib/trips";
import { qrSvg, svgDataUrl } from "@/lib/ticket";
import { toast } from "@/lib/toast";

type T = Dictionary["checkout"];
/** A flight chosen in the results, with its travel date. */
export type ChosenLeg = { flight: Flight; date: string };

const HOLD_SECONDS = 15 * 60;

const prettyDate = (iso: string, locale: Locale) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(intlLocale(locale), { weekday: "short", day: "2-digit", month: "short" });
};

/**
 * Checkout, step by step: 1 details (the phone number is mandatory — it's
 * what the booking is saved and tracked by), 2 payment method, 3 pay (scan a
 * QR for VietQR / MoMo / ZaloPay, or a card form), 4 confirmation. The
 * header (steps) and footer (total, back / continue) stay put; the step
 * scrolls between them.
 */
export default function Checkout({
  t,
  locale,
  legs,
  adults,
  kids,
  onCancel,
  onDone,
  onViewTrips,
}: {
  t: T;
  locale: Locale;
  legs: ChosenLeg[];
  adults: number;
  kids: number;
  onCancel: () => void;
  onDone: () => void;
  onViewTrips: (phone: string) => void;
}) {
  const pax = adults + kids;
  const [step, setStep] = useState(0);
  const [phone, setPhone] = useState("");
  const [names, setNames] = useState<string[]>(() => Array(pax).fill(""));
  const [email, setEmail] = useState("");
  const [method, setMethod] = useState<PayMethod | null>(null);
  const [card, setCard] = useState({ number: "", name: "", expiry: "", cvc: "" });
  // Errors show once a field has been left (Continue stays disabled until the step is complete).
  const [seen, setSeen] = useState<Record<string, boolean>>({});
  const blur = (key: string) => () => setSeen((s) => ({ ...s, [key]: true }));
  const [processing, setProcessing] = useState(false);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [code] = useState(bookingCode);
  const [left, setLeft] = useState(HOLD_SECONDS);

  const bodyRef = useRef<HTMLDivElement>(null);
  // An aborted checkout (closed mid-payment) must never go on to book.
  const payTimer = useRef(0);
  useEffect(() => () => clearTimeout(payTimer.current), []);
  const price = useMemo(() => priceBreakdown(legs.map((l) => l.flight), pax), [legs, pax]);

  // Seats are held while paying: a countdown on the pay step; when it runs out, they're released.
  useEffect(() => {
    if (step !== 2) return;
    const id = window.setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [step]);
  useEffect(() => {
    if (left > 0 || processing) return;
    toast("warning", t.expired, t.expiredBody);
    onCancel();
  }, [left, processing, t, onCancel]);

  // Each step slides in from the side it comes from.
  const dir = useRef(1);
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.scrollTop = 0;
    gsap.fromTo(el.children, { x: 28 * dir.current, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.45, ease: "power3.out", stagger: 0.04 });
  }, [step, processing]);

  /* ---- validation ---- */
  const phoneOk = !!normalizePhone(phone);
  const namesOk = names.map((n) => n.trim().split(/\s+/).length >= 2);
  const emailOk = !email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const detailsOk = phoneOk && namesOk.every(Boolean) && emailOk;
  const cardOk = {
    number: luhnValid(card.number),
    name: card.name.trim().length > 1,
    expiry: expiryValid(card.expiry),
    cvc: /^\d{3,4}$/.test(card.cvc),
  };
  const payOk = method !== "card" || Object.values(cardOk).every(Boolean);
  const stepOk = [detailsOk, !!method, payOk, true][step];

  const go = (to: number) => {
    dir.current = to > step ? 1 : -1;
    setStep(to);
  };

  const pay = () => {
    if (!method) return;
    setProcessing(true);
    payTimer.current = window.setTimeout(() => {
      // The demo's test card for a declined payment: 4000 0000 0000 0002.
      if (method === "card" && card.number.replace(/\D/g, "") === "4000000000000002") {
        setProcessing(false);
        toast("warning", t.declined, t.declinedBody);
        return;
      }
      const b: Booking = {
        code,
        phone: normalizePhone(phone),
        email: email.trim() || undefined,
        passengers: names.map((n) => n.trim()),
        legs: legs.map(({ flight: f, date }) => ({
          airline: f.airline.name,
          number: f.number,
          from: f.from,
          to: f.to,
          date,
          depart: f.depart,
          arrive: f.arrive,
          duration: f.duration,
          price: f.price,
        })),
        method,
        total: price.total,
        createdAt: Date.now(),
      };
      saveBooking(b);
      setBooking(b);
      setProcessing(false);
      dir.current = 1;
      setStep(3);
      const first = legs[0].flight;
      toast(
        "success",
        fill(t.booked, { code: b.code }),
        fill(t.bookedBody, {
          route: legs.map(({ flight: f }) => `${f.from} → ${f.to}`).join(" · "),
          date: prettyDate(legs[0].date, locale),
          time: formatClock(first.depart),
          flight: legs.map(({ flight: f }) => f.number).join(" + "),
          phone: formatPhone(b.phone),
        }),
        9000,
      );
    }, 2200);
  };

  const next = () => {
    if (!stepOk) {
      setSeen({ phone: true, email: true, card: true, cardName: true, expiry: true, cvc: true, ...Object.fromEntries(names.map((_, i) => [`n${i}`, true])) });
      return toast("warning", t.fixFields, t.fixFieldsBody);
    }
    if (step < 2) go(step + 1);
    else pay();
  };

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  const methodName = method ? t.methods[method].name : "";

  return (
    <div
      data-panel
      className="dock-surface panel-in absolute inset-x-0 bottom-full z-20 mb-12 flex max-h-[58svh] origin-bottom flex-col md:max-h-[min(74svh,660px)]"
      role="dialog"
      aria-label={t.label}
    >
      {/* Steps */}
      <div className="shrink-0 border-b border-white/[0.08] px-6 pt-5 pb-4">
        <div className="flex items-start justify-between gap-4">
          <p className="t-nav text-ash">{t.label}</p>
          {step < 3 && !processing && (
            <button onClick={onCancel} className="t-nav -mt-1 text-ash transition-colors hover:text-saffron">
              {t.cancel}
            </button>
          )}
        </div>
        <ol className="mt-3 flex items-center gap-2 md:gap-3">
          {t.steps.map((label, i) => {
            const state = i < step ? "done" : i === step ? "now" : "next";
            return (
              <li key={label} className="flex min-w-0 items-center gap-2 md:gap-3" aria-current={state === "now" ? "step" : undefined}>
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold transition-colors ${
                    state === "next" ? "text-ash ring-1 ring-white/15" : "bg-brand text-[#fff]"
                  }`}
                >
                  {state === "done" ? "✓" : i + 1}
                </span>
                <span className={`t-caption truncate uppercase tracking-[0.05em] ${state === "now" ? "text-azure" : state === "done" ? "text-white" : "text-ash"} ${state === "now" ? "" : "hidden sm:inline"}`}>
                  {label}
                </span>
                {i < t.steps.length - 1 && <span className="h-px w-4 shrink-0 bg-white/15 md:w-8" aria-hidden />}
              </li>
            );
          })}
        </ol>
      </div>

      {/* The step */}
      <div ref={bodyRef} data-lenis-prevent className="scroll-thin panel-scroll min-h-0 flex-1 overflow-y-auto py-5">
        {processing ? (
          <div className="flex flex-col items-center py-10 text-center">
            <span className="h-10 w-10 animate-spin rounded-full border-2 border-azure/25 border-t-azure" aria-hidden />
            <p className="t-heading-2xs mt-6">{t.processing}</p>
            <p className="t-caption mt-2 text-ash">{t.processingSub}</p>
          </div>
        ) : step === 0 ? (
          <div className="grid gap-6">
            <Field label={t.phone} hint={t.phoneHint} error={seen.phone && !phoneOk ? t.phoneError : ""} required>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onBlur={blur("phone")}
                placeholder={t.phonePlaceholder}
                className="input text-[22px] tracking-[0.02em]"
                required
                aria-invalid={!!seen.phone && !phoneOk}
              />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              {names.map((n, i) => (
                <Field
                  key={i}
                  label={fill(t.passenger, { n: i + 1, kind: i < adults ? t.adult : t.child })}
                  error={seen[`n${i}`] && !namesOk[i] ? t.nameError : ""}
                  required
                >
                  <input
                    value={n}
                    autoComplete={i === 0 ? "name" : "off"}
                    onChange={(e) => setNames((all) => all.map((v, j) => (j === i ? e.target.value : v)))}
                    onBlur={blur(`n${i}`)}
                    placeholder={t.namePlaceholder}
                    className="input"
                    required
                    aria-invalid={!!seen[`n${i}`] && !namesOk[i]}
                  />
                </Field>
              ))}
            </div>
            <Field label={t.email} error={seen.email && !emailOk ? t.emailError : ""}>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onBlur={blur("email")}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.emailPlaceholder}
                className="input"
              />
            </Field>
          </div>
        ) : step === 1 ? (
          <div className="grid gap-6 md:grid-cols-[1fr_300px]">
            <div>
              <p className="t-heading-2xs mb-4">{t.methodTitle}</p>
              <div role="radiogroup" aria-label={t.methodTitle} className="grid gap-2 sm:grid-cols-2">
                {PAY_METHODS.map((m) => (
                  <button
                    key={m}
                    role="radio"
                    aria-checked={method === m}
                    onClick={() => setMethod(m)}
                    className={`field rounded-[18px] px-4 py-3 text-left ${method === m ? "field-active" : "ring-1 ring-white/10"}`}
                  >
                    <span className="block text-[17px]">{t.methods[m].name}</span>
                    <span className="field-label t-caption block">{t.methods[m].sub}</span>
                  </button>
                ))}
              </div>
            </div>
            <Summary t={t} locale={locale} legs={legs} price={price} pax={pax} />
          </div>
        ) : step === 2 ? (
          method === "card" ? (
            <div className="grid max-w-[520px] gap-4">
              <Field label={t.cardNumber} error={seen.card && !cardOk.number ? t.cardError : ""} required>
                <input
                  inputMode="numeric"
                  autoComplete="cc-number"
                  onBlur={blur("card")}
                  aria-invalid={!!seen.card && !cardOk.number}
                  value={card.number}
                  onChange={(e) =>
                    setCard((c) => ({ ...c, number: e.target.value.replace(/\D/g, "").slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 ") }))
                  }
                  placeholder="4111 1111 1111 1111"
                  className="input tabular-nums tracking-[0.04em]"
                />
              </Field>
              <Field label={t.cardName} error={seen.cardName && !cardOk.name ? t.cardNameError : ""} required>
                <input
                  autoComplete="cc-name"
                  onBlur={blur("cardName")}
                  aria-invalid={!!seen.cardName && !cardOk.name}
                  value={card.name}
                  onChange={(e) => setCard((c) => ({ ...c, name: e.target.value.toUpperCase() }))}
                  className="input"
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label={t.expiry} error={seen.expiry && !cardOk.expiry ? t.expiryError : ""} required>
                  <input
                    inputMode="numeric"
                    autoComplete="cc-exp"
                    onBlur={blur("expiry")}
                    aria-invalid={!!seen.expiry && !cardOk.expiry}
                    value={card.expiry}
                    onChange={(e) => {
                      const d = e.target.value.replace(/\D/g, "").slice(0, 4);
                      setCard((c) => ({ ...c, expiry: d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d }));
                    }}
                    placeholder="MM/YY"
                    className="input tabular-nums"
                  />
                </Field>
                <Field label={t.cvc} error={seen.cvc && !cardOk.cvc ? t.cvcError : ""} required>
                  <input
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    onBlur={blur("cvc")}
                    aria-invalid={!!seen.cvc && !cardOk.cvc}
                    value={card.cvc}
                    onChange={(e) => setCard((c) => ({ ...c, cvc: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                    placeholder="123"
                    className="input tabular-nums"
                  />
                </Field>
              </div>
              <p className="t-caption text-ash">{fill(t.holds, { time: `${mm}:${ss}` })}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-6 md:flex-row md:items-start">
              <div className="rounded-[18px] bg-[#fff] p-3 ring-1 ring-white/10">
                <PayQR text={`THANHHOANG|PAY|${code}|${price.total}|${method}`} label={fill(t.scanTitle, { method: methodName })} />
              </div>
              <div className="w-full">
                <p className="t-heading-2xs">{fill(t.scanTitle, { method: methodName })}</p>
                <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[15px]">
                  <dt className="text-ash">{t.amount}</dt>
                  <dd className="text-white">{formatVND(price.total)}</dd>
                  <dt className="text-ash">{t.transferNote}</dt>
                  <dd className="font-semibold tracking-[0.08em] text-azure">THANHHOANG {code}</dd>
                </dl>
                <p className="t-caption mt-4 text-ash">
                  {fill(t.holds, { time: `${mm}:${ss}` })} · {t.demo}
                </p>
              </div>
            </div>
          )
        ) : (
          booking && (
            <div className="grid gap-6 md:grid-cols-[1fr_300px]">
              <div>
                <p className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-[18px] text-[#fff]" aria-hidden>
                    ✓
                  </span>
                  <span className="t-heading">{t.doneTitle}</span>
                </p>
                <p className="t-caption mt-5 uppercase tracking-[0.05em] text-ash">{t.code}</p>
                <p className="text-[40px] leading-none font-semibold tracking-[0.12em] text-azure">{booking.code}</p>
                <p className="t-body mt-5 max-w-[440px] text-mist">{fill(t.savedTo, { phone: formatPhone(booking.phone) })}</p>
                {/* this site is a portfolio demo: say so plainly where it matters most */}
                <div role="note" className="notice notice-warn mt-5 max-w-[480px]">
                  <span aria-hidden>!</span>
                  <span className="grid gap-0.5">
                    <strong className="font-semibold">{t.demoTitle}</strong>
                    <span className="text-[14px]">{t.demoBody}</span>
                  </span>
                </div>
              </div>
              <Summary t={t} locale={locale} legs={legs} price={price} pax={pax} passengers={booking.passengers} />
            </div>
          )
        )}
      </div>

      {/* Total and actions */}
      <div className="flex shrink-0 items-center gap-3 border-t border-white/[0.08] px-6 py-3">
          <span className="min-w-0">
            <span className="t-caption block uppercase tracking-[0.05em] text-ash">{t.total}</span>
            <span className="text-[20px] tracking-[-0.02em]">{formatVND(price.total)}</span>
          </span>
          <span className="ml-auto flex items-center gap-2">
            {step === 3 ? (
              <>
                <button onClick={() => booking && onViewTrips(booking.phone)} className="link-wave t-nav mr-3 whitespace-nowrap text-ash">
                  {t.viewTrips}
                </button>
                <button onClick={onDone} className="btn-primary">
                  {t.done}
                </button>
              </>
            ) : (
              <>
                {step > 0 && (
                  <button onClick={() => go(step - 1)} disabled={processing} className="link-wave t-nav mr-3 text-ash disabled:opacity-40">
                    {t.back}
                  </button>
                )}
                <button onClick={next} className="btn-primary" disabled={!stepOk || processing} aria-busy={processing}>
                  {processing ? (
                    <>
                      <span className="spinner" aria-hidden /> {t.paying}
                    </>
                  ) : step === 2 ? (
                    method === "card" ? fill(t.pay, { total: formatVND(price.total) }) : t.paid
                  ) : step === 1 && !method ? (
                    t.selectMethod
                  ) : (
                    t.next
                  )}
                </button>
              </>
            )}
          </span>
        </div>
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="t-caption mb-1.5 block uppercase tracking-[0.05em] text-ash">
        {label}
        {required && <span className="text-azure"> *</span>}
      </span>
      {children}
      {error ? (
        <span role="alert" className="t-caption mt-1.5 block text-saffron">
          {error}
        </span>
      ) : (
        hint && <span className="t-caption mt-1.5 block text-ash">{hint}</span>
      )}
    </label>
  );
}

function Summary({
  t,
  locale,
  legs,
  price,
  pax,
  passengers,
}: {
  t: T;
  locale: Locale;
  legs: ChosenLeg[];
  price: ReturnType<typeof priceBreakdown>;
  pax: number;
  passengers?: string[];
}) {
  return (
    <aside className="rounded-[18px] bg-white/[0.03] p-4 ring-1 ring-white/[0.06]">
      <p className="t-caption mb-3 uppercase tracking-[0.05em] text-ash">{t.summary}</p>
      <ul className="grid gap-3">
        {legs.map(({ flight: f, date }) => (
          <li key={f.id}>
            <p className="text-[15px]">
              {airport(f.from).city} <span className="text-ash">→</span> {airport(f.to).city}
            </p>
            <p className="t-caption text-ash">
              {prettyDate(date, locale)} · {formatClock(f.depart)}–{formatClock(f.arrive)} · {formatDuration(f.duration)} · {f.number}
            </p>
          </li>
        ))}
      </ul>
      {passengers && <p className="t-caption mt-3 text-mist">{passengers.join(" · ")}</p>}
      <dl className="mt-4 grid grid-cols-[1fr_auto] gap-y-1 border-t border-white/[0.08] pt-3 text-[14px]">
        <dt className="text-ash">
          {t.fare} · {pax}×
        </dt>
        <dd className="text-right">{formatVND(price.fare)}</dd>
        <dt className="text-ash">{t.taxes}</dt>
        <dd className="text-right">{formatVND(price.taxes)}</dd>
        <dt className="text-ash">{t.fees}</dt>
        <dd className="text-right">{formatVND(price.fees)}</dd>
        <dt className="mt-1 text-white">{t.total}</dt>
        <dd className="mt-1 text-right text-white">{formatVND(price.total)}</dd>
      </dl>
    </aside>
  );
}

/** A real, scannable QR code for the (demo) payment order. */
function PayQR({ text, label }: { text: string; label: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let alive = true;
    qrSvg(text).then((s) => alive && setSvg(s));
    return () => {
      alive = false;
    };
  }, [text]);
  return svg ? (
    // eslint-disable-next-line @next/next/no-img-element -- generated SVG
    <img src={svgDataUrl(svg)} alt={label} width={176} height={176} className="h-44 w-44" />
  ) : (
    <span className="block h-44 w-44 animate-pulse rounded-[10px] bg-black/10" />
  );
}
