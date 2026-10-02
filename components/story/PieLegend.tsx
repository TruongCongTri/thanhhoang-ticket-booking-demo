"use client";

import { useSyncExternalStore } from "react";
import { jumpToStep, storyBus } from "./bus";

type Share = { label: string; share: string };

/** Swatches in the slices' colours (PIE in models.ts: yellow, blue, grey). */
const SWATCH = ["bg-saffron", "bg-azure", "bg-ash"];

/**
 * The pie's legend, the three shares side by side. As the chapter scrolls
 * by, the particle pie lights one slice after another (storyBus.lit); the
 * same share is lit here.
 */
export default function PieLegend({ title, items }: { title: string; items: Share[] }) {
  const lit = useSyncExternalStore(
    storyBus.onLit,
    () => storyBus.litOf("pie"),
    () => 0,
  );
  return (
    <figure className="mt-7 max-w-[480px]">
      <figcaption className="t-caption mb-3 uppercase tracking-[0.05em] text-ash">{title}</figcaption>
      <ul className="grid grid-cols-3 gap-5">
        {items.map((s, i) => {
          const on = lit === i + 1;
          return (
            <li key={s.label}>
              <button
                type="button"
                aria-current={on ? "true" : undefined}
                onClick={() => jumpToStep("organization", "people", i)}
                className={`w-full cursor-pointer text-left hover:border-saffron border-t-2 pt-3 transition-[opacity,border-color] duration-500 ${on ? "border-saffron" : "border-white/15"} ${lit && !on ? "opacity-50" : ""}`}
              >
              <span className={`t-heading block tabular-nums transition-colors duration-500 ${on ? "text-saffron" : ""}`}>{s.share}</span>
              <span className="t-caption mt-1 flex items-center gap-2 text-[13px] text-mist">
                <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-[3px] ${SWATCH[i]}`} />
                {s.label}
              </span>
              </button>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}
