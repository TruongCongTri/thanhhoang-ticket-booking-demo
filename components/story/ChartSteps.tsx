"use client";

import { useSyncExternalStore } from "react";
import { storyBus } from "./bus";
import StepTicks from "./StepTicks";

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
      <StepTicks labels={levels.map((l) => l.title)} current={current} target={{ page: "organization", stage: "chart" }} className="mb-7 max-w-[420px]" />
      <ol className="grid">
        {levels.map((l, i) => (
          <li
            key={l.label}
            aria-current={i === current ? "step" : undefined}
            className={`value-item col-start-1 row-start-1 ${i === current ? "value-item-on" : ""}`}
          >
            <p className="t-label mb-6 max-md:mb-3">{l.label}</p>
            <h2 className="t-heading max-md:text-[28px]">{l.title}</h2>
            <p className="t-body mt-6 max-w-[420px] text-mist max-md:mt-4 max-md:text-[15px]">
              {l.body}
              {i === levels.length - 1 && <span className="mt-3 block text-ash md:hidden">{hint}</span>}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
