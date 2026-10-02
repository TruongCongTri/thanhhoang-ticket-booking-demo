"use client";

import { jumpToStep } from "./bus";
import type { StoryPageId } from "@/lib/pages";

/**
 * The progress ticks over a run of steps — one per item, the current one lit
 * — and a way through them by click instead of scroll: each tick jumps to
 * its step (a stepped stage), or to its chapter (`hrefs`: chapters with a
 * model of their own, followed by smooth scrolling like any #link).
 */
export default function StepTicks({
  labels,
  current,
  target,
  hrefs,
  className = "mb-6",
}: {
  labels: readonly string[];
  current: number;
  /** A stepped stage: where clicking a tick goes. */
  target?: { page: StoryPageId; stage: string };
  /** Or one #chapter per item. */
  hrefs?: readonly string[];
  className?: string;
}) {
  const bar = (i: number) =>
    `block h-1 w-full rounded-full transition-colors duration-500 group-hover:bg-saffron ${i === current ? "bg-azure" : i < current ? "bg-white/35" : "bg-white/12"}`;
  return (
    <nav aria-label={labels.join(", ")} className={`flex gap-2 ${className}`}>
      {labels.map((label, i) =>
        hrefs ? (
          <a key={label} href={hrefs[i]} aria-label={label} aria-current={i === current ? "step" : undefined} title={label} className="group flex-1 py-2">
            <span className={bar(i)} />
          </a>
        ) : (
          <button
            key={label}
            type="button"
            aria-label={label}
            aria-current={i === current ? "step" : undefined}
            title={label}
            onClick={() => target && jumpToStep(target.page, target.stage, i)}
            className="group flex-1 cursor-pointer py-2"
          >
            <span className={bar(i)} />
          </button>
        ),
      )}
    </nav>
  );
}
