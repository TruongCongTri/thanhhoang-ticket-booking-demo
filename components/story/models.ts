import * as THREE from "three";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { airplane, evenly, landMask, mulberry32, type GeoData, type Rand } from "../scene/shapes";
import { ORG } from "./org";

export { ORG, type OrgId } from "./org";

/**
 * The story pages' particle models. Each is a list of points in model space
 * (units like the home page's: about 8 across), with a size factor, a colour
 * tone and a group — the pieces that light up in turn or on hover (a
 * milestone, a value's facet, a box of the org chart).
 */

/** Colour tones (toneColor in story-shader.ts). */
export const TONE = {
  palette: 0, // the particle's own colour from the logo palette
  accent: 1, // the logo's yellow
  azure: 2, // the logo's blue, lifted
  ink: 3, // pale on a dark page, navy on a light one
  logo: 4, // the logo image's own colour (in `color`)
  muted: 5, // quieter than the rest: maps and ground
  warm: 6, // the logo's orange
  logoDark: 7, // a logo's dark parts (in `color`): pale on a dark page, their own colour on a light one
} as const;

export type V3 = [number, number, number];
/** A point: position, size, tone, group — and its own rgb (0..1), for TONE.logo. */
export type Pt = { p: V3; s: number; t?: number; g?: number; c?: V3 };

/** A hover target: a group's box in model space (centre, half sizes). */
export type Target = { group: number; c: V3; hw: number; hh: number };

export type Model = {
  pos: Float32Array;
  size: Float32Array;
  tone: Float32Array;
  group: Float32Array;
  /** rgb per point, for TONE.logo */
  color?: Float32Array;
  /** Model-space extent on screen (x and y). */
  box: { x0: number; x1: number; y0: number; y1: number };
  /** Base particle size and how strongly depth sizes them. */
  look: { size: number; depth: number };
  targets?: Target[];
  /**
   * Models of one family (the history years) share their first `base`
   * points exactly: the scene gives those to the same particles every time,
   * so between two of them only the rest moves.
   */
  family?: { id: string; base: number };
};

const TAU = Math.PI * 2;

/* ---------------------------------------------------------------- */
/* Building blocks                                                   */
/* ---------------------------------------------------------------- */

/** Every point, or an even random thinning of the `rest` to the budget (`keep` always stays). */
export function finish(keep: Pt[], rest: Pt[], budget: number, rand: Rand, look: Model["look"], targets?: Target[]): Model {
  let pick = rest;
  const room = Math.max(0, budget - keep.length);
  if (rest.length > room) {
    const idx = rest.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    pick = idx.slice(0, room).sort((a, b) => a - b).map((i) => rest[i]);
  }
  const all = [...keep.slice(0, budget), ...pick];
  const n = all.length;
  const m: Model = {
    pos: new Float32Array(n * 3),
    size: new Float32Array(n),
    tone: new Float32Array(n),
    group: new Float32Array(n),
    box: { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity },
    look,
    targets,
  };
  if (all.some((pt) => pt.c)) m.color = new Float32Array(n * 3);
  all.forEach(({ p, s, t = TONE.palette, g = 0, c }, i) => {
    m.pos.set(p, i * 3);
    if (c) m.color!.set(c, i * 3);
    m.size[i] = s;
    m.tone[i] = t;
    m.group[i] = g;
    m.box.x0 = Math.min(m.box.x0, p[0]);
    m.box.x1 = Math.max(m.box.x1, p[0]);
    m.box.y0 = Math.min(m.box.y0, p[1]);
    m.box.y1 = Math.max(m.box.y1, p[1]);
  });
  return m;
}

/** Points every `step` along a 3D polyline (from a random offset, so neighbours don't line up). */
export function along(line: V3[], step: number, rand: Rand, each: (p: V3) => void) {
  let total = 0;
  for (let i = 1; i < line.length; i++) total += dist(line[i - 1], line[i]);
  const n = Math.max(1, Math.floor(total / step));
  const gap = total / n;
  let target = rand() * gap;
  let walked = 0;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1];
    const b = line[i];
    const seg = dist(a, b);
    while (target <= walked + seg && target <= total) {
      const t = seg ? (target - walked) / seg : 0;
      each([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
      target += gap;
    }
    walked += seg;
  }
}

const dist = (a: V3, b: V3) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);

