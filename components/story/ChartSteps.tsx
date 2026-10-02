"use client";

import { useSyncExternalStore } from "react";
import { storyBus } from "./bus";

type Level = { label: string; title: string; body: string };

/**
 * The org chart's copy, held still beside it: one level at a time — the
 * board, the heads, their teams — in step with the level the particle chart
 * is bringing in as the chapter scrolls by (storyBus.lit). Every level stays
 * in the page for screen readers; only the current one is shown.
 */
export default function ChartSteps({ levels, hint }: { levels: readonly Level[]; hint: string }) {
  const step = useSyncExternalStore(
    storyBus.onLit,
    () => storyBus.litOf("org"),
    () => 0,
  );
  const current = Math.max(1, Math.min(levels.length, step)) - 1;
  return (
    <div>
      {/* where we are: one tick per level */}
      <div aria-hidden className="mb-7 flex max-w-[420px] gap-2">
        {levels.map((l, i) => (
          <span
            key={l.label}
            className={`h-1 flex-1 rounded-full transition-colors duration-500 ${i === current ? "bg-azure" : i < current ? "bg-white/35" : "bg-white/12"}`}
          />
        ))}
      </div>
      <ol className="grid">
        {levels.map((l, i) => (
          <li
            key={l.label}
            aria-current={i === current ? "step" : undefined}
            className={`value-item col-start-1 row-start-1 ${i === current ? "value-item-on" : ""}`}
          >
            <p className="t-label mb-6">{l.label}</p>
            <h2 className="t-heading">{l.title}</h2>
            <p className="t-body mt-6 max-w-[420px] text-mist">
              {l.body}
              {i === levels.length - 1 && <span className="mt-3 block text-ash md:hidden">{hint}</span>}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
