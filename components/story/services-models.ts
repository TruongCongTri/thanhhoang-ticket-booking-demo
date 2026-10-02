import type { Rand } from "../scene/shapes";
import { TONE, along, circle, dashed, finish, plane, textDots, type Model, type Pt, type V3 } from "./models";

/**
 * Dịch vụ & Vận hành's particle models: one per featured service, then the
 * share chart, the principles, the process and the strengths. Model units as
 * the other pages' (about 8 across, 4.5 high, centred on the origin).
 */

const TAU = Math.PI * 2;

/** A rectangle with rounded corners, as a closed outline. */
export function roundRect(cx: number, cy: number, w: number, h: number, r: number, z = 0): V3[] {
  const [x0, x1, y0, y1] = [cx - w / 2, cx + w / 2, cy - h / 2, cy + h / 2];
  return [
    ...circle(x1 - r, y1 - r, z, r, 0, Math.PI / 2, 8),
    ...circle(x0 + r, y1 - r, z, r, Math.PI / 2, Math.PI, 8),
    ...circle(x0 + r, y0 + r, z, r, Math.PI, 1.5 * Math.PI, 8),
    ...circle(x1 - r, y0 + r, z, r, 1.5 * Math.PI, TAU, 8),
    [x1, y1 - r, z],
  ];
}

/** A light grid inside a test, at z. */
function fill(out: Pt[], x0: number, x1: number, y0: number, y1: number, step: number, inside: (x: number, y: number) => boolean, z: number, rand: Rand, pt: Omit<Pt, "p">) {
  for (let y = y0 + step / 2; y < y1; y += step) {
    for (let x = x0 + step / 2; x < x1; x += step) {
      const jx = x + (rand() - 0.5) * step * 0.3;
      const jy = y + (rand() - 0.5) * step * 0.3;
      if (inside(jx, jy)) out.push({ p: [jx, jy, z], ...pt });
    }
  }
}

/** Text in dots, centred on (cx, cy). */
function text(out: Pt[], s: string, cx: number, cy: number, z: number, height: number, pitch: number, pt: Omit<Pt, "p">) {
  for (const [x, y] of textDots(s, height, pitch)) out.push({ p: [cx + x, cy + y, z], ...pt });
}

/** A box's twelve edges (wireframe), from its centre and half sizes. */
function boxEdges(c: V3, h: V3): V3[][] {
  const P = (sx: number, sy: number, sz: number): V3 => [c[0] + sx * h[0], c[1] + sy * h[1], c[2] + sz * h[2]];
  const e: V3[][] = [];
  for (const s of [-1, 1]) {
    for (const t of [-1, 1]) {
      e.push([P(-1, s, t), P(1, s, t)]); // along x
      e.push([P(s, -1, t), P(s, 1, t)]); // along y
      e.push([P(s, t, -1), P(s, t, 1)]); // along z
    }
  }
  return e;
}

/* ---------------------------------------------------------------- */
/* Dịch vụ tiêu biểu: one model per service                          */
/* ---------------------------------------------------------------- */

/** 01 · Vé máy bay: a boarding pass, an airliner climbing away over it. */
export function svcTicket(budget: number, rand: Rand): Model {
  const keep: Pt[] = [];
  const rest: Pt[] = [];
  const [W, H, R] = [7, 3, 0.3];
  const stubX = 1.6; // the perforation, between the pass and its stub
  along(roundRect(0, -0.6, W, H, R), 0.045, rand, (p) => keep.push({ p, s: 0.95, t: TONE.azure }));
  dashed(
    [
      [stubX, -0.6 - H / 2 + 0.2, 0],
      [stubX, -0.6 + H / 2 - 0.2, 0],
    ],
    0.05,
    0.12,
    0.1,
    rand,
    (p) => keep.push({ p, s: 0.7, t: TONE.azure }),
  );
  // printed on it: the route, large; the flight and seat, small; a barcode on the stub
  text(keep, "HAN", -2.3, -0.2, 0.04, 0.8, 0.075, { s: 0.95, t: TONE.ink });
  text(keep, "SGN", 0.4, -0.2, 0.04, 0.8, 0.075, { s: 0.95, t: TONE.ink });
  text(keep, "→", -0.95, -0.22, 0.04, 0.45, 0.07, { s: 0.9, t: TONE.accent });
  text(keep, "VN 213 · 14A", -1.45, -1.45, 0.04, 0.3, 0.06, { s: 0.7, t: TONE.ink });
  for (let x = stubX + 0.35; x < W / 2 - 0.3; x += 0.13) {
    if (rand() < 0.3) continue;
    along(
      [
        [x, -1.7, 0.04],
        [x, 0.2, 0.04],
      ],
      0.06,
      rand,
      (p) => keep.push({ p, s: 0.55, t: TONE.ink }),
    );
  }
  // the airliner, climbing away above the pass
  keep.push(...plane(Math.round(budget * 0.32), rand, 0.36, 0.22, 0.45, [0.6, 1.95, 0.5], 1.0));
  return finish(keep, rest, budget, rand, { size: 0.8, depth: 0.45 });
}

