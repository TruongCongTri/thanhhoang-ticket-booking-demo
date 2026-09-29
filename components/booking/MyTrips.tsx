"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { BRAND } from "@/lib/brand";
import { legStatus, legTimes, gateFor, isInternational, seatFor, terminalFor, type LegStage } from "@/lib/boarding";
import { airport, formatClock, formatDuration, formatVND } from "@/lib/flights";
import { fill, intlLocale, plural, type Dictionary, type Locale } from "@/lib/i18n";
import { TICKET_H, TICKET_W, downloadPng, downloadQr, qrSvg, qrText, svgDataUrl, ticketSvg } from "@/lib/ticket";
import { clearToasts, toast } from "@/lib/toast";
import {
  formatPhone,
  isVerified,
  lastPhone,
  normalizePhone,
  requestOtp,
  tripsFor,
  verifyOtp,
  type BookedLeg,
  type Booking,
} from "@/lib/trips";

type Strings = { t: Dictionary["trips"]; tc: Dictionary["checkout"]; tt: Dictionary["pass"] };

export function Spinner() {
  return <span className="spinner" aria-hidden />;
}

/** Where the lookup is: entering the number, entering the texted code, or looking at the trips. */
type Stage = "phone" | "otp" | "list";
const OTP_LENGTH = 6;
const RESEND_AFTER = 30; // seconds

/**
 * "My trips": every booking made with a phone number, found by that number
 * alone — after proving it's yours with a 6-digit code sent to it. Each
 * booking opens as boarding passes.
 */