/** A dashed polyline: `on` units drawn, `off` skipped. */
export function dashed(line: V3[], step: number, on: number, off: number, rand: Rand, each: (p: V3) => void) {
  let walked = 0;
  let prev: V3 | null = null;
  along(line, step, rand, (p) => {
    if (prev) walked += dist(prev, p);
    prev = p;
    if (walked % (on + off) < on) each(p);
  });
}

export function circle(cx: number, cy: number, z: number, r: number, a0 = 0, a1 = TAU, segs = 64): V3[] {
  return Array.from({ length: segs + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / segs;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r, z] as V3;
  });
}

export const gauss = (rand: Rand) => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(TAU * rand());

/**
 * Text drawn in dots, centred on the origin: `height` is the cap height in
 * model units, `pitch` the dot spacing (also in model units).
 */
export function textDots(text: string, height: number, pitch: number, weight = 700): [number, number][] {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  const px = 220;
  const family = getComputedStyle(document.body).fontFamily || "Arial, sans-serif";
  const font = `${weight} ${px}px ${family}`;
  ctx.font = font;
  const m = ctx.measureText(text);
  const cap = m.actualBoundingBoxAscent || px * 0.72;
  canvas.width = Math.ceil(m.width + 20);
  canvas.height = Math.ceil(cap + 24);
  ctx.font = font;
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, 10, cap + 12);
  const k = height / cap; // model units per px
  const g = pitch / k; // px between dots
  const { data, width, height: h } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const out: [number, number][] = [];
  for (let y = g / 2; y < h; y += g) {
    for (let x = g / 2; x < width; x += g) {
      if (data[(Math.floor(y) * width + Math.floor(x)) * 4 + 3] < 128) continue;
      out.push([(x - width / 2) * k, (h / 2 - y) * k]);
    }
  }
  return out;
}

/** The home page's 747, posed: scaled, rolled toward the viewer, pitched; then moved. */
export function plane(n: number, rand: Rand, s: number, pitch: number, roll: number, at: V3, size = 1): Pt[] {
  const shape = airplane(n, rand);
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(...at),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(roll, 0, pitch, "ZXY")),
    new THREE.Vector3(s, s, s),
  );
  const v = new THREE.Vector3();
  const out: Pt[] = [];
  for (let i = 0; i < shape.pos.length / 3; i++) {
    v.fromArray(shape.pos, i * 3).applyMatrix4(m);
    out.push({ p: [v.x, v.y, v.z], s: size * shape.size[i] });
  }
  return out;
}

/* ---------------------------------------------------------------- */
/* Giới thiệu                                                        */
/* ---------------------------------------------------------------- */

/** The flight path's milestones (2013, 2016, 2019, 2022), as shares along it. */
const MILESTONES = [0.1, 0.37, 0.64, 0.9];
const MAP_TILT = 0.5; // the dotted world map lies back, under the path

/** The curved flight path, as a cubic Bézier in model space. */
function pathAt(t: number): V3 {
  const P = [
    [-4.2, -1.9, 0.5],
    [-1.6, -2.3, 1.1],
    [0.9, 1.5, 0.9],
    [4.2, 0.9, 0.4],
  ];
  const u = 1 - t;
  const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return [0, 1, 2].map((c) => P.reduce((s, p, i) => s + p[c] * w[i], 0)) as V3;
}

/**
 * A dotted world map (Europe to the Pacific), lying back under the path —
 * as the brochure's history page has it.
 */
function worldDots(geo: GeoData, rand: Rand): Pt[] {
  const isLand = landMask(geo);
  const out: Pt[] = [];
  const k = 0.046; // units per degree
  const step = 2.3; // degrees between dots
  for (let lat = -42; lat <= 66; lat += step) {
    for (let lon = -18; lon <= 172; lon += step) {
      if (!isLand(lat, lon)) continue;
      const x = (lon - 77) * k;
      const y = (lat - 12) * k;
      // tilted back about the x axis
      out.push({
        p: [x + (rand() - 0.5) * 0.02, y * Math.cos(MAP_TILT) - 0.35, -y * Math.sin(MAP_TILT)],
        s: 0.62,
        t: TONE.muted,
      });
    }
  }
  return out;
}