/** One traveller: a head and shoulders. */
function person(out: Pt[], x: number, y: number, z: number, s: number, tone: number, rand: Rand) {
  along(circle(x, y + 0.62 * s, z, 0.22 * s), 0.045, rand, (p) => out.push({ p, s: 0.85, t: tone }));
  along(circle(x, y - 0.05 * s, z, 0.42 * s, 0.1, Math.PI - 0.1, 24), 0.045, rand, (p) => out.push({ p, s: 0.85, t: tone }));
  along(
    [
      [x - 0.41 * s, y - 0.02 * s, z],
      [x + 0.41 * s, y - 0.02 * s, z],
    ],
    0.06,
    rand,
    (p) => out.push({ p, s: 0.6, t: tone }),
  );
}

/** 02 · Đặt vé đoàn: a group of travellers, two rows deep, under their group discount. */
export function svcGroup(budget: number, rand: Rand): Model {
  const keep: Pt[] = [];
  for (let i = 0; i < 5; i++) person(keep, -2.6 + i * 1.3 + 0.65, -0.35, -0.7, 1.0, TONE.ink, rand); // back row
  for (let i = 0; i < 5; i++) person(keep, -2.6 + i * 1.3, -1.45, 0.3, 1.15, TONE.azure, rand); // front row
  text(keep, "−20%", 0, 1.55, 0.2, 1.1, 0.065, { s: 0.95, t: TONE.accent });
  return finish(keep, [], budget, rand, { size: 0.85, depth: 0.5 });
}

/** A shield's half width, from its shoulders (t = 0) down to its point (t = 1). */
const shieldHalf = (t: number) => 1.15 * Math.cos((Math.PI / 2) * t ** 1.6);

