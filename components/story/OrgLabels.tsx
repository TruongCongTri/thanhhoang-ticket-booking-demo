"use client";

import { Fragment, useEffect, useMemo, useRef } from "react";
import gsap from "gsap";
import { storyBus } from "./bus";
import { ORG } from "./org";
import type { Dictionary } from "@/lib/i18n";

/** A position's particle counts as arrived (and its name may follow) from here; below the second, it has left. */
const ARRIVED = 0.97;
const LEFT = 0.6;
/** Seconds a name takes to gather, and to scatter again. */
const GATHER = 1.1;
const SCATTER = 0.45;

/** A letter's flight: where it comes from (px, relative to its place), how large, and when it sets off (0..1 of the gather). */
type Flight = { dx: number; dy: number; s: number; at: number };

const mulberry = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * The org chart's names: each position is a particle (the larger, the
 * higher it stands); its title sits beside it as text. A name waits until its
 * particle has gathered into place, then gathers in after it the way the
 * particles do — its letters flying in from scattered points, large and
 * faint, settling one after another — and scatters again when the position
 * leaves. Wide screens only: on phones the chart fills the screen behind the
 * copy, and a tap shows a position instead (OrgTooltip).
 */
export default function OrgLabels({ nodes }: { nodes: Dictionary["organization"]["chart"]["nodes"] }) {
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([]);

  // Each title split into words (kept whole across line breaks) of letters, with each letter's flight.
  const titles = useMemo(
    () =>
      ORG.map((n, k) => {
        const rand = mulberry(k * 7919 + 17);
        const words = nodes[n.id].title.split(" ");
        const count = words.join("").length;
        let index = 0;
        return words.map((w) =>
          [...w].map((ch) => {
            const angle = rand() * Math.PI * 2;
            const dist = 90 + rand() * 170;
            const flight: Flight = {
              dx: Math.cos(angle) * dist,
              dy: Math.sin(angle) * dist * 0.7,
              s: 1.8 + rand() * 1.6,
              at: (index++ / Math.max(1, count)) * 0.45 + rand() * 0.1,
            };
            return { ch, flight };
          }),
        );
      }),
    [nodes],
  );

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const state = ORG.map(() => ({ on: false, p: 0 }));
    // each name's letters, in order
    const letters = labelRefs.current.map((el) => Array.from(el?.querySelectorAll<HTMLSpanElement>(".org-char") ?? []));

    const paint = (k: number) => {
      const p = state[k].p;
      const chars = letters[k] ?? [];
      const flights = titles[k].flat();
      chars.forEach((el, j) => {
        if (!el) return;
        const f = flights[j].flight;
        // each letter's own share of the gather, eased in like a particle settling
        const q = easeOut(Math.max(0, Math.min(1, (p - f.at) / 0.55)));
        el.style.opacity = q.toFixed(3);
        el.style.transform =
          q >= 1 ? "" : `translate3d(${(f.dx * (1 - q)).toFixed(1)}px, ${(f.dy * (1 - q)).toFixed(1)}px, 0) scale(${(1 + (f.s - 1) * (1 - q)).toFixed(3)})`;
      });
    };

    const follow = () => {
      const now = storyBus.nodes;
      const list = now?.page === "organization" ? now.list : null;
      const hovered = storyBus.hover?.page === "organization" ? storyBus.hover.group : 0;
      labelRefs.current.forEach((el, k) => {
        if (!el) return;
        const n = list?.[k];
        const shown = n?.shown ?? 0;
        const s = state[k];
        // the particle first, then its name
        if (!s.on && shown >= ARRIVED) {
          s.on = true;
          gsap.to(s, { p: 1, duration: reduced ? 0 : GATHER, ease: "none", overwrite: true, onUpdate: () => paint(k) });
        } else if (s.on && shown < LEFT) {
          s.on = false;
          gsap.to(s, { p: 0, duration: reduced ? 0 : SCATTER, ease: "power1.in", overwrite: true, onUpdate: () => paint(k) });
        }
        el.style.visibility = s.p > 0.001 && n ? "visible" : "hidden";
        if (n) el.style.transform = `translate3d(${(n.x + n.r + 8).toFixed(1)}px, ${n.y.toFixed(1)}px, 0) translateY(-50%)`;
        el.toggleAttribute("data-hovered", hovered === n?.group);
      });
    };
    gsap.ticker.add(follow);
    return () => {
      gsap.ticker.remove(follow);
      gsap.killTweensOf(state);
    };
  }, [titles]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-5 hidden overflow-hidden lg:block">
      {ORG.map((n, k) => {
        let j = 0;
        return (
          <span
            key={n.id}
            ref={(el) => {
              labelRefs.current[k] = el;
            }}
            data-level={n.level}
            className="org-label"
          >
            {titles[k].map((word, w) => (
              <Fragment key={w}>
                {w > 0 && " "}
                <span className="org-word">
                {word.map(({ ch }) => {
                  const at = j++;
                  return (
                    <span key={at} className="org-char">
                      {ch}
                    </span>
                  );
                })}
                </span>
              </Fragment>
            ))}
          </span>
        );
      })}
    </div>
  );
}
