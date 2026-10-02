"use client";

import { useSyncExternalStore } from "react";
import { storyBus } from "./bus";
import StepTicks from "./StepTicks";
import FlipText from "./FlipText";
import type { StoryPageId } from "@/lib/pages";

type Item = { name: string; body: string };

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Copy held still across a run of chapters (one per item) that each have
 * their own particle model — the featured services: it shows whichever item
 * the scene is on (storyBus "frame:<page>"), its number flipping over as the
 * model sweeps into the next.
 */
export default function FrameCopy({
  page,
  first,
  label,
  items,
  ids,
}: {
  page: StoryPageId;
  /** The scene's frame index of the first item. */
  first: number;
  label: string;
  items: readonly Item[];
  /** Each item's chapter, for the ticks to link to. */
  ids: readonly string[];
}) {
  const frame = useSyncExternalStore(
    storyBus.onLit,
    () => storyBus.litOf(`frame:${page}`),
    () => first,
  );
  const current = Math.max(0, Math.min(items.length - 1, frame - first));
  return (
    <div className="max-w-[480px]">
      <p className="t-label mb-5">{label}</p>
      <StepTicks labels={items.map((m) => m.name)} current={current} hrefs={ids.map((id) => `#${id}`)} className="mb-6" />
      {/* Held still: the big number and the counter flip over to the item on show */}
      <span className="t-display block leading-none tabular-nums text-saffron max-md:text-[64px]">
        <FlipText value={pad(current + 1)} />
      </span>
      <span className="t-caption mt-2 block text-ash">
        <FlipText value={`${pad(current + 1)} / ${pad(items.length)}`} />
      </span>
      <ol className="mt-5 grid">
        {items.map((m, i) => (
          <li
            key={m.name}
            aria-current={i === current ? "true" : undefined}
            className={`value-item col-start-1 row-start-1 ${i === current ? "value-item-on" : ""}`}
          >
            <span className="t-heading block max-md:text-[28px]">{m.name}</span>
            <span className="t-body mt-5 block text-mist max-md:mt-3 max-md:text-[15px]">{m.body}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
