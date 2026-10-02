import type { StoryPageId } from "@/lib/pages";

/**
 * Each story page is a script for the particle scene: one frame per chapter
 * (stage), in order, the last always the company logo. The scene morphs from
 * one frame to the next as the chapters scroll by, and from a page's logo
 * into the next page's first frame at the hand-off.
 */

/** How a frame arrives from the one before. */
export type Style =
  | "sweep" // side by side, the leading edge first (the home page's map → globe)
  | "rise" // gathers up from below
  | "regather" // spreads out, then regathers into the new shape
  | "drift"; // a slow glide, keeping its shape

/** Where a model stands: beside the copy, centred, or the logo's place over the footer. */
export type Place = {
  side: "left" | "right" | "center" | "logo";
  rx?: number;
  ry?: number;
  rz?: number;
  /** Size, as a share of the room it's given. */
  fill?: number;
  /** Nudge up (+) or down, in visible half-heights. */
  dy?: number;
  /** As dy, on phones and tablets only (where the model is centred behind the copy). */
  compactDy?: number;
};

export type ModelKey =
  | "history-2013"
  | "history-2016"
  | "history-2019"
  | "history-2022"
  | "vision"
  | "mission"
  | "values"
  | "pie"
  | "org"
  | "logo";

export type Frame = {
  model: ModelKey;
  place: Place;
  enter?: Style;
  /** The group lit (1-based), or "scroll" to light each group in turn as the chapter scrolls by. */
  lit?: number | "scroll";
  /** Groups pulse gently (0..1). */
  pulse?: number;
  /** Slow turn back and forth about the vertical axis, radians. */
  spin?: number;
  /** Groups can be hovered (see Target in models.ts); their names show beside them. */
  hover?: boolean;
  /**
   * A stepped chapter: it holds for this many steps — its copy pinned, the
   * page going no further — and plays one step per stretch of scroll (lighting
   * the next group, or revealing the next level). Only once the last step has
   * played does the next chapter's morph begin.
   */
  steps?: number;
  /**
   * With `steps`: the scroll each step takes, in screens (default
   * STEP_SCREENS each) — longer for a step that has more to show.
   */
  stepScreens?: readonly number[];
  /**
   * With `steps`: groups gather in, step by step, up to each of these
   * (1-based, inclusive; one more entry than steps, from where it starts);
   * until then they wait in the sky.
   */
  reveal?: readonly number[];
};

/** Scroll per step of a stepped chapter, in screens. */
export const STEP_SCREENS = 0.6;

/** The scroll each of a frame's steps takes, in screens. */
export const stepLengths = (f: Frame) =>
  Array.from({ length: f.steps ?? 0 }, (_, i) => f.stepScreens?.[i] ?? STEP_SCREENS);

/** A chapter's length in screens: 1.5, plus room for each of its steps. */
export const stageScreens = (f: Frame | undefined) => 1.5 + (f ? stepLengths(f).reduce((a, b) => a + b, 0) : 0);


const LOGO: Frame = { model: "logo", place: { side: "logo" }, enter: "sweep" };

export const SCRIPTS: Record<StoryPageId, Frame[]> = {
  about: [
    // the opening: the company's own logo, beside "Đồng hành từng chuyến đi"
    { model: "logo", place: { side: "right", ry: -0.22, fill: 0.95 } },
    // the history: one map and flight path, held still; only the year and its
    // pointer glide on from milestone to milestone
    { model: "history-2013", place: { side: "right", rx: -0.1, ry: -0.12 }, enter: "regather", lit: 1 },
    { model: "history-2016", place: { side: "right", rx: -0.1, ry: -0.12 }, enter: "drift", lit: 2 },
    { model: "history-2019", place: { side: "right", rx: -0.1, ry: -0.12 }, enter: "drift", lit: 3 },
    { model: "history-2022", place: { side: "right", rx: -0.1, ry: -0.12 }, enter: "drift", lit: 4 },
    { model: "vision", place: { side: "left", rx: 0.12, ry: 0.22 }, enter: "rise" },
    { model: "mission", place: { side: "left", rx: 0.1, ry: 0.3 }, enter: "sweep" },
    // a ring of five fists, seen a little from above
    { model: "values", place: { side: "right", rx: -0.55, ry: 0, rz: 0, fill: 1.0 }, enter: "regather", lit: "scroll", steps: 5 },
    LOGO,
  ],
  organization: [
    // the opening: the company's own logo, beside "Cơ cấu tổ chức"
    { model: "logo", place: { side: "right", ry: -0.22, fill: 0.95 } },
    // the staff as a pie, seen from above at an angle; each share lights in turn
    { model: "pie", place: { side: "left", rx: -0.8, ry: 0.12, fill: 1.05 }, enter: "regather", lit: "scroll", steps: 3 },
    // the chart, level by level: the board, then the heads, then their teams
    // (on phones in the lower half of the screen, under the pinned copy)
    {
      model: "org",
      place: { side: "right", rx: -0.06, fill: 1.24, compactDy: -0.42 },
      enter: "rise",
      spin: 0.12,
      hover: true,
      steps: 3,
      // slowly, position by position: each level's scroll in proportion to
      // how many it brings in (2, 5, 10)
      stepScreens: [1.1, 1.8, 3.0],
      reveal: [0, 2, 7, 17],
    },
    LOGO,
  ],
  // not yet published: each will open on its first chapter's model
  services: [LOGO],
  achievements: [LOGO],
};

/** Stage ids per page, top to bottom — the rail and the copy use the same ids. */
export const STAGES: Record<StoryPageId, readonly string[]> = {
  about: ["intro", "y2013", "y2016", "y2019", "y2022", "vision", "mission", "values", "end"],
  organization: ["structure", "people", "chart", "end"],
  services: ["end"],
  achievements: ["end"],
};

/** A stepped stage's length in screens (see Frame.steps), for its page's markup; 0 for any other. */
export const screensOf = (page: StoryPageId, stage: string) => {
  const f = SCRIPTS[page][STAGES[page].indexOf(stage)];
  return f?.steps ? stageScreens(f) : 0;
};
