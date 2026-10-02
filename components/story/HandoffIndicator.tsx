import type { Ref } from "react";

/** Triangles around the ring. */
const TICKS = 28;
const R = 27;

/** A small triangle (a particle seen face-on), centred on x, y, pointing along angle a. */
function tri(x: number, y: number, size: number, a: number) {
  return [0, 1, 2]
    .map((k) => {
      const t = a + (k * 2 * Math.PI) / 3;
      return `${(x + Math.cos(t) * size).toFixed(2)},${(y + Math.sin(t) * size).toFixed(2)}`;
    })
    .join(" ");
}

/** The arrow: a stem and a chevron, built from the same triangles. */
const ARROW: [number, number][] = [
  [32, 20],
  [32, 26],
  [32, 32],
  [32, 38],
  [26, 33],
  [38, 33],
  [29, 36],
  [35, 36],
];

/**
 * The hand-off's progress ring, drawn the way the particles are: a circle of
 * small triangles that light up one by one as you keep scrolling, around an
 * arrow (pointing the way to scroll) built from the same triangles.
 * Drive it with `paintIndicator`.
 */
export default function HandoffIndicator({ ref, direction }: { ref?: Ref<HTMLDivElement>; direction: "up" | "down" }) {
  return (
    <div ref={ref} className={`handoff-indicator ${direction === "up" ? "is-up" : ""}`} aria-hidden>
      <svg viewBox="0 0 64 64" className="h-full w-full overflow-visible">
        {Array.from({ length: TICKS }, (_, i) => {
          const a = -Math.PI / 2 + (i / TICKS) * 2 * Math.PI;
          return <polygon key={i} data-tick className="handoff-tick" points={tri(32 + Math.cos(a) * R, 32 + Math.sin(a) * R, 2.1, a + Math.PI / 2)} />;
        })}
        <g className="handoff-arrow">
          {ARROW.map(([x, y], i) => (
            <polygon key={i} className="handoff-arrow-tri" style={{ animationDelay: `${i * 0.06}s` }} points={tri(x, y, 2.3, Math.PI / 2)} />
          ))}
        </g>
      </svg>
    </div>
  );
}

/** Lights the first p (0..1) of the ring's triangles. */
export function paintIndicator(root: HTMLElement | null, p: number) {
  if (!root) return;
  const ticks = root.querySelectorAll<SVGPolygonElement>("[data-tick]");
  const lit = Math.round(p * ticks.length);
  ticks.forEach((t, i) => {
    t.toggleAttribute("data-on", i < lit);
    t.toggleAttribute("data-head", i === lit - 1);
  });
  root.toggleAttribute("data-full", lit >= ticks.length);
}
