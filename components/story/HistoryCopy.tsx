"use client";

import { useSyncExternalStore } from "react";
import { storyBus } from "./bus";
import FlipText from "./FlipText";

type Milestone = { years: string; title: string; body: string };

/** The scene's frame index of the first year (frame 0 is the logo). */
const FIRST_FRAME = 1;

/**
 * The history's copy, held still while its four chapters scroll by: it
 * shows whichever milestone the particle model is on (the year gliding
 * along the flight path), so text and 3D always match — as the core values.
 */
export default function HistoryCopy({ label, quote, items }: { label: string; quote: string; items: Milestone[] }) {
  const frame = useSyncExternalStore(
    storyBus.onLit,
    () => storyBus.litOf("frame:about"),
    () => FIRST_FRAME,
  );
  const current = Math.max(0, Math.min(items.length - 1, frame - FIRST_FRAME));
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <div className="max-w-[480px]">
      <p className="t-label mb-5">{label}</p>
      <div aria-hidden className="mb-6 flex gap-2">
        {items.map((m, i) => (
          <span
            key={m.years}
            className={`h-1 flex-1 rounded-full transition-colors duration-500 ${i === current ? "bg-azure" : i < current ? "bg-white/35" : "bg-white/12"}`}
          />
        ))}
      </div>
      {/* Held still: the counter and the years flip over to the milestone on show */}
      <span className="t-caption block text-saffron">
        <FlipText value={`${pad(current + 1)} / ${pad(items.length)}`} />
      </span>
      <span className="t-heading-2xs mt-3 block tabular-nums text-saffron">
        <FlipText value={items[current].years} />
      </span>
      <ol className="grid">
        {items.map((m, i) => (
          <li
            key={m.years}
            aria-current={i === current ? "true" : undefined}
            className={`value-item col-start-1 row-start-1 ${i === current ? "value-item-on" : ""}`}
          >
            <span className="sr-only">{m.years}: </span>
            <span className="t-heading-lg mt-2 block">{m.title}</span>
            <span className="t-body mt-6 block text-mist">{m.body}</span>
            {i === 0 && (
              <span className="t-body mt-6 block border-l border-azure/50 pl-5 italic text-ash">“{quote}”</span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