/** 03 · Visa & bảo hiểm: a passport, and a shield for the insurance beside it. */
export function svcVisa(budget: number, rand: Rand): Model {
  const keep: Pt[] = [];
  const rest: Pt[] = [];
  // the passport, its cover's globe and title
  const [px, py] = [-1.35, 0];
  along(roundRect(px, py, 2.9, 3.9, 0.2, -0.2), 0.045, rand, (p) => keep.push({ p, s: 0.95, t: TONE.azure }));
  fill(rest, px - 1.4, px + 1.4, py - 1.9, py + 1.9, 0.2, (_, y) => y < py - 1.3 || y > py - 0.7, -0.25, rand, { s: 0.42, t: TONE.azure });
  along(circle(px, py + 0.45, -0.15, 0.72), 0.04, rand, (p) => keep.push({ p, s: 0.8, t: TONE.accent }));
  for (const k of [0.35, 0.7]) {
    const ell = circle(0, 0, 0, 1, 0, TAU, 48).map(([x, y]): V3 => [px + x * 0.72 * k, py + 0.45 + y * 0.72, -0.15]);
    along(ell, 0.05, rand, (p) => keep.push({ p, s: 0.6, t: TONE.accent }));
  }
  for (const yy of [-0.36, 0, 0.36]) {
    const half = Math.sqrt(Math.max(0, 0.72 ** 2 - yy ** 2));
    along(
      [
        [px - half, py + 0.45 + yy, -0.15],
        [px + half, py + 0.45 + yy, -0.15],
      ],
      0.05,
      rand,
      (p) => keep.push({ p, s: 0.6, t: TONE.accent }),
    );
  }
  text(keep, "PASSPORT", px, py - 1.0, -0.15, 0.34, 0.055, { s: 0.75, t: TONE.ink });
  // the shield, with a tick: insured
  const sx = 1.75;
  const shield: V3[] = [
    [sx - 1.15, 1.35, 0.4],
    [sx, 1.7, 0.4],
    [sx + 1.15, 1.35, 0.4],
    ...Array.from({ length: 20 }, (_, i): V3 => {
      const t = (i + 1) / 20;
      return [sx + shieldHalf(t), 1.35 - t * 3.0, 0.4];
    }),
    ...Array.from({ length: 20 }, (_, i): V3 => {
      const t = 1 - (i + 1) / 20;
      return [sx - shieldHalf(t), 1.35 - t * 3.0, 0.4];
    }),
  ];
  along(shield, 0.045, rand, (p) => keep.push({ p, s: 1.0, t: TONE.accent }));
  along(
    [
      [sx - 0.55, 0.0, 0.42],
      [sx - 0.12, -0.45, 0.42],
      [sx + 0.62, 0.55, 0.42],
    ],
    0.045,
    rand,
    (p) => keep.push({ p, s: 1.05, t: TONE.ink }),
  );
  const inShield = (x: number, y: number) => {
    if (y > 1.35 || y < -1.65) return false;
    return Math.abs(x - sx) < shieldHalf((1.35 - y) / 3.0);
  };
  fill(rest, sx - 1.2, sx + 1.2, -1.7, 1.7, 0.15, inShield, 0.35, rand, { s: 0.42, t: TONE.accent });
  return finish(keep, rest, budget, rand, { size: 0.82, depth: 0.45 });
}

/** 04 · Khách sạn, thuê xe: a rolling suitcase, and a car beside it. */
export function svcTour(budget: number, rand: Rand): Model {
  const keep: Pt[] = [];
  const rest: Pt[] = [];
  // the suitcase: its shell, ribs, the telescoping handle and wheels
  const [cx, cy] = [-1.7, -0.5];
  along(roundRect(cx, cy, 2.4, 3.1, 0.35, 0), 0.045, rand, (p) => keep.push({ p, s: 0.95, t: TONE.accent }));
  for (const dx of [-0.5, 0.5]) {
    along(
      [
        [cx + dx, cy - 1.35, 0.02],
        [cx + dx, cy + 1.35, 0.02],
      ],
      0.06,
      rand,
      (p) => keep.push({ p, s: 0.65, t: TONE.accent }),
    );
  }
  along(
    [
      [cx - 0.45, cy + 1.55, 0],
      [cx - 0.45, cy + 2.45, 0],
      [cx + 0.45, cy + 2.45, 0],
      [cx + 0.45, cy + 1.55, 0],
    ],
    0.05,
    rand,
    (p) => keep.push({ p, s: 0.85, t: TONE.ink }),
  );
  for (const dx of [-0.8, 0.8]) along(circle(cx + dx, cy - 1.75, 0, 0.17), 0.04, rand, (p) => keep.push({ p, s: 0.8, t: TONE.ink }));
  fill(rest, cx - 1.2, cx + 1.2, cy - 1.55, cy + 1.55, 0.15, () => true, -0.08, rand, { s: 0.42, t: TONE.warm });
  // the car, side on: body, cabin, windows, wheels
  const [bx, by] = [1.85, -1.2];
  const body: V3[] = [
    [bx - 1.9, by - 0.25, 0.3],
    [bx - 1.9, by + 0.35, 0.3],
    [bx - 1.15, by + 0.5, 0.3],
    [bx - 0.75, by + 1.15, 0.3],
    [bx + 0.75, by + 1.15, 0.3],
    [bx + 1.25, by + 0.55, 0.3],
    [bx + 1.9, by + 0.42, 0.3],
    [bx + 1.95, by - 0.25, 0.3],
    [bx - 1.9, by - 0.25, 0.3],
  ];
  along(body, 0.045, rand, (p) => keep.push({ p, s: 0.95, t: TONE.azure }));
  along(
    [
      [bx - 0.62, by + 0.55, 0.3],
      [bx - 0.6, by + 1.0, 0.3],
      [bx + 0.68, by + 1.0, 0.3],
      [bx + 1.0, by + 0.55, 0.3],
      [bx - 0.62, by + 0.55, 0.3],
    ],
    0.05,
    rand,
    (p) => keep.push({ p, s: 0.7, t: TONE.ink }),
  );
  for (const dx of [-1.15, 1.2]) {
    along(circle(bx + dx, by - 0.3, 0.3, 0.38), 0.04, rand, (p) => keep.push({ p, s: 0.9, t: TONE.ink }));
    along(circle(bx + dx, by - 0.3, 0.3, 0.14), 0.04, rand, (p) => keep.push({ p, s: 0.6, t: TONE.ink }));
  }
  // the road under them
  dashed(
    [
      [-3.6, -2.35, 0.1],
      [4.0, -2.35, 0.1],
    ],
    0.06,
    0.3,
    0.2,
    rand,
    (p) => rest.push({ p, s: 0.5, t: TONE.muted }),
  );
  return finish(keep, rest, budget, rand, { size: 0.82, depth: 0.45 });
}

