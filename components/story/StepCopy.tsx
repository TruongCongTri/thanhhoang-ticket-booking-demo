"use client";

import { useSyncExternalStore } from "react";
import { storyBus } from "./bus";
import StepTicks from "./StepTicks";
import FlipText from "./FlipText";
import type { StoryPageId } from "@/lib/pages";

type Item = { name: string; body: string; figure?: string };

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * A stepped chapter's copy (Frame.steps): one item at a time, in step with
 * the group the particle model has lit or brought in as the chapter scrolls
 * by (storyBus.lit for `model`). The counter — and the item's figure, when it
 * has one (a share) — flip over in place. Every item stays in the page for
 * screen readers; only the current one is shown.
 */
export default function StepCopy({
  model,
  items,
  target,
}: {
  model: string;
  items: readonly Item[];
  /** Its stage, for the ticks to jump through. */
  target: { page: StoryPageId; stage: string };
}) {
  const lit = useSyncExternalStore(
    storyBus.onLit,
    () => storyBus.litOf(model),
    () => 0,
  );
  const current = Math.max(1, Math.min(items.length, lit)) - 1;
  const figure = items[current].figure;
  return (
    <div className="mt-7 max-w-[480px] max-md:mt-4">
      <StepTicks labels={items.map((v) => v.name)} current={current} target={target} className="mb-5" />
      <span className="t-caption block text-saffron">
        <FlipText value={`${pad(current + 1)} / ${pad(items.length)}`} />
      </span>
      {figure && (
        <span className="t-heading-lg mt-2 block tabular-nums text-saffron max-md:text-[48px]">
          <FlipText value={figure} />
        </span>
      )}
      <ol className="grid">
        {items.map((v, i) => (
          <li
            key={v.name}
            aria-current={i === current ? "true" : undefined}
            className={`value-item col-start-1 row-start-1 ${i === current ? "value-item-on" : ""}`}
          >
            {v.figure && <span className="sr-only">{v.figure} </span>}
            <span className={`block ${figure ? "t-heading-2xs mt-2" : "t-heading mt-2 max-md:text-[28px]"}`}>{v.name}</span>
            <span className="t-body mt-3 block text-mist max-md:text-[15px]">{v.body}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
