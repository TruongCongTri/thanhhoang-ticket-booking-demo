"use client";

import { useSyncExternalStore } from "react";
import { storyBus } from "./bus";
import FlipText from "./FlipText";

type Value = { name: string; body: string };

/**
 * The core values, one at a time: whichever fist the particle model has lit
 * as the chapter scrolls by (storyBus.lit). Every value stays in the page
 * for screen readers; only the current one is shown.
 */
export default function ValuesList({ items }: { items: Value[] }) {
  const lit = useSyncExternalStore(
    storyBus.onLit,
    () => storyBus.litOf("values"),
    () => 0,
  );
  const current = Math.max(1, Math.min(items.length, lit)) - 1;
  return (
    <div className="mt-8 max-w-[480px]">
      {/* where we are: one tick per value */}
      <div aria-hidden className="mb-6 flex gap-2">
        {items.map((v, i) => (
          <span
            key={v.name}
            className={`h-1 flex-1 rounded-full transition-colors duration-500 ${i === current ? "bg-azure" : i < current ? "bg-white/35" : "bg-white/12"}`}
          />
        ))}
      </div>
      {/* Held still: the counter flips over to the value on show */}
      <span className="t-caption block text-saffron">
        <FlipText value={`${String(current + 1).padStart(2, "0")} / ${String(items.length).padStart(2, "0")}`} />
      </span>
      <ol className="grid">
        {items.map((v, i) => (
          <li
            key={v.name}
            aria-current={i === current ? "true" : undefined}
            className={`value-item col-start-1 row-start-1 ${i === current ? "value-item-on" : ""}`}
          >
            <span className="t-heading mt-2 block">{v.name}</span>
            <span className="t-body mt-3 block text-mist">{v.body}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
