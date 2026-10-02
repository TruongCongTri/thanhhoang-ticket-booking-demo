"use client";

import { useSyncExternalStore } from "react";
import { storyBus } from "./bus";
import StepTicks from "./StepTicks";
import FlipText from "./FlipText";

type Period = { years: string; items: readonly string[] };

/**
 * The awards timeline, one period at a time, in step with the star the
 * particle trophy has lit (storyBus.lit for "trophy"): the years flip over in
 * place, and that period's awards are listed under them.
 */
export default function AwardSteps({ periods }: { periods: readonly Period[] }) {
  const lit = useSyncExternalStore(
    storyBus.onLit,
    () => storyBus.litOf("trophy"),
    () => 0,
  );
  const current = Math.max(1, Math.min(periods.length, lit)) - 1;
  return (
    <div className="mt-6 max-w-[480px] max-md:mt-4">
      <StepTicks labels={periods.map((p) => p.years)} current={current} target={{ page: "achievements", stage: "awards" }} className="mb-4" />
      <span className="t-heading block tabular-nums text-saffron max-md:text-[30px]">
        <FlipText value={periods[current].years} />
      </span>
      <ol className="mt-3 grid">
        {periods.map((p, i) => (
          <li
            key={p.years}
            aria-current={i === current ? "true" : undefined}
            className={`value-item col-start-1 row-start-1 ${i === current ? "value-item-on" : ""}`}
          >
            <span className="sr-only">{p.years}: </span>
            <ul className="grid gap-2">
              {p.items.map((a) => (
                <li key={a} className="flex gap-3 text-[15px] font-light leading-snug text-mist md:text-[16px]">
                  <span aria-hidden className="mt-[0.45em] h-1.5 w-1.5 shrink-0 rotate-45 bg-saffron" />
                  {a}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
