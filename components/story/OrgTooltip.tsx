"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { storyBus } from "./bus";
import { ORG, type OrgId } from "./org";
import type { Dictionary } from "@/lib/i18n";

/**
 * The org chart's boxes are particles; this is their label: hovering (or
 * tapping) a box shows the role, its department and what it does, as text,
 * pinned under the box as the chart slowly turns.
 */
export default function OrgTooltip({ nodes }: { nodes: Dictionary["organization"]["chart"]["nodes"] }) {
  const [id, setId] = useState<OrgId | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(
    () =>
      storyBus.onHover(() => {
        const h = storyBus.hover;
        setId(h && h.page === "organization" ? ORG[h.group - 1]?.id ?? null : null);
      }),
    [],
  );

  // Follow the box every frame while one is hovered.
  useEffect(() => {
    if (!id) return;
    const follow = () => {
      const h = storyBus.hover;
      const el = ref.current;
      if (!h || !el) return;
      const w = el.offsetWidth;
      const x = Math.min(window.innerWidth - w - 12, Math.max(12, h.x - w / 2));
      // under the box, or over it near the bottom of the screen
      const below = h.y + 12 + el.offsetHeight < window.innerHeight - 24;
      const y = below ? h.y + 12 : h.top - 12 - el.offsetHeight;
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    };
    follow();
    gsap.ticker.add(follow);
    return () => gsap.ticker.remove(follow);
  }, [id]);

  const node = id ? nodes[id] : null;
  return (
    <div ref={ref} role="status" aria-live="polite" className="org-tip" data-shown={node ? "" : undefined}>
      {node && (
        <>
          <span className="t-caption block uppercase tracking-[0.05em] text-azure">{node.dept}</span>
          <span className="mt-1 block text-[17px] font-semibold leading-snug">{node.title}</span>
          <span className="mt-1.5 block text-[14px] font-light leading-relaxed text-mist">{node.role}</span>
        </>
      )}
    </div>
  );
}
