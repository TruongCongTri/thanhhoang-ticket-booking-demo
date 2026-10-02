/**
 * One chapter of a story page: 1.5 screens of scroll (SECTION_VH in the
 * scenes), with its copy scrolling freely while the 3D changes in step with it.
 */
export default function Stage({
  id,
  side,
  narrow = false,
  pin = false,
  screens = 0,
  children,
}: {
  id: string;
  /**
   * "hero" = near the top of the first screen; "middle" = centred, for the
   * open-sky chapters; "left" / "right" = beside the model; "end" = at the
   * bottom, under the logo.
   */
  side: "hero" | "left" | "right" | "middle" | "end";
  /** A slimmer column, when the model beside it reaches toward the centre. */
  narrow?: boolean;
  /**
   * The copy holds still near the top of the screen while the chapter
   * scrolls by (the 3D steps through something beside it), and leaves with
   * the chapter's end.
   */
  pin?: boolean;
  /**
   * A stepped chapter's length in screens (screensOf in story/scripts.ts):
   * long enough for the scene to play every step before moving on.
   */
  screens?: number;
  children: React.ReactNode;
}) {
  const height = screens ? { height: `${screens * 100}svh` } : undefined;
  if (pin) {
    return (
      <section id={id} data-stage className="relative h-[150svh]" style={height}>
        <div className="sticky top-[16svh] mx-auto w-full max-w-[1280px] px-6 md:px-10">
          <div className={stageColumn(side, narrow)}>{children}</div>
        </div>
      </section>
    );
  }
  return (
    <section id={id} data-stage className={`relative flex h-[150svh] ${STAGE_ALIGN[side]}`} style={height}>
      <div className="mx-auto w-full max-w-[1280px] px-6 md:px-10">
        <div className={stageColumn(side, narrow)}>{children}</div>
      </div>
    </section>
  );
}

// Scroll margins decide where a #link to the section lands: centred copy
// lands mid-screen, the footer lands with the page's end.
export const STAGE_ALIGN = {
  hero: "items-start pt-[46svh] md:pt-[18svh]",
  left: "items-center -scroll-mt-[25svh]",
  right: "items-center -scroll-mt-[25svh]",
  middle: "items-center -scroll-mt-[25svh]",
  // clear of the booking dock (and its tabs) fixed at the bottom of the screen
  end: "items-end pb-44 md:pb-56 -scroll-mt-[50svh]",
} as const;

export function stageColumn(side: keyof typeof STAGE_ALIGN, narrow = false) {
  if (side === "right") return narrow ? "lg:ml-auto lg:w-[42%] lg:pl-8" : "lg:ml-auto lg:w-1/2 lg:pl-12";
  if (side === "left" || side === "hero") return narrow ? "lg:w-[42%] lg:pr-8" : "lg:w-1/2 lg:pr-8";
  if (side === "end") return "";
  return "mx-auto max-w-[820px] text-center";
}