/** `keep` in full, plus an even random thinning of `rest` — so that together they come to `budget`. */
function thin(keep: Pt[], rest: Pt[], budget: number, rand: Rand): Pt[] {
  const room = Math.max(0, budget - keep.length);
  if (rest.length <= room) return [...keep, ...rest];
  const idx = rest.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return [...keep, ...idx.slice(0, room).sort((a, b) => a - b).map((i) => rest[i])];
}

/** Room left in every history frame for its year and the pointer to its milestone. */
const YEAR_ROOM = 640;
const historyBases = new Map<number, Pt[]>();

/**
 * The history frames' shared base — the world, the flight path, the four
 * milestones — built once, the same points in the same order every time, so
 * every year frame holds them on the very same particles: moving from one
 * year to the next, the base stays exactly where it is.
 */
function historyBase(budget: number, geo: GeoData): Pt[] {
  const cached = historyBases.get(budget);
  if (cached) return cached;
  const rand = mulberry32(2013);
  const keep: Pt[] = [];
  const rest: Pt[] = [];
  // the path: a bright core and a soft contrail around it
  const line = Array.from({ length: 80 }, (_, i) => pathAt(i / 79));
  along(line, 0.055, rand, (p) => keep.push({ p, s: 0.8, t: TONE.azure }));
  along(line, 0.012, rand, (p) => {
    const r = Math.abs(gauss(rand)) * 0.09;
    const a = rand() * TAU;
    rest.push({ p: [p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r, p[2] + (rand() - 0.5) * 0.1], s: 0.42 });
  });
  // milestones: a ring with a dot at its heart, each its own group
  MILESTONES.forEach((m, i) => {
    const [x, y, z] = pathAt(m);
    along(circle(x, y, z + 0.02, 0.24), 0.05, rand, (p) => keep.push({ p, s: 0.95, t: TONE.ink, g: i + 1 }));
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * TAU;
      keep.push({ p: [x + Math.cos(a) * 0.07, y + Math.sin(a) * 0.07, z + 0.02], s: 1.1, t: TONE.accent, g: i + 1 });
    }
  });
  rest.push(...worldDots(geo, rand));
  const base = thin(keep, rest, budget - YEAR_ROOM, rand);
  historyBases.set(budget, base);
  return base;
}

/**
 * Lịch sử hình thành: the world, the flight path and its four milestones
 * (groups 1–4) — the base, never reshaped — and the year, drawn in particles
 * above its milestone with a dotted pointer down to it: the only part that
 * moves on from one year to the next.
 */
export function history(budget: number, rand: Rand, geo: GeoData, year: number): Model {
  const base = historyBase(budget, geo);
  const moving: Pt[] = [];
  const i = Math.max(0, [2013, 2016, 2019, 2022].indexOf(year));
  const [mx, my, mz] = pathAt(MILESTONES[i]);
  const cx = Math.min(2.3, Math.max(-2.3, mx));
  const cy = Math.max(my + 1.6, 1.2);
  for (const [x, y] of textDots(String(year), 1.5, 0.082)) {
    moving.push({ p: [cx + x, cy + y, mz + 0.25 + (rand() - 0.5) * 0.03], s: 0.9, t: TONE.azure });
  }
  along(
    [
      [mx, cy - 0.95, mz + 0.2],
      [mx, my + 0.32, mz + 0.05],
    ],
    0.11,
    rand,
    (p) => moving.push({ p, s: 0.6, t: TONE.accent, g: i + 1 }),
  );
  const m = finish([...base, ...moving.slice(0, YEAR_ROOM)], [], budget, rand, { size: 0.8, depth: 0.5 });
  m.family = { id: "history", base: base.length };
  return m;
}

/** Surface points of some meshes, evenly spaced (n of them). */
function surface(parts: THREE.BufferGeometry[], n: number, rand: Rand): V3[] {
  const merged = mergeGeometries(parts.map((g) => {
    const src = g.index ? g.toNonIndexed() : g;
    const out = new THREE.BufferGeometry();
    out.setAttribute("position", src.getAttribute("position"));
    return out;
  }));
  const sampler = new MeshSurfaceSampler(new THREE.Mesh(merged)).build();
  const v = new THREE.Vector3();
  const cands = new Float32Array(n * 4 * 3);
  for (let i = 0; i < n * 4; i++) {
    sampler.sample(v);
    cands.set([v.x, v.y, v.z], i * 3);
  }
  merged.dispose();
  const pts = evenly(cands, n, rand);
  const out: V3[] = [];
  for (let i = 0; i < pts.length; i += 3) out.push([pts[i], pts[i + 1], pts[i + 2]]);
  return out;
}

