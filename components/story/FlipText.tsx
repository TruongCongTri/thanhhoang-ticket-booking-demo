"use client";

import { useState } from "react";

/** The first number in a string (for which way to flip), or NaN. */
const numberIn = (s: string) => parseInt(s.match(/\d+/)?.[0] ?? "", 10);

/**
 * Text that stays where it is and flips only the characters that change,
 * like a split-flap board: "03 / 04" → "04 / 04" turns just the 3, and
 * "2016 – 2018" → "2019 – 2021" rolls the changed digits one after another.
 * Counting up it flips upward, counting down it flips back the other way.
 */
export default function FlipText({ value, className = "" }: { value: string; className?: string }) {
  // The value on show and the one before it; `gen` counts changes (it keys the flips).
  const [s, setS] = useState({ value, from: value, gen: 0 });
  if (s.value !== value) setS({ value, from: s.value, gen: s.gen + 1 });

  const up = !(numberIn(s.value) < numberIn(s.from));
  const len = Math.max(s.value.length, s.from.length);
  let changed = 0;
  return (
    <span className={`flip ${className}`}>
      <span className="sr-only">{s.value}</span>
      <span aria-hidden className="flip-row">
        {Array.from({ length: len }, (_, i) => {
          const c = s.value[i] ?? "";
          const p = s.from[i] ?? "";
          if (s.gen === 0 || c === p) {
            return (
              <span key={i} className="flip-slot">
                {c}
              </span>
            );
          }
          const delay = { animationDelay: `${changed++ * 55}ms` };
          return (
            <span key={i} className="flip-slot">
              <span key={`in-${s.gen}`} className={`flip-in ${up ? "is-up" : "is-down"}`} style={delay}>
                {c || "​"}
              </span>
              {p && (
                <span key={`out-${s.gen}`} className={`flip-out ${up ? "is-up" : "is-down"}`} style={delay}>
                  {p}
                </span>
              )}
            </span>
          );
        })}
      </span>
    </span>
  );
}