export default function MyTrips({
  t,
  tc,
  tt,
  locale,
  initialPhone,
  onClose,
}: Strings & { locale: Locale; initialPhone?: string; onClose: () => void }) {
  const lang = intlLocale(locale);
  const [stage, setStage] = useState<Stage>("phone");
  const [phone, setPhone] = useState(() => formatPhone(initialPhone || lastPhone()));
  const [error, setError] = useState(false);
  const [sending, setSending] = useState(false);
  const [digits, setDigits] = useState<string[]>(() => Array(OTP_LENGTH).fill(""));
  const [verifying, setVerifying] = useState(false);
  const [otpError, setOtpError] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [found, setFound] = useState<{ phone: string; trips: Booking[] } | null>(null);
  const [open, setOpen] = useState<Booking | null>(null);
  const [focusPhone, setFocusPhone] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const boxRefs = useRef<(HTMLInputElement | null)[]>([]);
  const otpRef = useRef<HTMLDivElement>(null);
  // The clock the countdowns read, ticking every 30 s.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  // New results or a ticket opening: rise in (fromTo, so a repeat run in dev never strands them invisible).
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (el) gsap.fromTo(el.children, { y: 16, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, ease: "power3.out", stagger: 0.06 });
  }, [found, open]);

  const route = (l: BookedLeg) => `${airport(l.from).city} → ${airport(l.to).city}`;
  const whenText = (d: Date) => d.toLocaleString(lang, { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  const statusText = (l: BookedLeg) => {
    const times = legTimes(l);
    const s = legStatus(times, new Date(now));
    return {
      ...s,
      text: fill(t.status[s.stage], { left: formatDuration(s.left), when: whenText(times.onlineOpen) }),
    };
  };

  // Flights coming up within a day get a heads-up as soon as they're found.
  const warnSoon = (trips: Booking[]) => {
    trips.forEach((b) =>
      b.legs.forEach((l) => {
        const s = statusText(l);
        if (s.soon) toast("warning", s.text, fill(t.soonToast, { flight: `${l.airline} ${l.number}`, route: route(l) }));
      }),
    );
  };

  const showTrips = (p: string) => {
    clearToasts(); // the code SMS and any "wrong code" notes are done with
    const trips = tripsFor(p);
    setFound({ phone: p, trips });
    setOpen(null);
    setStage("list");
    if (!trips.length) toast("info", fill(t.noneToast, { phone: formatPhone(p) }));
    else warnSoon(trips);
  };

  /** Step 1: the number. A code goes to it (skipped if it's been verified this session). */
  const sendCode = (e?: React.FormEvent) => {
    e?.preventDefault();
    const p = normalizePhone(phone);
    setError(!p);
    if (!p) return;
    setSending(true);
    window.setTimeout(() => {
      setSending(false);
      if (isVerified(p)) return showTrips(p);
      const code = requestOtp(p);
      toast("info", fill(t.demoSms, { code }), fill(t.demoSmsBody, { phone: formatPhone(p) }), 20000);
      setDigits(Array(OTP_LENGTH).fill(""));
      setOtpError(false);
      setResendIn(RESEND_AFTER);
      setStage("otp");
    }, 900);
  };

  /** Step 2: the code. */
  const verify = (e?: React.FormEvent) => {
    e?.preventDefault();
    const p = normalizePhone(phone);
    const code = digits.join("");
    if (!p || code.length < OTP_LENGTH) return;
    setVerifying(true);
    window.setTimeout(() => {
      setVerifying(false);
      if (verifyOtp(p, code)) return showTrips(p);
      setOtpError(true);
      toast("warning", t.wrongCode, t.wrongCodeBody);
      setDigits(Array(OTP_LENGTH).fill(""));
      boxRefs.current[0]?.focus();
      if (otpRef.current) gsap.fromTo(otpRef.current, { x: -8 }, { x: 0, duration: 0.5, ease: "elastic.out(1, 0.3)" });
    }, 900);
  };

  /** Fills the boxes from index `at` with whatever digits were typed, pasted or autofilled. */
  const fillDigits = (at: number, raw: string) => {
    const incoming = raw.replace(/\D/g, "");
    if (!incoming) return;
    const start = incoming.length >= OTP_LENGTH ? 0 : at;
    const next = digits.slice();
    incoming
      .slice(0, OTP_LENGTH - start)
      .split("")
      .forEach((d, k) => (next[start + k] = d));
    setDigits(next);
    setOtpError(false);
    boxRefs.current[Math.min(start + incoming.length, OTP_LENGTH - 1)]?.focus();
  };

  /** "Find trips": back to the number, ready to type. */
  const findAgain = () => {
    setOpen(null);
    setStage("phone");
    setFocusPhone((n) => n + 1);
  };

  // Focus follows the step: the first code box, or the number after "Find trips".
  useEffect(() => {
    if (stage === "otp") boxRefs.current[0]?.focus();
  }, [stage]);
  useEffect(() => {
    if (!focusPhone) return;
    phoneRef.current?.focus();
    phoneRef.current?.select();
  }, [focusPhone]);

  // "Resend code" unlocks after a short wait.
  useEffect(() => {
    if (stage !== "otp" || resendIn <= 0) return;
    const id = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [stage, resendIn]);

  const ticketSummary = open
    ? open.legs
        .map((l) => `${l.from} → ${l.to} · ${new Date(legTimes(l).departure).toLocaleDateString(lang, { day: "2-digit", month: "short" })} ${formatClock(l.depart)} · ${l.number}`)
        .join("  ·  ")
    : "";

  return (
    <div
      data-panel
      className="dock-surface panel-in absolute inset-x-0 bottom-full z-20 mb-12 flex max-h-[58svh] origin-bottom flex-col md:max-h-[min(74svh,680px)]"
      role="dialog"
      aria-label={t.title}
    >
      <div className="shrink-0 border-b border-white/10 px-6 pt-5 pb-4">
        {stage === "list" && open && found ? (
          // Ticket header: the flight in one line, whose phone it is, and the way back
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button onClick={() => setOpen(null)} className="link-wave t-nav text-mist">
                ← {t.back}
              </button>
              <span className="flex items-center gap-3">
                <button onClick={findAgain} className="btn-ghost">
                  {t.findTrips}
                </button>
                <button onClick={onClose} className="t-nav text-ash transition-colors hover:text-saffron">
                  {t.close}
                </button>
              </span>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <p className="text-[17px] text-white">{ticketSummary}</p>
              <p className="t-caption text-mist">
                <span className="font-semibold tracking-[0.1em] text-azure">{open.code}</span> · {formatPhone(found.phone)}{" "}
                <span className="text-azure">✓ {t.verified}</span>
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="t-heading-2xs text-white">{t.title}</p>
                {stage === "list" && found && (
                  <p className="t-caption mt-1 text-mist">
                    {fill(t.forPhone, { phone: formatPhone(found.phone) })} <span className="text-azure">✓ {t.verified}</span>
                  </p>
                )}
              </div>
              <span className="flex items-center gap-3">
                {stage === "list" && (
                  <button onClick={findAgain} className="btn-ghost">
                    {t.findTrips}
                  </button>
                )}
                <button onClick={onClose} className="t-nav text-ash transition-colors hover:text-saffron">
                  {t.close}
                </button>
              </span>
            </div>

            {stage === "phone" && (
              <>
                <form onSubmit={sendCode} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                  <label className="block flex-1">
                    <span className="t-caption mb-1.5 block uppercase tracking-[0.05em] text-mist">
                      {tc.phone}
                      <span className="text-azure"> *</span>
                    </span>
                    <input
                      ref={phoneRef}
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        setError(false);
                      }}
                      placeholder={tc.phonePlaceholder}
                      className="input text-[20px]"
                      aria-invalid={error}
                      disabled={sending}
                      required
                    />
                  </label>
                  <button type="submit" className="btn-primary" disabled={sending || !phone.trim()} aria-busy={sending}>
                    {sending ? (
                      <>
                        <Spinner /> {t.sending}
                      </>
                    ) : (
                      t.find
                    )}
                  </button>
                </form>
                {error ? (
                  <p role="alert" className="t-caption mt-2 text-saffron">
                    {tc.phoneError}
                  </p>
                ) : (
                  <p className="t-caption mt-2 text-mist">{t.intro}</p>
                )}
              </>
            )}

            {stage === "otp" && (
              <form onSubmit={verify} className="mt-4 grid gap-3">
                <p className="t-caption text-mist">
                  {fill(t.otpSent, { phone: formatPhone(normalizePhone(phone)) })}{" "}
                  <button type="button" onClick={findAgain} className="link-wave ml-1 uppercase tracking-[0.05em] text-azure">
                    {t.changeNumber}
                  </button>
                </p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div ref={otpRef} role="group" aria-label={t.otpLabel} className="flex gap-2">
                    {digits.map((d, i) => (
                      <input
                        key={i}
                        ref={(el) => {
                          boxRefs.current[i] = el;
                        }}
                        value={d}
                        inputMode="numeric"
                        autoComplete={i === 0 ? "one-time-code" : "off"}
                        maxLength={i === 0 ? OTP_LENGTH : 1}
                        aria-label={fill(t.digit, { n: i + 1 })}
                        aria-invalid={otpError}
                        disabled={verifying}
                        className="input otp-box"
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, "");
                          if (v.length > 1) return fillDigits(i, v); // autofill or a pasted run of digits
                          const next = digits.slice();
                          next[i] = v;
                          setDigits(next);
                          setOtpError(false);
                          if (v && i < OTP_LENGTH - 1) boxRefs.current[i + 1]?.focus();
                        }}
                        onPaste={(e) => {
                          e.preventDefault();
                          fillDigits(i, e.clipboardData.getData("text"));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Backspace" && !digits[i] && i > 0) {
                            e.preventDefault();
                            const next = digits.slice();
                            next[i - 1] = "";
                            setDigits(next);
                            boxRefs.current[i - 1]?.focus();
                          } else if (e.key === "ArrowLeft" && i > 0) boxRefs.current[i - 1]?.focus();
                          else if (e.key === "ArrowRight" && i < OTP_LENGTH - 1) boxRefs.current[i + 1]?.focus();
                        }}
                      />
                    ))}
                  </div>
                  <button
                    type="submit"
                    className="btn-primary sm:ml-2"
                    disabled={verifying || digits.join("").length < OTP_LENGTH}
                    aria-busy={verifying}
                  >
                    {verifying ? (
                      <>
                        <Spinner /> {t.verifying}
                      </>
                    ) : (
                      t.verify
                    )}
                  </button>
                </div>
                <p className="t-caption text-mist">
                  {otpError && <span className="mr-3 text-saffron">{t.wrongCode}.</span>}
                  {resendIn > 0 ? (
                    fill(t.resendIn, { s: resendIn })
                  ) : (
                    <button type="button" onClick={() => sendCode()} disabled={sending} className="link-wave uppercase tracking-[0.05em] text-azure">
                      {sending ? t.sending : t.resend}
                    </button>
                  )}
                </p>
              </form>
            )}
          </>
        )}
      </div>

      {stage === "list" && found && (
        <div ref={bodyRef} data-lenis-prevent className="scroll-thin panel-scroll min-h-0 flex-1 overflow-y-auto py-4">
          {open ? (
            <TicketView key={open.code} booking={open} t={t} tt={tt} locale={locale} now={now} statusText={statusText} />
          ) : (
            <>
              <p className="t-caption mb-3 uppercase tracking-[0.05em] text-mist" aria-live="polite">
                {found.trips.length
                  ? plural(t.found, found.trips.length, { phone: formatPhone(found.phone) })
                  : fill(t.none, { phone: formatPhone(found.phone) })}
              </p>
              {found.trips.map((b) => {
                const next = b.legs.map(statusText).find((s) => s.stage !== "departed") ?? statusText(b.legs[b.legs.length - 1]);
                return (
                  <article key={b.code} className="trip-card mb-3">
                    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
                      <p className="text-[22px] font-semibold tracking-[0.12em] text-azure">{b.code}</p>
                      <StatusBadge stage={next.stage} soon={next.soon} text={next.text} />
                    </div>
                    <ul className="mt-3 grid gap-1.5">
                      {b.legs.map((l) => (
                        <li key={`${l.number}-${l.date}`} className="flex flex-wrap items-baseline gap-x-3">
                          <span className="whitespace-nowrap text-[16px] text-white">
                            {airport(l.from).city} <span className="text-ash">→</span> {airport(l.to).city}
                          </span>
                          <span className="t-caption text-mist">
                            {new Date(legTimes(l).departure).toLocaleDateString(lang, { weekday: "short", day: "2-digit", month: "short" })} ·{" "}
                            {formatClock(l.depart)}–{formatClock(l.arrive)} · {l.airline} {l.number}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <p className="t-caption text-mist">
                        <span className="text-azure">● {t.confirmed}</span> · {b.passengers.join(" · ")} · {tc.methods[b.method].name} ·{" "}
                        {formatVND(b.total)}
                      </p>
                      <button onClick={() => setOpen(b)} className="btn-ghost">
                        {t.view} →
                      </button>
                    </div>
                  </article>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ stage, soon, text }: { stage: LegStage; soon: boolean; text: string }) {
  const tone = stage === "departed" ? "muted" : soon ? "warn" : "info";
  return <span className={`status-badge status-${tone}`}>{text}</span>;
}

type TicketCard = { key: string; svg: string; qr: string; file: string };

/** One booking as boarding passes: per flight, its travel-day timeline and a pass per passenger. */
function TicketView({
  booking: b,
  t,
  tt,
  locale,
  now,
  statusText,
}: {
  booking: Booking;
  t: Dictionary["trips"];
  tt: Dictionary["pass"];
  locale: Locale;
  now: number;
  statusText: (l: BookedLeg) => { stage: LegStage; soon: boolean; urgent: boolean; text: string };
}) {
  const lang = intlLocale(locale);
  const [cards, setCards] = useState<Record<string, TicketCard>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const clock = (d: Date) => d.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit", hour12: false });
  const day = (d: Date) => d.toLocaleDateString(lang, { weekday: "short", day: "2-digit", month: "short" });

  useEffect(() => {
    let alive = true;
    (async () => {
      const out: Record<string, TicketCard> = {};
      for (const [li, leg] of b.legs.entries()) {
        const times = legTimes(leg);
        for (const [pi, passenger] of b.passengers.entries()) {
          const input = {
            brand: BRAND.name,
            code: b.code,
            passenger,
            seat: seatFor(b.code, li, pi),
            gate: gateFor(b.code, li),
            terminal: terminalFor(leg),
            leg,
            dateText: day(times.departure),
            boardingText: clock(times.boarding),
            gateCloseText: clock(times.gateClose),
            labels: tt,
          };
          const text = qrText(input);
          const key = `${li}-${pi}`;
          out[key] = {
            key,
            svg: ticketSvg(input, await qrSvg(text)),
            qr: text,
            file: `${b.code}-${leg.from}${leg.to}-${passenger.split(/\s+/).pop() ?? pi}`.replace(/[^\w-]/g, ""),
          };
        }
      }
      if (alive) setCards(out);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- built once per booking and language
  }, [b, lang]);

  const run = async (id: string, file: string, job: () => Promise<void>) => {
    setBusy(id);
    try {
      await job();
      toast("success", fill(t.downloaded, { file }));
    } catch {
      toast("warning", t.downloadFailed);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid gap-6">
      {b.legs.map((leg, li) => {
        const times = legTimes(leg);
        const s = statusText(leg);
        const steps: [string, Date][] = [
          [t.steps.onlineOpen, times.onlineOpen],
          [t.steps.counterOpen, times.counterOpen],
          [t.steps.counterClose, times.counterClose],
          [t.steps.boarding, times.boarding],
          [t.steps.gateClose, times.gateClose],
          [t.steps.departure, times.departure],
        ];
        return (
          <section key={li} className="grid gap-4">
            <div>
              <p className="text-[18px] text-white">
                {airport(leg.from).city} <span className="text-ash">→</span> {airport(leg.to).city}
              </p>
              <p className="t-caption text-mist">
                {day(times.departure)} · {leg.airline} {leg.number} · {terminalFor(leg)}
              </p>
            </div>

            {/* Heads-up: yellow within the last day, blue before that */}
            <p role={s.urgent ? "alert" : undefined} className={`notice ${s.stage === "departed" ? "notice-muted" : s.soon ? "notice-warn" : "notice-info"}`}>
              <span aria-hidden>{s.soon ? "!" : "i"}</span>
              {s.text}
            </p>

            <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
              <div>
                <p className="t-caption mb-2 uppercase tracking-[0.05em] text-mist">{t.timeline}</p>
                <ol className="timeline">
                  {steps.map(([label, at]) => (
                    <li key={label} className={at.getTime() < now ? "timeline-past" : ""}>
                      {/* the date too, whenever it isn't the day of departure (a flight just after midnight) */}
                      <span className="tabular-nums text-white">
                        {at.toDateString() !== times.departure.toDateString() ? `${day(at)} ${clock(at)}` : clock(at)}
                      </span>
                      <span className="t-caption text-mist">{label}</span>
                    </li>
                  ))}
                </ol>
                <p className="t-caption mt-3 text-ash">{isInternational(leg) ? t.rules.international : t.rules.domestic}</p>
              </div>

              <div className="grid gap-4">
                {b.passengers.map((p, pi) => {
                  const c = cards[`${li}-${pi}`];
                  return (
                    <figure key={pi} className="grid gap-2">
                      {c ? (
                        // eslint-disable-next-line @next/next/no-img-element -- a generated SVG, shown as the exact image you download
                        <img src={svgDataUrl(c.svg)} alt={`${tt.boardingPass} · ${p} · ${leg.number}`} className="w-full rounded-[18px]" width={TICKET_W} height={TICKET_H} />
                      ) : (
                        <div className="aspect-[1000/380] w-full animate-pulse rounded-[18px] bg-white/[0.06]" />
                      )}
                      <figcaption className="flex flex-wrap gap-2">
                        <button
                          className="btn-ghost"
                          disabled={!c || !!busy}
                          aria-busy={busy === `t${li}-${pi}`}
                          onClick={() => c && run(`t${li}-${pi}`, `${c.file}.png`, () => downloadPng(c.svg, TICKET_W, TICKET_H, `${c.file}.png`))}
                        >
                          {busy === `t${li}-${pi}` ? (
                            <>
                              <Spinner /> {t.downloading}
                            </>
                          ) : (
                            `↓ ${t.download}`
                          )}
                        </button>
                        <button
                          className="btn-ghost"
                          disabled={!c || !!busy}
                          aria-busy={busy === `q${li}-${pi}`}
                          onClick={() => c && run(`q${li}-${pi}`, `${c.file}-QR.png`, () => downloadQr(c.qr, `${c.file}-QR.png`))}
                        >
                          {busy === `q${li}-${pi}` ? (
                            <>
                              <Spinner /> {t.downloading}
                            </>
                          ) : (
                            `↓ ${t.downloadQr}`
                          )}
                        </button>
                      </figcaption>
                    </figure>
                  );
                })}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