/** 05 · Gói vé doanh nghiệp: office towers, each a lit 3D box of windows. */
export function svcCorp(budget: number, rand: Rand): Model {
  const keep: Pt[] = [];
  const rest: Pt[] = [];
  const towers = [
    { x: -2.3, w: 1.5, h: 3.3, t: TONE.azure },
    { x: 0, w: 1.9, h: 4.6, t: TONE.accent },
    { x: 2.25, w: 1.5, h: 2.7, t: TONE.azure },
  ];
  const ground = -2.3;
  for (const tw of towers) {
    const c: V3 = [tw.x, ground + tw.h / 2, 0];
    for (const e of boxEdges(c, [tw.w / 2, tw.h / 2, 0.55])) along(e, 0.05, rand, (p) => keep.push({ p, s: 0.85, t: tw.t }));
    // windows on the front face
    for (let y = ground + 0.3; y < ground + tw.h - 0.2; y += 0.28) {
      for (let x = tw.x - tw.w / 2 + 0.22; x < tw.x + tw.w / 2 - 0.1; x += 0.26) {
        (rand() < 0.75 ? rest : []).push({ p: [x, y, 0.56], s: 0.55, t: rand() < 0.25 ? TONE.accent : TONE.ink });
      }
    }
  }
  along(
    [
      [-3.8, ground, 0.6],
      [3.8, ground, 0.6],
    ],
    0.045,
    rand,
    (p) => keep.push({ p, s: 0.7, t: TONE.muted }),
  );
  return finish(keep, rest, budget, rand, { size: 0.82, depth: 0.5 });
}

/* ---------------------------------------------------------------- */
/* Tỷ lệ lựa chọn: the shares as 3D bars                             */
/* ---------------------------------------------------------------- */

/** The shares, in the brochure's order (groups 1–5). */
export const SHARES = [45, 30, 10, 10, 5] as const;