/**
 * Tầm nhìn: the summit — a mountain range, its highest peak in the middle
 * with a flag planted on top, and a dotted trail climbing to it.
 */
export function vision(budget: number, rand: Rand): Model {
  const keep: Pt[] = [];
  const rest: Pt[] = [];
  const PEAK = { x: 0.2, z: 0, h: 2.75 };
  const height = (x: number, z: number) =>
    PEAK.h * Math.exp(-((x - PEAK.x) ** 2 / 1.5 + z ** 2 / 0.9)) +
    1.45 * Math.exp(-((x + 2.0) ** 2 / 1.0 + (z - 0.3) ** 2 / 0.7)) +
    1.1 * Math.exp(-((x - 2.4) ** 2 / 0.8 + (z + 0.2) ** 2 / 0.6));
  const Y0 = -1.65;
  // the range: a heightfield of particles, larger (and snowy) toward the top
  for (let z = -1.7; z <= 1.7; z += 0.13) {
    for (let x = -4.0; x <= 4.0; x += 0.115) {
      const jx = x + (rand() - 0.5) * 0.05;
      const jz = z + (rand() - 0.5) * 0.05;
      const h = height(jx, jz);
      const fall = Math.exp(-(jz * jz) / 2.2); // fades out toward the front and back
      if (h < 0.08 && rand() > 0.35 * fall) continue;
      const k = h / PEAK.h;
      rest.push({
        p: [jx, Y0 + h, jz],
        s: 0.5 + 0.55 * k,
        t: k > 0.72 ? TONE.ink : k > 0.25 ? TONE.azure : TONE.muted,
      });
    }
  }
  // the ridge lines, crisper
  for (const zz of [0]) {
    const ridge = Array.from({ length: 90 }, (_, i) => {
      const x = -4 + (8 * i) / 89;
      return [x, Y0 + height(x, zz) + 0.03, zz] as V3;
    });
    along(ridge, 0.05, rand, (p) => keep.push({ p, s: 0.85, t: TONE.ink }));
  }
  // the trail up to the summit
  const top: V3 = [PEAK.x, Y0 + height(PEAK.x, 0), 0];
  const trail = Array.from({ length: 60 }, (_, i) => {
    const t = i / 59;
    const x = -3.2 + (PEAK.x + 3.2) * t;
    const z = 0.9 * (1 - t) * Math.sin(t * 7) * 0.5 + 0.35 * (1 - t);
    return [x, Y0 + height(x, z) + 0.05, z] as V3;
  });
  dashed(trail, 0.05, 0.14, 0.09, rand, (p) => keep.push({ p, s: 0.62, t: TONE.accent }));
  // the flag: a pole, and a cloth rippling in the wind
  along(
    [
      [top[0], top[1], 0],
      [top[0], top[1] + 1.25, 0],
    ],
    0.045,
    rand,
    (p) => keep.push({ p, s: 0.8, t: TONE.ink }),
  );
  for (let u = 0; u <= 1.0001; u += 0.07) {
    for (let v = 0; v <= 1.0001; v += 0.1) {
      const x = top[0] + 0.05 + u * 0.95;
      const y = top[1] + 1.25 - v * 0.55 - u * 0.06;
      const z = Math.sin(u * 5.5) * 0.09 * u;
      const edge = u < 0.01 || u > 0.99 || v < 0.01 || v > 0.99;
      (edge ? keep : rest).push({ p: [x, y, z], s: edge ? 0.85 : 0.7, t: TONE.accent });
    }
  }
  return finish(keep, rest, budget, rand, { size: 0.85, depth: 0.45 });
}

/**
 * Sứ mệnh: connecting customers with the sky — customers scattered across
 * the ground, each linked by a rising arc to an airliner above them.
 */
