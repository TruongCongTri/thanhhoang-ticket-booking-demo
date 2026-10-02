import type { Rand } from "../scene/shapes";
import { TONE, along, circle, finish, textDots, type Model, type Pt, type V3 } from "./models";
import { roundRect } from "./services-models";

/** Thành tựu & Đối tác's particle models: the trophy, and the partner airlines. */

const TAU = Math.PI * 2;

/** A five-pointed star's outline, facing the viewer. */
function star(cx: number, cy: number, z: number, r: number): V3[] {
  return Array.from({ length: 11 }, (_, i): V3 => {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.42 : r;
    return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, z];
  });
}

/** The trophy's profile: radius at each height, foot to rim. */
const PROFILE: [number, number][] = [
  [-1.75, 0.95],
  [-1.35, 0.95],
  [-1.3, 0.6],
  [-1.05, 0.2],
  [-0.4, 0.16],
  [-0.15, 0.3],
  [0.25, 0.75],
  [0.9, 1.15],
  [1.6, 1.35],
  [1.75, 1.4],
];

/** Number of award stars: one per period of the timeline (2018–2021, 2022, 2023, 2024, 2025). */
export const TROPHY_STARS = 5;

/**
 * Thành tựu đạt được: a trophy cup — rings and meridians, handles, a stepped
 * base — under an arc of five stars (groups 1–5), one per period of awards,
 * lit in turn as the timeline scrolls by.
 */
export function trophy(budget: number, rand: Rand): Model {
  const keep: Pt[] = [];
  const rest: Pt[] = [];
  const dy = -0.55; // the whole cup sits low, the stars above it
  // rings up the profile
  for (let i = 0; i < PROFILE.length; i++) {
    const [y, r] = PROFILE[i];
    const ring = circle(0, 0, 0, 1, 0, TAU, 48).map(([x, z]): V3 => [x * r, y + dy, z * r]);
    along(ring, 0.05, rand, (p) => keep.push({ p, s: i === PROFILE.length - 1 ? 1.0 : 0.75, t: TONE.accent }));
  }
  // the bowl, ring by ring in between (lighter), and meridians
  for (let y = 0.35; y < 1.6; y += 0.18) {
    const k = PROFILE.findIndex(([py]) => py >= y);
    const [y0, r0] = PROFILE[k - 1];
    const [y1, r1] = PROFILE[k];
    const r = r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
    const ring = circle(0, 0, 0, 1, 0, TAU, 48).map(([x, z]): V3 => [x * r, y + dy, z * r]);
    along(ring, 0.08, rand, (p) => rest.push({ p, s: 0.5, t: TONE.accent }));
  }
  for (let m = 0; m < 14; m++) {
    const a = (m / 14) * TAU;
    const line = PROFILE.map(([y, r]): V3 => [Math.cos(a) * r, y + dy, Math.sin(a) * r]);
    along(line, 0.07, rand, (p) => rest.push({ p, s: 0.55, t: TONE.accent }));
  }
  // handles
  for (const s of [-1, 1]) {
    const handle = Array.from({ length: 24 }, (_, i): V3 => {
      const a = -Math.PI / 2 + (i / 23) * Math.PI;
      return [s * (1.15 + Math.cos(a) * 0.55), 1.0 + dy + Math.sin(a) * 0.5, 0];
    });
    along(handle, 0.045, rand, (p) => keep.push({ p, s: 0.85, t: TONE.accent }));
  }
  // a plaque on the base
  along(roundRect(0, -1.55 + dy, 1.3, 0.3, 0.06, 0.98), 0.045, rand, (p) => keep.push({ p, s: 0.6, t: TONE.ink }));
  // the stars, in an arc above
  for (let i = 0; i < TROPHY_STARS; i++) {
    const a = Math.PI * (0.92 - (i / (TROPHY_STARS - 1)) * 0.84);
    const [x, y] = [Math.cos(a) * 2.75, 1.25 + Math.sin(a) * 1.3];
    along(star(x, y, 0.4, 0.42), 0.04, rand, (p) => keep.push({ p, s: 0.95, t: TONE.azure, g: i + 1 }));
    keep.push({ p: [x, y, 0.42], s: 1.6, t: TONE.azure, g: i + 1 });
  }
  return finish(keep, rest, budget, rand, { size: 0.82, depth: 0.5 });
}