/** Five bars (groups 1–5), each with its percentage drawn above it. */
export function shareBars(budget: number, rand: Rand): Model {
  const keep: Pt[] = [];
  const rest: Pt[] = [];
  const base = -2.0;
  const maxH = 3.6;
  SHARES.forEach((share, i) => {
    const g = i + 1;
    const x = -3.2 + i * 1.6;
    const h = Math.max(0.25, (share / SHARES[0]) * maxH);
    const c: V3 = [x, base + h / 2, 0];
    const half: V3 = [0.45, h / 2, 0.45];
    const tone = i === 0 ? TONE.accent : TONE.azure;
    for (const e of boxEdges(c, half)) along(e, 0.045, rand, (p) => keep.push({ p, s: 0.85, t: tone, g }));
    // the front face and the top, lightly filled
    fill(rest, x - 0.45, x + 0.45, base, base + h, 0.12, () => true, 0.45, rand, { s: 0.45, t: tone, g });
    for (let zz = -0.4; zz <= 0.4; zz += 0.12) {
      for (let xx = x - 0.4; xx <= x + 0.4; xx += 0.12) rest.push({ p: [xx, base + h, zz], s: 0.45, t: tone, g });
    }
    text(keep, `${share}%`, x, base + h + 0.55, 0.3, 0.5, 0.06, { s: 0.95, t: TONE.ink, g });
  });
  along(
    [
      [-4.0, base, 0.6],
      [4.0, base, 0.6],
    ],
    0.045,
    rand,
    (p) => keep.push({ p, s: 0.6, t: TONE.muted }),
  );
  return finish(keep, rest, budget, rand, { size: 0.8, depth: 0.45 });
}

/* ---------------------------------------------------------------- */
/* Nguyên tắc hoạt động: six pillars                                 */
/* ---------------------------------------------------------------- */

/** Six pillars (groups 1–6) on one stepped base, in a gentle arc. */
export function pillars(budget: number, rand: Rand): Model {
  const keep: Pt[] = [];
  const rest: Pt[] = [];
  const [y0, y1] = [-1.75, 1.15];
  for (let i = 0; i < 6; i++) {
    const g = i + 1;
    const x = -3.4 + i * 1.36;
    const z = -0.7 * (1 - (x / 3.4) ** 2); // the middle ones a step back
    const tone = i % 2 ? TONE.azure : TONE.ink;
    // the shaft: rings at its foot and head, flutes between
    for (const y of [y0 + 0.2, y1 - 0.2]) {
      const ring = circle(0, 0, 0, 1, 0, TAU, 32).map(([cx, cy]): V3 => [x + cx * 0.38, y, z + cy * 0.38]);
      along(ring, 0.05, rand, (p) => keep.push({ p, s: 0.8, t: tone, g }));
    }
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU;
      const [fx, fz] = [x + Math.cos(a) * 0.36, z + Math.sin(a) * 0.36];
      along(
        [
          [fx, y0 + 0.2, fz],
          [fx, y1 - 0.2, fz],
        ],
        0.07,
        rand,
        (p) => (Math.sin(a) > -0.2 ? keep : rest).push({ p, s: Math.sin(a) > -0.2 ? 0.85 : 0.5, t: tone, g }),
      );
    }
    // the plinth and the capital: flat slabs
    for (const [y, w] of [
      [y0 + 0.1, 0.5],
      [y1 - 0.1, 0.55],
    ] as const) {
      for (const e of boxEdges([x, y, z], [w, 0.1, w])) along(e, 0.05, rand, (p) => keep.push({ p, s: 0.8, t: TONE.accent, g }));
    }
  }
  // the steps they all stand on (always there)
  for (const [y, w] of [
    [y0 - 0.05, 4.2],
    [y0 - 0.3, 4.45],
  ] as const) {
    along(
      [
        [-w, y, 0.4],
        [w, y, 0.4],
      ],
      0.05,
      rand,
      (p) => keep.push({ p, s: 0.6, t: TONE.muted }),
    );
  }
  return finish(keep, rest, budget, rand, { size: 0.82, depth: 0.45 });
}

/* ---------------------------------------------------------------- */
/* Quy trình hoạt động: a path through numbered steps                */
/* ---------------------------------------------------------------- */

const STEP_AT: [number, number][] = [
  [-3.2, -1.3],
  [-1.05, 0.95],
  [1.15, -0.95],
  [3.25, 1.25],
];

/** Catmull–Rom through points, sampled. */
function spline(pts: [number, number][], per = 24): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const [p1, p2] = [pts[i], pts[i + 1]];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < per; k++) {
      const t = k / per;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push(
        [0, 1].map(
          (c) =>
            0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3),
        ) as [number, number],
      );
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/**
 * Four numbered steps (groups 1–4) along a winding path; each stretch of
 * path belongs to the step it leads to, so lighting the steps in turn sends
 * the light along the path.
 */