export function mission(budget: number, rand: Rand): Model {
  const keep: Pt[] = [];
  const rest: Pt[] = [];
  const Y0 = -1.55;
  // the ground: a faint ellipse of dots, lying back
  for (let r = 0.35; r <= 4.2; r += 0.22) {
    const n = Math.round((r * TAU) / 0.2);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU + rand() * 0.2;
      rest.push({ p: [Math.cos(a) * r, Y0, Math.sin(a) * r * 0.42], s: 0.42, t: TONE.muted });
    }
  }
  // the airliner, up in the sky
  const hub: V3 = [0.7, 1.55, 0];
  keep.push(...plane(Math.round(budget * 0.24), rand, 0.36, 0.12, 0.45, [hub[0] + 0.2, hub[1] + 0.12, hub[2]], 1.05));
  // the customers: small rings on the ground, and an arc from each up to the airliner
  const people = 26;
  for (let k = 0; k < people; k++) {
    const a = (k / people) * TAU + rand() * 0.18;
    const r = 1.2 + rand() * 2.8;
    const at: V3 = [Math.cos(a) * r, Y0 + 0.02, Math.sin(a) * r * 0.42];
    along(circle(at[0], at[1] + 0.12, at[2], 0.1, 0, TAU, 12), 0.045, rand, (p) => keep.push({ p, s: 0.8, t: TONE.ink }));
    keep.push({ p: [at[0], at[1] + 0.12, at[2]], s: 1.0, t: TONE.accent });
    const ctrl: V3 = [at[0] * 0.55 + hub[0] * 0.45, hub[1] * 0.35 + 0.9, at[2] * 0.5];
    const arc = Array.from({ length: 30 }, (_, i) => {
      const t = i / 29;
      const u = 1 - t;
      return [0, 1, 2].map((c) => u * u * at[c] + 2 * u * t * ctrl[c] + t * t * hub[c]) as V3;
    });
    along(arc, 0.11, rand, (p) => rest.push({ p, s: 0.5, t: TONE.azure }));
  }
  return finish(keep, rest, budget, rand, { size: 0.85, depth: 0.45 });
}

/**
 * Giá trị cốt lõi: five fists in a full circle — one per value (groups 1–5,
 * clockwise from the top) — knuckles turned to the centre, forearms reaching
 * out like spokes, a dotted ring joining them.
 */
export function values(budget: number, rand: Rand): Model {
  const keep: Pt[] = [];
  // one fist and forearm, knuckles toward +X, the forearm along −X
  const parts = () => {
    const palm = new THREE.SphereGeometry(1, 24, 16);
    palm.scale(0.36, 0.3, 0.28);
    const knuckles = [-0.21, -0.07, 0.07, 0.21].flatMap((y) => {
      const k = new THREE.SphereGeometry(0.115, 14, 10);
      k.translate(0.3, y, 0.06);
      const f = new THREE.SphereGeometry(0.1, 14, 10);
      f.translate(0.24, y, -0.17);
      return [k, f];
    });
    const thumb = new THREE.CapsuleGeometry(0.085, 0.3, 6, 12);
    thumb.translate(0.16, -0.02, 0.26);
    return [palm, ...knuckles, thumb];
  };
  const forearm = () => {
    const arm = new THREE.CylinderGeometry(0.21, 0.25, 1.1, 24, 1, true);
    arm.rotateZ(Math.PI / 2);
    arm.translate(-0.85, 0, 0);
    const cuff = new THREE.TorusGeometry(0.25, 0.04, 8, 28);
    cuff.rotateY(Math.PI / 2);
    cuff.translate(-0.33, 0, 0);
    return [arm, cuff];
  };
  // the fists carry most of the particles, so they read as fists; the
  // forearms are short, just enough to show where each reaches in from
  const each = Math.floor((budget * 0.9) / 5);
  const F = 1.4; // fists drawn large
  const RING = 1.7; // the circle the fists stand on
  // the fist pale, the forearm in the palette — with a little gap at the wrist
  const fist: { p: V3; t: number }[] = [
    ...surface(parts(), Math.round(each * 0.68), rand).map(([x, y, z]) => ({ p: [x * F, y * F, z * F] as V3, t: TONE.ink })),
    ...surface(forearm(), Math.round(each * 0.32), rand).map(([x, y, z]) => ({
      p: [x * F - 0.2, y * F * 0.9, z * F * 0.9] as V3,
      t: TONE.palette,
    })),
  ];
  const m = new THREE.Matrix4();
  const v = new THREE.Vector3();
  for (let k = 0; k < 5; k++) {
    const a = Math.PI / 2 - (k * TAU) / 5; // clockwise from the top
    // turned to point inward, the forearm reaching back and away from the viewer
    m.compose(
      new THREE.Vector3(Math.cos(a) * RING, Math.sin(a) * RING, 0),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, a + Math.PI)).multiply(
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -0.12, 0)),
      ),
      new THREE.Vector3(1, 1, 1),
    );
    for (const { p, t } of fist) {
      v.set(...p).applyMatrix4(m);
      keep.push({ p: [v.x, v.y, v.z], s: t === TONE.ink ? 0.9 : 0.75, t, g: k + 1 });
    }
  }
  // the circle they make, through the fists, and a small mark at its heart
  dashed(circle(0, 0, 0, RING, 0, TAU, 200), 0.05, 0.16, 0.1, rand, (p) => keep.push({ p, s: 0.6, t: TONE.accent }));
  along(circle(0, 0, 0, 0.18, 0, TAU, 24), 0.05, rand, (p) => keep.push({ p, s: 0.7, t: TONE.accent }));
  return finish(keep, [], budget, rand, { size: 0.85, depth: 0.55 });
}