/** Partner airlines, as in the brochure: home carriers, then those from abroad; each with its logo (public/partners). */
export const PARTNERS = {
  domestic: [
    { name: "Vietnam Airlines", logo: "/partners/vietnam-airlines.png" },
    { name: "Bamboo Airways", logo: "/partners/bamboo-airways.png" },
    { name: "Vietjet Air", logo: "/partners/vietjet-air.png" },
    { name: "Vietravel Airlines", logo: "/partners/vietravel-airlines.png" },
  ],
  international: [
    { name: "China Airlines", logo: "/partners/china-airlines.png" },
    { name: "EVA Air", logo: "/partners/eva-air.png" },
    { name: "Sichuan Airlines", logo: "/partners/sichuan-airlines.png" },
    { name: "Qatar Airways", logo: "/partners/qatar-airways.png" },
    { name: "Air India", logo: "/partners/air-india.png" },
    { name: "Japan Airlines", logo: "/partners/japan-airlines.png" },
  ],
} as const;

/** Pixels of a logo image (see loadPixels in StoryScene.tsx). */
export type Pixels = { w: number; h: number; data: Uint8ClampedArray };

/**
 * Đối tác tiêu biểu: each partner's own logo, printed in particles from its
 * image the way the company logo is, large, inside one shared frame; each logo
 * is its own group and they all stand in the same spot — the frame shows one
 * at a time (Frame.solo). The logos keep their colours, except the darkest
 * parts (black, navy or maroon type), which would vanish on a dark page:
 * those turn pale there, and keep their own colour on a light page. A logo whose image failed to
 * load falls back to its name.
 */
export function partners(budget: number, rand: Rand, which: keyof typeof PARTNERS, images: readonly (Pixels | null)[]): Model {
  const keep: Pt[] = [];
  const list = PARTNERS[which];
  const [cw, ch] = [7.6, 3.0];
  // the frame they share, always there
  along(roundRect(0, 0, cw, ch, 0.3), 0.05, rand, (p) => keep.push({ p, s: 0.8, t: TONE.muted }));
  // each logo gets an even share of the particles; its dot pitch is set to fit it
  const share = Math.floor((budget - keep.length) / list.length);
  list.forEach(({ name }, i) => {
    const g = i + 1;
    const img = images[i];
    if (!img) {
      for (const [dx, dy] of textDots(name, 0.9, 0.07)) keep.push({ p: [dx, dy, 0.08], s: 0.6, t: TONE.ink, g });
      return;
    }
    const [bw, bh] = [cw - 0.7, ch - 0.7];
    const k = Math.min(bw / img.w, bh / img.h); // model units per px
    const inked = (px: number, py: number) => img.data[(Math.floor(py) * img.w + Math.floor(px)) * 4 + 3] >= 140;
    // the finest pitch (in px) whose dots fit the share
    let step = 2;
    const count = (st: number) => {
      let n = 0;
      for (let py = st / 2; py < img.h; py += st) for (let px = st / 2; px < img.w; px += st) if (inked(px, py)) n++;
      return n;
    };
    while (count(step) > share && step < 40) step += 0.5;
    for (let py = step / 2; py < img.h; py += step) {
      for (let px = step / 2; px < img.w; px += step) {
        if (!inked(px, py)) continue;
        const at = (Math.floor(py) * img.w + Math.floor(px)) * 4;
        const [r, gr, b] = [img.data[at] / 255, img.data[at + 1] / 255, img.data[at + 2] / 255];
        const dark = 0.2126 * r + 0.7152 * gr + 0.0722 * b < 0.28;
        keep.push({ p: [(px - img.w / 2) * k, (img.h / 2 - py) * k, 0.08], s: 0.5, t: dark ? TONE.logoDark : TONE.logo, g, c: [r, gr, b] });
      }
    }
  });
  return finish(keep, [], budget, rand, { size: 0.82, depth: 0.4 });
}