export function processPath(budget: number, rand: Rand): Model {
  const keep: Pt[] = [];
  const rest: Pt[] = [];
  const pts: [number, number][] = [[-4.2, -2.0], ...STEP_AT];
  for (let i = 0; i < pts.length - 1; i++) {
    const g = i + 1;
    const seg = spline(pts, 24).slice(i * 24, (i + 1) * 24 + 1);
    const line = seg.map(([x, y]): V3 => [x, y, 0.1 * Math.sin(x)]);
    along(line, 0.05, rand, (p) => keep.push({ p, s: 0.75, t: TONE.azure, g }));
    // a soft stream around it
    along(line, 0.015, rand, (p) => {
      const r = Math.abs(rand() - 0.5) * 0.22;
      const a = rand() * TAU;
      rest.push({ p: [p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r, p[2] + (rand() - 0.5) * 0.1], s: 0.42, t: TONE.azure, g });
    });
  }
  STEP_AT.forEach(([x, y], i) => {
    const g = i + 1;
    along(circle(x, y, 0.2, 0.58), 0.04, rand, (p) => keep.push({ p, s: 1.0, t: TONE.accent, g }));
    along(circle(x, y, 0.2, 0.72), 0.07, rand, (p) => rest.push({ p, s: 0.5, t: TONE.accent, g }));
    text(keep, String(i + 1), x, y, 0.25, 0.58, 0.07, { s: 1.0, t: TONE.ink, g });
  });
  return finish(keep, rest, budget, rand, { size: 0.82, depth: 0.4 });
}

/* ---------------------------------------------------------------- */
/* Thế mạnh cạnh tranh: a radar                                      */
/* ---------------------------------------------------------------- */

/**
 * A five-axis radar (groups 1–5): the rings and the axes' ends always
 * there; each strength a spoke reaching the rim, with its slice of the
 * filled shape. Every strength reaches the rim — the brochure scores none
 * of them.
 */
export function radar(budget: number, rand: Rand): Model {
  const keep: Pt[] = [];
  const rest: Pt[] = [];
  const R = 2.5;
  const at = (i: number, r: number): V3 => {
    const a = Math.PI / 2 - (i * TAU) / 5;
    return [Math.cos(a) * r, Math.sin(a) * r, 0];
  };
  // the rings
  for (const k of [0.33, 0.66, 1]) {
    const ring = Array.from({ length: 6 }, (_, i) => at(i % 5, R * k));
    dashed(ring, 0.05, 0.14, 0.08, rand, (p) => rest.push({ p, s: 0.5, t: TONE.muted }));
  }
  for (let i = 0; i < 5; i++) {
    const g = i + 1;
    // the spoke, and its edge of the shape (to the next axis)
    along([at(i, 0), at(i, R)], 0.04, rand, (p) => keep.push({ p, s: 1.1, t: TONE.accent, g }));
    along([at(i, R), at(i + 1, R)], 0.042, rand, (p) => keep.push({ p, s: 1.0, t: TONE.azure, g }));
    // the slice of the shape between this axis and the next, filled lightly, lifted a little
    const [a, b] = [at(i, R), at(i + 1, R)];
    for (let k = 0; k < 320; k++) {
      let u = rand();
      let v = rand();
      if (u + v > 1) [u, v] = [1 - u, 1 - v];
      rest.push({ p: [a[0] * u + b[0] * v, a[1] * u + b[1] * v, 0.08 + rand() * 0.12], s: 0.55, t: TONE.azure, g });
    }
    // its number, just outside the rim
    const [nx, ny] = at(i, R + 0.55);
    text(keep, String(i + 1).padStart(2, "0"), nx, ny, 0.1, 0.48, 0.06, { s: 0.95, t: TONE.ink, g });
    along(circle(at(i, R)[0], at(i, R)[1], 0.05, 0.12), 0.04, rand, (p) => keep.push({ p, s: 0.9, t: TONE.accent, g }));
  }
  return finish(keep, rest, budget, rand, { size: 0.82, depth: 0.4 });
}