/* ---------------------------------------------------------------- */
/* ---------------------------------------------------------------- */
/* Tổ chức                                                           */
/* ---------------------------------------------------------------- */

/** Head count by share, as the brochure's chart: groups 1–3, in order around the pie. */
export const PIE = [
  { share: 0.038, tone: TONE.accent, label: "3.8%", out: 0.42 }, // ban lãnh đạo
  { share: 0.385, tone: TONE.azure, label: "38.5%", out: 0.08 }, // nhân viên công ty
  { share: 0.577, tone: TONE.muted, label: "57.7%", out: 0 }, // cộng tác viên: grey, as the brochure
] as const;

/**
 * Năng lực nhân sự: the staff as a 3D pie — each share a thick slice (groups
 * 1–3), the leadership's thin one pulled out — with its percentage drawn in
 * particles beside it. Lies back by `tilt` (the pose's rx is −tilt), so the
 * numbers are stood up to face the viewer.
 */
export function pie(budget: number, rand: Rand, tilt = 0.8): Model {
  const keep: Pt[] = [];
  const rest: Pt[] = [];
  const R = 2.3;
  const H = 0.5; // thickness, away from the viewer
  let start = Math.PI / 2; // from the top, clockwise
  PIE.forEach((slice, k) => {
    const g = k + 1;
    const a1 = start;
    const a0 = start - slice.share * TAU;
    start = a0;
    const mid = (a0 + a1) / 2;
    const [ox, oy] = [Math.cos(mid) * slice.out, Math.sin(mid) * slice.out];
    const inSlice = (x: number, y: number) => {
      const r = Math.hypot(x, y);
      if (r > R) return false;
      let a = Math.atan2(y, x);
      while (a < a0) a += TAU;
      while (a > a0 + TAU) a -= TAU;
      return a <= a1;
    };
    const t = slice.tone;
    // the face: a fine fill, the rim and the two cut edges drawn strong
    for (let y = -R; y <= R; y += 0.085) {
      for (let x = -R; x <= R; x += 0.085) {
        const jx = x + (rand() - 0.5) * 0.03;
        const jy = y + (rand() - 0.5) * 0.03;
        if (inSlice(jx, jy)) rest.push({ p: [jx + ox, jy + oy, 0], s: 0.6, t, g });
      }
    }
    along(circle(ox, oy, 0, R, a0, a1, 96), 0.04, rand, (p) => keep.push({ p, s: 0.95, t, g }));
    for (const a of [a0, a1]) {
      along(
        [
          [ox, oy, 0],
          [ox + Math.cos(a) * R, oy + Math.sin(a) * R, 0],
        ],
        0.045,
        rand,
        (p) => keep.push({ p, s: 0.85, t, g }),
      );
    }
    // the thickness: the outer wall in rows, its bottom edge, the cut faces lightly
    for (let z = -0.1; z >= -H; z -= 0.1) {
      along(circle(ox, oy, z, R, a0, a1, 96), 0.09, rand, (p) => rest.push({ p, s: z <= -H + 0.01 ? 0.7 : 0.48, t, g }));
    }
    for (const a of [a0, a1]) {
      for (let z = -0.1; z >= -H; z -= 0.12) {
        along(
          [
            [ox, oy, z],
            [ox + Math.cos(a) * R, oy + Math.sin(a) * R, z],
          ],
          0.11,
          rand,
          (p) => rest.push({ p, s: 0.45, t, g }),
        );
      }
    }
    // the percentage, beside its slice, stood up to face the viewer — always
    // at full strength (no group), while the slices take turns to light
    const reach = R + slice.out + (slice.share < 0.1 ? 0.7 : 1.25);
    const [lx, ly] = [Math.cos(mid) * reach, Math.sin(mid) * reach];
    const [c, sn] = [Math.cos(tilt), Math.sin(tilt)];
    for (const [x, y] of textDots(slice.label, 0.62, 0.062)) {
      keep.push({ p: [lx + x, ly + y * c, 0.12 + y * sn], s: 0.9, t });
    }
  });
  return finish(keep, rest, budget, rand, { size: 0.8, depth: 0.4 });
}


