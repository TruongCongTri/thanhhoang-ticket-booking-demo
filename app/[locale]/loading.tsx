import { ERROR_COPY } from "@/lib/error-copy";

/** Triangles around the ring, as the hand-off's indicator. */
const TICKS = 12;

/**
 * Shown the moment a navigation starts while the next page is still on its
 * way (a slow connection, a page not prefetched): a ring of the particles'
 * triangles chasing each other around the company's mark. On a first visit
 * the boot logo and the particle loading screen cover this instead.
 */
export default function Loading() {
  return (
    <div role="status" className="route-loading">
      <svg aria-hidden viewBox="0 0 64 64" className="route-loading-ring">
        {Array.from({ length: TICKS }, (_, i) => {
          const a = -Math.PI / 2 + (i / TICKS) * Math.PI * 2;
          const [x, y] = [32 + Math.cos(a) * 26, 32 + Math.sin(a) * 26];
          const points = [0, 1, 2]
            .map((k) => {
              const t = a + Math.PI / 2 + (k * Math.PI * 2) / 3;
              return `${(x + Math.cos(t) * 3).toFixed(2)},${(y + Math.sin(t) * 3).toFixed(2)}`;
            })
            .join(" ");
          return <polygon key={i} points={points} style={{ animationDelay: `${(i / TICKS) * 1.2 - 1.2}s` }} />;
        })}
      </svg>
      <span className="sr-only">
        {ERROR_COPY.vi.loading} · {ERROR_COPY.en.loading}
      </span>
    </div>
  );
}