/** Groups (1-based, as ORG) where each level's reveal ends: the board, the heads, the teams. */
export const ORG_LEVEL_END = { board: 2, heads: 7, teams: ORG.length } as const;

/** Per level: the position's particle size, its halo's radius and count, and its colour. */
const NODE = [
  { s: 7.6, r: 0.42, n: 22, t: TONE.accent },
  { s: 6.2, r: 0.36, n: 20, t: TONE.accent },
  { s: 4.6, r: 0.28, n: 16, t: TONE.azure },
  { s: 3.0, r: 0.2, n: 11, t: TONE.ink },
  { s: 2.6, r: 0.18, n: 10, t: TONE.ink },
];

/**
 * Sơ đồ tổ chức: every position one particle — the larger, the higher it
 * stands — ringed by a small halo, joined to whoever it reports to by a
 * dotted line. Each position (with the line up from it) is its own group, in
 * ORG's order, so the scene can bring them in one after another; each is
 * also a hover target.
 */
export function orgChart(budget: number, rand: Rand): Model {
  const keep: Pt[] = [];
  const targets: Target[] = [];
  const colX = (c: number) => (c - 2) * 1.95;
  const rowY = (r: number) => (r === 0 ? 2.75 : r === 1 ? 1.9 : 0.9 - (r - 2) * 0.74);
  const pos = new Map<string, { x: number; y: number; z: number; r: number }>();
  const siblingsAbove = new Map<string, number>(); // the last child placed under each parent: its y

  ORG.forEach((n, i) => {
    const g = i + 1;
    const node = NODE[n.level];
    const x = colX(n.col) + (n.level >= 3 ? 0.34 : 0) + (n.level === 4 ? 0.3 : 0);
    const y = rowY(n.row);
    const z = [0.6, 0.45, 0.2, 0, -0.1][n.level];
    pos.set(n.id, { x, y, z, r: node.r });
    keep.push({ p: [x, y, z], s: node.s, t: node.t, g });
    for (let k = 0; k < node.n; k++) {
      const a = (k / node.n) * TAU + rand() * 0.2;
      keep.push({ p: [x + Math.cos(a) * node.r, y + Math.sin(a) * node.r, z], s: 0.62, t: node.t, g });
    }
    targets.push({ group: g, c: [x, y, z], hw: node.r + 0.12, hh: node.r + 0.12 });

    // the line up to its parent, drawn with it
    if (!("parent" in n)) return;
    const p = pos.get(n.parent)!;
    let line: V3[];
    if (n.level <= 1 || (n.level === 2 && n.col === 2)) {
      line = [
        [p.x, p.y - p.r, p.z],
        [x, y + node.r, z],
      ];
    } else if (n.level === 2) {
      // across the bar under the deputy, then down
      const bar = (p.y + y) / 2;
      line = [
        [p.x, p.y - p.r, p.z],
        [p.x, bar, (p.z + z) / 2],
        [x, bar, (p.z + z) / 2],
        [x, y + node.r, z],
      ];
    } else {
      // down a spine under the head (from the sibling above), then across
      const from = siblingsAbove.get(n.parent) ?? p.y - p.r;
      line = [
        [p.x, from, z],
        [p.x, y, z],
        [x - node.r, y, z],
      ];
      siblingsAbove.set(n.parent, y);
    }
    along(line, 0.07, rand, (q) => keep.push({ p: q, s: 0.42, t: TONE.muted, g }));
  });
  const model = finish(keep, [], budget, rand, { size: 0.8, depth: 0.3 }, targets);
  // room on the right for the names written beside each position (OrgLabels)
  model.box.x1 += 1.8;
  return model;
}
