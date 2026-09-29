import * as THREE from "three";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { airport } from "@/lib/flights";
import {
  DOMESTIC_ROUTES,
  GATEWAYS,
  HOANG_SA,
  INTERNATIONAL_ROUTES,
  TRUONG_SA,
  type IslandSize,
} from "./routes";

type Rand = () => number;
type Vec3 = [number, number, number];
type Pt = [number, number];
/**
 * A particle's resting place in a model, its size relative to the model's
 * usual particle, and whether it's drawn in the accent colour (flight lines).
 */
type Item = { p: Vec3; s: number; a?: number };
/** A model: N×3 positions, N size factors, N accent flags. */
type Shape = { pos: Float32Array; size: Float32Array; accent: Float32Array };

/** Shape of components/scene/geo-data.json (built by scripts/build-geo.mjs). */
export type GeoData = {
  vietnam: { q: number; outline: number[][]; borders: number[][] };
  land: { w: number; h: number; rle: string };
};

const TAU = Math.PI * 2;
const D2R = Math.PI / 180;

/** Camera the star field and globe framing are laid out for (see Scene.tsx). */
export const CAMERA_Z = 14;
export const CAMERA_FOV = 35;

export const GLOBE_RADIUS = 4;
const GLOBE_LON0 = 106; // this meridian faces the camera
/** Latitude facing the camera in the final pose — puts South-East Asia in the upper-middle of the disc. */
export const GLOBE_FACING_LAT = -15;

/** Vivid, never grey (DESIGN.md). sRGB 0..1, written straight out by the shader. */
const PALETTE: [string, number][] = [
  // the logo's colours: mostly its blue (lifted to glow on black), a spark of its yellow and orange
  ["#1f7fd8", 0.3],
  ["#4fa8ff", 0.22],
  ["#9fd0ff", 0.12],
  ["#0a64b8", 0.12],
  ["#f5a830", 0.16],
  ["#f07a30", 0.08],
];

/** Particle size factors for the finer details. */
const SIZE = { route: 0.34, globeRoute: 0.5, airport: 0.6 };
/** Islands by area: how many particles, how far they spread, how big they are. */
const ISLAND: Record<IslandSize, { n: number; r: number; s: number }> = {
  L: { n: 7, r: 0.034, s: 1.25 },
  M: { n: 4, r: 0.02, s: 0.95 },
  S: { n: 2, r: 0.011, s: 0.7 },
  R: { n: 1, r: 0, s: 0.45 },
};

export function mulberry32(seed: number): Rand {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function onSphere(rand: Rand, r: number): Vec3 {
  const u = rand() * 2 - 1;
  const t = rand() * TAU;
  const s = Math.sqrt(1 - u * u);
  return [r * s * Math.cos(t), r * u, r * s * Math.sin(t)];
}

function hexToRgb(hex: string): Vec3 {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function shuffled(n: number, rand: Rand): Uint32Array {
  const a = new Uint32Array(n);
  for (let i = 0; i < n; i++) a[i] = i;
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function toShape(items: Item[]): Shape {
  const pos = new Float32Array(items.length * 3);
  const size = new Float32Array(items.length);
  const accent = new Float32Array(items.length);
  items.forEach(({ p, s, a = 0 }, i) => {
    pos.set(p, i * 3);
    size[i] = s;
    accent[i] = a;
  });
  return { pos, size, accent };
}

/** `keep` in full, plus a random, even thinning of `rest` down to the budget. */
function take(rest: Item[], budget: number, rand: Rand, keep: Item[] = []): Shape {
  const room = Math.max(0, budget - keep.length);
  let pick = rest;
  if (rest.length > room) {
    const idx = shuffled(rest.length, rand).subarray(0, room).sort();
    pick = Array.from(idx, (i) => rest[i]);
  }
  return toShape([...keep, ...pick]);
}

/* ------------------------------------------------------------------ */
/* Even spacing (blue noise)                                           */
/* ------------------------------------------------------------------ */

/** Greedy Poisson-disk pass: indices of candidates kept at min distance r. */
function poissonPass(c: Float32Array, r: number): number[] {
  const n = c.length / 3;
  const inv = 1 / r;
  const r2 = r * r;
  const grid = new Map<number, number[]>();
  const key = (x: number, y: number, z: number) => (x * 73856093) ^ (y * 19349663) ^ (z * 83492791);
  const kept: number[] = [];
  for (let i = 0; i < n; i++) {
    const x = c[i * 3];
    const y = c[i * 3 + 1];
    const z = c[i * 3 + 2];
    const gx = Math.floor(x * inv);
    const gy = Math.floor(y * inv);
    const gz = Math.floor(z * inv);
    let ok = true;
    for (let dx = -1; dx <= 1 && ok; dx++)
      for (let dy = -1; dy <= 1 && ok; dy++)
        for (let dz = -1; dz <= 1 && ok; dz++) {
          const cell = grid.get(key(gx + dx, gy + dy, gz + dz));
          if (!cell) continue;
          for (const j of cell) {
            const ex = c[j * 3] - x;
            const ey = c[j * 3 + 1] - y;
            const ez = c[j * 3 + 2] - z;
            if (ex * ex + ey * ey + ez * ez < r2) {
              ok = false;
              break;
            }
          }
        }
    if (!ok) continue;
    kept.push(i);
    const k = key(gx, gy, gz);
    const cell = grid.get(k);
    if (cell) cell.push(i);
    else grid.set(k, [i]);
  }
  return kept;
}

/**
 * Up to `count` points from an oversampled, randomly ordered candidate set,
 * with neighbours roughly the same distance apart.
 */
function evenly(cands: Float32Array, count: number, rand: Rand): Float32Array {
  const n = cands.length / 3;
  let best = Array.from({ length: n }, (_, i) => i);
  if (n > count) {
    let lo = 0;
    let hi = 0;
    for (let i = 0; i < cands.length; i++) hi = Math.max(hi, Math.abs(cands[i]));
    hi *= 0.25;
    for (let it = 0; it < 11; it++) {
      const mid = (lo + hi) / 2;
      const kept = poissonPass(cands, mid);
      if (kept.length >= count) {
        lo = mid;
        best = kept;
      } else hi = mid;
    }
  }
  // Trim the few extras at random; holes this small are invisible.
  for (let i = best.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [best[i], best[j]] = [best[j], best[i]];
  }
  const m = Math.min(count, best.length);
  const out = new Float32Array(m * 3);
  for (let i = 0; i < m; i++) out.set(cands.subarray(best[i] * 3, best[i] * 3 + 3), i * 3);
  return out;
}

const OVERSAMPLE = 4;

/* ------------------------------------------------------------------ */
/* Airliner — nose at +X, wings along Z, fin up +Y                     */
/* ------------------------------------------------------------------ */

function positionOnly(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const src = geo.index ? geo.toNonIndexed() : geo;
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", src.getAttribute("position"));
  return out;
}

function flatShape(points: Pt[], depth: number): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
}

/** Model-space half-length of the plane — the depth-sizing radius. */
export const PLANE_RADIUS = 3.7;

/**
 * A Boeing 747: long fuselage with the upper-deck hump over the front third,
 * wings swept back 37.5° with four engines slung beneath, and a tall swept
 * fin over wide tailplanes.
 */
function airplane(target: number, rand: Rand): Shape {
  // Fuselage radius along its length (x, radius), tail cone to blunt nose.
  const PROFILE: Pt[] = [
    [-5, 0], [-4.9, 0.12], [-4.4, 0.28], [-3.6, 0.42], [-2.5, 0.53], [-1.2, 0.56],
    [3.3, 0.56], [4.0, 0.53], [4.5, 0.46], [4.85, 0.34], [5.05, 0.18], [5.12, 0],
  ];
  const radiusAt = (x: number) => {
    for (let i = 1; i < PROFILE.length; i++) {
      const [x1, r1] = PROFILE[i];
      if (x <= x1) {
        const [x0, r0] = PROFILE[i - 1];
        return r0 + ((r1 - r0) * (x - x0)) / (x1 - x0);
      }
    }
    return 0;
  };
  const fuselage = new THREE.LatheGeometry(
    PROFILE.map(([x, r]) => new THREE.Vector2(r, x)),
    48,
  );
  fuselage.rotateZ(-Math.PI / 2); // lathe axis Y -> nose at +X

  // The hump: the top half of a long ellipsoid, fairing into the nose.
  const HUMP = { x: 3.2, y: 0.2, a: 1.75, b: 0.68, c: 0.47 };
  const hump = new THREE.SphereGeometry(1, 40, 12, 0, TAU, 0, Math.PI / 2);
  hump.scale(HUMP.a, HUMP.b, HUMP.c);
  hump.translate(HUMP.x, HUMP.y, 0);
  const inHump = (x: number, y: number, z: number) =>
    y > HUMP.y && ((x - HUMP.x) / HUMP.a) ** 2 + ((y - HUMP.y) / HUMP.b) ** 2 + (z / HUMP.c) ** 2 < 1;

  // Wings: leading edge swept 37.5°, the trailing edge kinked inboard.
  const wing = flatShape(
    [[1.3, 0], [-2.3, 4.6], [-2.85, 4.6], [-1.35, 1.6], [-1.0, 0], [-1.35, -1.6], [-2.85, -4.6], [-2.3, -4.6]],
    0.1,
  );
  wing.rotateX(-Math.PI / 2);
  wing.translate(0, -0.35, 0);
  // ...and angled up toward the tips (dihedral), as on the real thing.
  const DIHEDRAL = Math.tan(6 * D2R);
  const wingPos = wing.getAttribute("position");
  for (let i = 0; i < wingPos.count; i++) wingPos.setY(i, wingPos.getY(i) + Math.abs(wingPos.getZ(i)) * DIHEDRAL);
  const leadingEdge = (z: number) => 1.3 - Math.tan(37.5 * D2R) * Math.abs(z);

  // Four engines, hung forward of the leading edge.
  const engines = [-2.9, -1.6, 1.6, 2.9].map((z) => {
    const inboard = Math.abs(z) < 2;
    const e = new THREE.CylinderGeometry(inboard ? 0.25 : 0.23, inboard ? 0.2 : 0.19, 1.05, 24, 1, true);
    e.rotateZ(Math.PI / 2);
    e.translate(leadingEdge(z) + 0.1, -0.64 + Math.abs(z) * DIHEDRAL, z);
    return e;
  });

  // A generous tail: tall swept fin, wide tailplanes (a touch larger than life, so it reads).
  const stabilizer = flatShape([[-3.3, 0], [-4.55, 2.1], [-4.95, 2.1], [-4.7, 0], [-4.95, -2.1], [-4.55, -2.1]], 0.08);
  stabilizer.rotateX(-Math.PI / 2);
  stabilizer.translate(0, 0.12, 0);
  const fin = flatShape([[-3.1, 0.35], [-4.5, 2.75], [-5.05, 2.75], [-4.85, 0.35]], 0.1);
  fin.translate(0, 0, -0.05);

  // Sampled part by part, dropping points hidden inside another part (the
  // fuselage's crown under the hump, the hump's sides inside the fuselage),
  // so every particle sits on the outer skin.
  const SCALE = 0.72;
  type Hidden = (x: number, y: number, z: number) => boolean;
  const sample = (parts: THREE.BufferGeometry[], n: number, s: number, hidden: Hidden): Item[] => {
    const merged = mergeGeometries(parts.map(positionOnly));
    const sampler = new MeshSurfaceSampler(new THREE.Mesh(merged)).build();
    const v = new THREE.Vector3();
    const cands: number[] = [];
    for (let guard = 0; cands.length < n * OVERSAMPLE * 3 && guard < n * OVERSAMPLE * 6; guard++) {
      sampler.sample(v);
      if (hidden(v.x, v.y, v.z)) continue;
      cands.push(v.x * SCALE, v.y * SCALE, v.z * SCALE);
    }
    merged.dispose();
    const pos = evenly(Float32Array.from(cands), n, rand);
    const out: Item[] = [];
    for (let i = 0; i < pos.length; i += 3) out.push({ p: [pos[i], pos[i + 1], pos[i + 2]], s });
    return out;
  };
  const insideFuselage: Hidden = (x, y, z) => Math.hypot(y, z) < radiusAt(x) - 0.01;

  // The tail is thin and far away, so it's sampled on its own at about twice
  // the density, with slightly larger particles — otherwise it all but vanishes.
  const tailN = Math.round(target * 0.2);
  const humpN = Math.round(target * 0.1);
  const bodyN = Math.round((target - tailN - humpN) * 0.55);
  const items = [
    ...sample([fuselage], bodyN, 1, inHump),
    ...sample([hump], humpN, 1, insideFuselage),
    ...sample([wing, ...engines], target - tailN - humpN - bodyN, 1, insideFuselage),
    ...sample([fin, stabilizer], tailN, 1.25, insideFuselage),
  ];
  [fuselage, hump, wing, stabilizer, fin, ...engines].forEach((p) => p.dispose());
  return toShape(items);
}

/* ------------------------------------------------------------------ */
/* Deep sky — WORLD space, a real volume in front of the camera        */
/* ------------------------------------------------------------------ */

/**
 * Distances from the camera the sky spans, and how far past the frame's
 * edges it reaches. Stars sit roughly evenly spaced *in 3D*, so on screen
 * the far ones crowd together as tiny points while only a handful come
 * close enough to look large — plus a few `close` ones right in front of
 * the viewer, the largest of all, kept to the frame's edges (clear of the
 * models and the copy).
 */
const SKY = { near: 1.5, far: 50, spreadX: 1.5, spreadY: 1.35, voids: 8, groups: 16, close: 8 };

function deepSky(count: number, rand: Rand, { far = SKY.far, close = SKY.close } = {}): Float32Array {
  const T = Math.tan((CAMERA_FOV / 2) * D2R);
  const aspect = 1.9; // ≈ the widest common aspect ratio
  const n3 = SKY.near ** 3;
  const f3 = far ** 3;
  const distance = () => Math.cbrt(n3 + rand() * (f3 - n3)); // uniform through the volume
  // Voids and groups are laid out along lines of sight (in screen units,
  // 1 = half the frame's height), so they read as dark gaps and denser star
  // systems on screen rather than being filled in by stars in front or behind.
  const spot = () => ({ u: (rand() * 2 - 1) * aspect * SKY.spreadX * 0.9, v: (rand() * 2 - 1) * SKY.spreadY * 0.9 });
  const voids = Array.from({ length: SKY.voids }, () => ({ ...spot(), r: 0.2 + rand() * 0.18 })); // "dark energy"
  const groups = Array.from({ length: SKY.groups }, () => ({ ...spot(), s: 0.14 + rand() * 0.16 }));

  const cands: number[] = [];
  for (let guard = 0; cands.length < count * 9 && guard < count * 400; guard++) {
    const d = distance();
    const u = (rand() * 2 - 1) * aspect * SKY.spreadX;
    const v = (rand() * 2 - 1) * SKY.spreadY;
    if (voids.some((o) => (u - o.u) ** 2 + (v - o.v) ** 2 < o.r * o.r)) continue;
    let density = 0.22;
    for (const g of groups) density += Math.exp(-((u - g.u) ** 2 + (v - g.v) ** 2) / (2 * g.s * g.s));
    if (rand() * 1.2 > density) continue;
    cands.push(u * d * T, v * d * T, CAMERA_Z - d);
  }
  // Even spacing in 3D: within a group every star keeps its distance; between
  // groups, where candidates are scarce, the gaps open up.
  const out = new Float32Array(count * 3);
  out.set(evenly(Float32Array.from(cands), count - close, rand));

  // The close ones, spaced apart on screen (relaxed if it takes too long).
  const placed: { u: number; v: number }[] = [];
  for (let guard = 0; placed.length < close; guard++) {
    const u = (rand() * 2 - 1) * aspect * 0.95;
    const v = (rand() * 2 - 1) * 0.95;
    const strict = guard < 4000;
    if (Math.abs(v) < 0.55 && Math.abs(u) < 1.2) continue;
    if (strict && voids.some((o) => (u - o.u) ** 2 + (v - o.v) ** 2 < o.r * o.r)) continue;
    if (strict && placed.some((p) => (u - p.u) ** 2 + (v - p.v) ** 2 < 0.45 ** 2)) continue;
    const d = SKY.near + 0.1 + rand() ** 0.8 * 3.5;
    out.set([u * d * T, v * d * T, CAMERA_Z - d], (count - close + placed.length) * 3);
    placed.push({ u, v });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Vietnam — outline, 34 provinces, both archipelagos, domestic routes */
/* ------------------------------------------------------------------ */

const MAP_K = 0.46; // model units per degree
const MAP_CX = 105.8; // mainland centre
const MAP_CY = 15.9;
const OUTLINE_STEP = 0.05;
const ROUTE_STEP = 0.085;

/** lon/lat → Vietnam-map model space. */
export function mapPoint(lon: number, lat: number): Pt {
  return [(lon - MAP_CX) * MAP_K, (lat - MAP_CY) * MAP_K];
}

function decodeLines(lines: number[][], q: number): Pt[][] {
  return lines.map((arr) => {
    const pts: Pt[] = [];
    let x = 0;
    let y = 0;
    for (let i = 0; i < arr.length; i += 2) {
      x += arr[i];
      y += arr[i + 1];
      pts.push(mapPoint(x / q, y / q));
    }
    return pts;
  });
}

function length(line: Pt[]): number {
  let l = 0;
  for (let i = 1; i < line.length; i++) l += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
  return l;
}

/** Points every `step` along a polyline; tiny closed rings still get `minPts`. */
function alongLine(line: Pt[], step: number, rand: Rand, out: Vec3[], minPts = 0) {
  const total = length(line);
  if (total === 0) return;
  const n = Math.max(minPts, Math.floor(total / step));
  if (n === 0) return;
  const gap = total / n;
  let target = rand() * gap;
  let walked = 0;
  for (let i = 1; i < line.length && target <= total; i++) {
    const [ax, ay] = line[i - 1];
    const [bx, by] = line[i];
    const seg = Math.hypot(bx - ax, by - ay);
    while (target <= walked + seg && target <= total) {
      const t = seg ? (target - walked) / seg : 0;
      out.push([ax + (bx - ax) * t, ay + (by - ay) * t, 0]);
      target += gap;
    }
    walked += seg;
  }
}

/** A small ring of particles marking a place. */
function marker(x: number, y: number, n: number, r: number, s: number, rand: Rand, out: Item[], z = 0, accent = 0) {
  out.push({ p: [x, y, z], s, a: accent });
  for (let k = 1; k < n; k++) {
    const a = (k / (n - 1)) * TAU + rand();
    out.push({ p: [x + Math.cos(a) * r, y + Math.sin(a) * r, z], s: s * 0.8, a: accent });
  }
}

/**
 * One route: an arc that bows out seaward (else north) and lifts a little
 * toward the viewer, so the network fans out over the East Sea as flight
 * paths rather than more lines on the provinces.
 */
function domesticRoute(from: string, to: string, rand: Rand, out: Item[]) {
  const a = airport(from);
  const b = airport(to);
  const [ax, ay] = mapPoint(a.lon, a.lat);
  const [bx, by] = mapPoint(b.lon, b.lat);
  const len = Math.hypot(bx - ax, by - ay);
  let nx = -(by - ay) / len;
  let ny = (bx - ax) / len;
  if (nx < -0.2 || (Math.abs(nx) <= 0.2 && ny < 0)) {
    nx = -nx;
    ny = -ny;
  }
  // A quadratic curve bows half as far as its control point: ~0.28 × length here.
  const cx = (ax + bx) / 2 + nx * len * 0.55;
  const cy = (ay + by) / 2 + ny * len * 0.55;
  const n = Math.max(3, Math.round((len * 1.3) / ROUTE_STEP));
  const off = rand();
  for (let i = 0; i < n; i++) {
    const t = (i + off) / n;
    const u = 1 - t;
    out.push({
      p: [u * u * ax + 2 * u * t * cx + t * t * bx, u * u * ay + 2 * u * t * cy + t * t * by, Math.sin(Math.PI * t) * len * 0.08],
      s: SIZE.route,
      a: 1,
    });
  }
}

function vietnam(budget: number, rand: Rand, geo: GeoData): Shape {
  const { q, outline, borders } = geo.vietnam;
  // Offshore rings come from the archipelago list instead, sized by area.
  const offshore = (l: Pt[]) => l.every(([x]) => x / MAP_K + MAP_CX > 110);
  const coast = decodeLines(outline, q).filter((l) => !offshore(l));
  const inner = decodeLines(borders, q);

  // Kept whole: every feature of Hoàng Sa and Trường Sa, and the airports.
  const keep: Item[] = [];
  for (const [, lat, lon, size] of [...HOANG_SA, ...TRUONG_SA]) {
    const [x, y] = mapPoint(lon, lat);
    const { n, r, s } = ISLAND[size];
    marker(x, y, n, r, s, rand, keep);
  }
  for (const code of new Set(DOMESTIC_ROUTES.flat())) {
    const a = airport(code);
    const [x, y] = mapPoint(a.lon, a.lat);
    marker(x, y, 3, 0.02, SIZE.airport, rand, keep, 0.02, 1);
  }

  // Thinned only if over budget: outline, province lines, routes.
  const rest: Item[] = [];
  const pts: Vec3[] = [];
  for (const l of coast) alongLine(l, OUTLINE_STEP, rand, pts, 3);
  pts.splice(0).forEach((p) => rest.push({ p, s: 1.1 }));
  for (const l of inner) alongLine(l, OUTLINE_STEP * 1.3, rand, pts);
  pts.splice(0).forEach((p) => rest.push({ p, s: 0.85 }));
  for (const [from, to] of DOMESTIC_ROUTES) domesticRoute(from, to, rand, rest);

  return take(rest, budget, rand, keep);
}

/* ------------------------------------------------------------------ */
/* Boarding pass — outline + dot-matrix print                          */
/* ------------------------------------------------------------------ */

const TICKET = { hw: 3.6, hh: 1.5, r: 0.3, notchX: 1.9, notchR: 0.32 };
const TICKET_PX = 200; // canvas px per unit

function ticketOutline(): Pt[] {
  const { hw, hh, r, notchX, notchR } = TICKET;
  const pts: Pt[] = [];
  const arc = (cx: number, cy: number, rad: number, a0: number, a1: number) => {
    for (let i = 0; i <= 24; i++) {
      const a = a0 + ((a1 - a0) * i) / 24;
      pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
    }
  };
  pts.push([-hw + r, hh], [notchX - notchR, hh]);
  arc(notchX, hh, notchR, Math.PI, TAU); // top notch dips into the ticket
  pts.push([hw - r, hh]);
  arc(hw - r, hh - r, r, Math.PI / 2, 0);
  pts.push([hw, -hh + r]);
  arc(hw - r, -hh + r, r, 0, -Math.PI / 2);
  pts.push([notchX + notchR, -hh]);
  arc(notchX, -hh, notchR, 0, Math.PI); // bottom notch
  pts.push([-hw + r, -hh]);
  arc(-hw + r, -hh + r, r, -Math.PI / 2, -Math.PI);
  pts.push([-hw, hh - r]);
  arc(-hw + r, hh - r, r, Math.PI, Math.PI / 2);
  return pts;
}

/** Renders the printed side of the pass; returns an alpha mask. */
function ticketInk(rand: Rand): { mask: Uint8Array; w: number; h: number } | null {
  const w = TICKET.hw * 2 * TICKET_PX;
  const h = TICKET.hh * 2 * TICKET_PX;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const font = (weight: number, px: number) => `${weight} ${px}px "Helvetica Neue", Arial, sans-serif`;
  const MAIN_R = 1045; // right edge of the main part (perforation at 1100)
  ctx.fillStyle = "#fff";
  // Every line is large and bold: it's printed in particles, a few dots per stroke.

  ctx.font = font(800, 68);
  ctx.fillText("BOARDING PASS", 56, 120);

  ctx.font = font(800, 184);
  ctx.fillText("HAN", 50, 334);
  ctx.textAlign = "right";
  ctx.fillText("SGN", MAIN_R, 334);
  // arrow centred in the gap between the codes
  const gapL = 50 + ctx.measureText("HAN").width;
  const gapR = MAIN_R - ctx.measureText("SGN").width;
  ctx.textAlign = "center";
  ctx.font = font(800, Math.min(150, (gapR - gapL) * 1.1));
  ctx.fillText("→", (gapL + gapR) / 2, 318);
  ctx.textAlign = "left";

  ctx.font = font(800, 86);
  ctx.fillText("VN 213", 54, 528);
  ctx.textAlign = "right";
  ctx.fillText("06:40", MAIN_R, 528);

  // stub: seat + barcode
  ctx.textAlign = "center";
  ctx.font = font(800, 120);
  ctx.fillText("14A", 1270, 200);
  let x = 1150;
  while (x < 1390) {
    const bw = 6 + Math.floor(rand() * 12);
    if (rand() > 0.28) ctx.fillRect(x, 262, bw, 258);
    x += bw + 8;
  }

  const data = ctx.getImageData(0, 0, w, h).data;
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < mask.length; i++) mask[i] = data[i * 4 + 3] > 128 ? 1 : 0;
  return { mask, w, h };
}

function ticket(budget: number, rand: Rand): Shape {
  const ink = ticketInk(rand);
  const outline = ticketOutline();
  const outlineLen = length(outline);
  const { notchX, hh, notchR } = TICKET;
  const perfLen = (hh - notchR - 0.06) * 2;

  const inkAt = (g: number, visit?: (x: number, y: number) => void) => {
    if (!ink) return 0;
    let n = 0;
    for (let y = g / 2; y < ink.h; y += g) {
      for (let x = g / 2; x < ink.w; x += g) {
        if (!ink.mask[Math.floor(y) * ink.w + Math.floor(x)]) continue;
        n++;
        visit?.(x, y);
      }
    }
    return n;
  };
  const total = (g: number) => inkAt(g) + (outlineLen + perfLen * 0.55) * (TICKET_PX / g);

  // Densest dot-matrix pitch that fits the budget, but never tighter than 5px:
  // finer than that and neighbouring particles merge into blobs.
  let g = 5;
  while (g < 16 && total(g) > budget) g += 0.25;
  const unit = g / TICKET_PX;

  const pts: Vec3[] = [];
  alongLine(outline, unit, rand, pts);
  for (let y = -(hh - notchR - 0.06); y <= hh - notchR - 0.06; y += unit) {
    if (((y + 10) * 5) % 1 < 0.55) pts.push([notchX, y, 0]); // dashed perforation
  }
  inkAt(g, (x, y) => pts.push([x / TICKET_PX - TICKET.hw, TICKET.hh - y / TICKET_PX, 0.02]));
  return take(
    pts.map((p) => ({ p, s: 1 })),
    budget,
    rand,
  );
}

/* ------------------------------------------------------------------ */
/* Globe — land all round, plus international routes out of Vietnam   */
/* ------------------------------------------------------------------ */

const GLOBE_ROUTE_STEP = 0.11;

function landMask(geo: GeoData): (lat: number, lon: number) => boolean {
  const { w, h, rle } = geo.land;
  const bits = new Uint8Array(w * h);
  rle.split("|").forEach((row, y) => {
    let x = 0;
    let v = 0;
    for (const r of row.split(",")) {
      const n = parseInt(r, 36);
      if (v) bits.fill(1, y * w + x, y * w + x + n);
      x += n;
      v ^= 1;
    }
  });
  return (lat, lon) => {
    const y = Math.min(h - 1, Math.floor(((90 - lat) / 180) * h));
    const x = ((Math.floor(((lon + 180) / 360) * w) % w) + w) % w;
    return bits[y * w + x] === 1;
  };
}

/** Model space: GLOBE_LON0 faces +Z (the camera), north is +Y. */
function latLon(lat: number, lon: number, r: number): Vec3 {
  const phi = lat * D2R;
  const th = (lon - GLOBE_LON0) * D2R;
  return [r * Math.cos(phi) * Math.sin(th), r * Math.sin(phi), r * Math.cos(phi) * Math.cos(th)];
}

/** A great-circle arc, lifted a little off the surface — a touch higher for longer flights. */
function greatCircle(from: [number, number], to: [number, number], rand: Rand, out: Item[]) {
  const a = new THREE.Vector3(...latLon(from[0], from[1], 1));
  const b = new THREE.Vector3(...latLon(to[0], to[1], 1));
  const ang = a.angleTo(b);
  if (ang < 1e-3) return;
  const lift = 0.025 + 0.08 * (ang / Math.PI); // kept low so long-hauls hug the globe instead of looping over it
  const n = Math.max(4, Math.round((ang * GLOBE_RADIUS * (1 + lift)) / GLOBE_ROUTE_STEP));
  const off = rand();
  const p = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const t = (i + off) / n;
    p.copy(a)
      .multiplyScalar(Math.sin((1 - t) * ang))
      .addScaledVector(b, Math.sin(t * ang))
      .divideScalar(Math.sin(ang))
      .multiplyScalar(GLOBE_RADIUS * (1 + lift * Math.sin(Math.PI * t)));
    out.push({ p: [p.x, p.y, p.z], s: SIZE.globeRoute, a: 1 });
  }
}

function globeMarker(lat: number, lon: number, n: number, s: number, rand: Rand, out: Item[]) {
  out.push({ p: latLon(lat, lon, GLOBE_RADIUS * 1.004), s, a: 1 });
  for (let k = 1; k < n; k++) {
    const a = (k / (n - 1)) * TAU + rand();
    out.push({ p: latLon(lat + Math.sin(a) * 0.9, lon + Math.cos(a) * 0.9, GLOBE_RADIUS * 1.004), s: s * 0.8, a: 1 });
  }
}

function globe(budget: number, rand: Rand, geo: GeoData): Shape {
  const extra: Item[] = [];
  for (const [from, , lat, lon] of INTERNATIONAL_ROUTES) greatCircle(GATEWAYS[from], [lat, lon], rand, extra);
  for (const [lat, lon] of Object.values(GATEWAYS)) globeMarker(lat, lon, 4, 0.8, rand, extra);
  const destinations = new Map(INTERNATIONAL_ROUTES.map(([, name, lat, lon]) => [name, [lat, lon] as const]));
  for (const [lat, lon] of destinations.values()) globeMarker(lat, lon, 3, 0.6, rand, extra);

  // Land everywhere, front and back; the back is drawn small by depth.
  const isLand = landMask(geo);
  const target = Math.max(0, budget - extra.length);
  const want = target * OVERSAMPLE;
  const cands: number[] = [];
  for (let guard = 0; cands.length < want * 3 && guard < want * 40; guard++) {
    const [x, y, z] = onSphere(rand, 1);
    const lat = Math.asin(y) / D2R;
    const lon = GLOBE_LON0 + Math.atan2(x, z) / D2R;
    if (!isLand(lat, lon > 180 ? lon - 360 : lon)) continue;
    cands.push(x * GLOBE_RADIUS, y * GLOBE_RADIUS, z * GLOBE_RADIUS);
  }
  const land = evenly(Float32Array.from(cands), target, rand);
  const items: Item[] = [];
  for (let i = 0; i < land.length; i += 3) items.push({ p: [land[i], land[i + 1], land[i + 2]], s: 1 });
  return toShape([...items, ...extra]);
}

/* ------------------------------------------------------------------ */
/* Company logo — printed from the logo image, on a gently bowed banner */
/* ------------------------------------------------------------------ */

/** RGBA pixels of the logo image (drawn into a canvas by Scene.tsx). */
export type LogoPixels = { w: number; h: number; data: Uint8ClampedArray };

/** Model-space width of the logo, and how far its ends curve back (reads as 3D as it sways). */
export const LOGO_W = 9;
const LOGO_BEND = 0.9;

function logo(budget: number, rand: Rand, px: LogoPixels | null): Shape & { color: Float32Array } {
  const empty = { pos: new Float32Array(0), size: new Float32Array(0), accent: new Float32Array(0), color: new Float32Array(0) };
  if (!px) return empty;
  const { w, h, data } = px;
  const at = (x: number, y: number) => (Math.floor(y) * w + Math.floor(x)) * 4;
  const inked = (x: number, y: number) => data[at(x, y) + 3] > 140;
  const countAt = (g: number) => {
    let n = 0;
    for (let y = g / 2; y < h; y += g) for (let x = g / 2; x < w; x += g) if (inked(x, y)) n++;
    return n;
  };
  // Densest dot-matrix pitch that fits the budget (never tighter than 3.5px).
  let g = 3.5;
  while (g < 14 && countAt(g) > budget) g += 0.25;

  const halfW = LOGO_W / 2;
  const items: Item[] = [];
  const color: number[] = [];
  for (let y = g / 2; y < h; y += g) {
    for (let x = g / 2; x < w; x += g) {
      if (!inked(x, y)) continue;
      const X = (x / w - 0.5) * LOGO_W;
      const Y = (0.5 - y / h) * LOGO_W * (h / w);
      items.push({ p: [X, Y, -LOGO_BEND * (X / halfW) ** 2 + (rand() - 0.5) * 0.04], s: 1 });
      const i = at(x, y);
      color.push(data[i] / 255, data[i + 1] / 255, data[i + 2] / 255);
    }
  }
  return { ...toShape(items), color: Float32Array.from(color) };
}

/* ------------------------------------------------------------------ */
/* Assembly                                                            */
/* ------------------------------------------------------------------ */

/** Morph slots, in scroll order. SKY is world space; the rest are model space. */
export const SLOT = { PLANE: 0, SKY: 1, MAP: 2, GLOBE: 3, TICKET: 4, LOGO: 5 } as const;

/**
 * The globe's extra turn about its axis while the map morphs into it; it
 * spins on to 0 (South-East Asia forward) as you keep scrolling.
 */
export const GLOBE_SPIN_FROM = -0.9;

/** Most particles each model may use (share of all); the rest stay behind as stars. */
const BUDGET = { plane: 0.62, map: 0.5, ticket: 0.95, globe: 0.78, logo: 0.95 };
/** Columns the side-by-side hand-over is organised in. */
const HANDOVER_COLUMNS = 28;

export type ParticleData = {
  count: number;
  /** One N×3 array per SLOT. Inactive particles' model positions are unused. */
  slots: Float32Array[];
  /** N×4: 1 if the particle belongs to plane, map, globe, ticket. */
  active: Float32Array;
  /**
   * N×4: size factor within plane, map, globe, ticket (islands by area, fine
   * route lines, the tail) — negative where it's drawn in the accent colour
   * (flight lines, airports). Packed to stay within the GPU's attribute limit.
   */
  shapeSize: Float32Array;
  /**
   * N×4 timings, 0 = first to move: x plane scatters bottom-to-top, y map
   * gathers bottom-to-top, z map→globe sweeps from the right, w globe→ticket
   * sweeps from the left.
   */
  order: Float32Array;
  /**
   * N×4 for the logo: x in the logo?, y ticket→logo timing (left first),
   * z size factor, w the logo's colour there packed as r·65536 + g·256 + b.
   */
  logo: Float32Array;
  /** N×4: rgb palette colour, a random 0..1. */
  colorRand: Float32Array;
};

/** Evenly picks k of the items, keeping their order. */
function spreadPick<T>(items: T[], k: number): T[] {
  if (k >= items.length) return items.slice();
  return Array.from({ length: k }, (_, j) => items[Math.floor(((j + 0.5) * items.length) / k)]);
}

/** Columns left to right, each read bottom to top — an order two shapes can share. */
function columnOrder<T>(items: T[], x: (t: T) => number, y: (t: T) => number): T[] {
  const byX = items.slice().sort((a, b) => x(a) - x(b));
  const out: T[] = [];
  for (let c = 0; c < HANDOVER_COLUMNS; c++) {
    const col = byX.slice(
      Math.floor((c * byX.length) / HANDOVER_COLUMNS),
      Math.floor(((c + 1) * byX.length) / HANDOVER_COLUMNS),
    );
    out.push(...col.sort((a, b) => y(a) - y(b)));
  }
  return out;
}

/** 0 for the leftmost item … 1 for the rightmost. */
function xQuantiles<T>(items: T[], x: (t: T) => number): Map<T, number> {
  const sorted = items.slice().sort((a, b) => x(a) - x(b));
  const q = new Map<T, number>();
  sorted.forEach((it, i) => q.set(it, sorted.length > 1 ? i / (sorted.length - 1) : 0.5));
  return q;
}

/** A particle build in two phases (see `startParticles`). */
export type ParticleBuild = {
  /** Filled in place: the loading screen draws from it straight away. */
  data: ParticleData;
  /**
   * Phase two: the plane, the map, the globe and the ticket — each paired
   * back from the logo so the side-by-side morphs line up. Writes into
   * `data` in place; reports progress 0..1 as it goes.
   */
  complete(geo: GeoData, onProgress?: (p: number) => void): Promise<void>;
};

const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Phase one, quick: the company logo and the sky — all the loading screen
 * needs. The logo is placed first on purpose: every other model is then
 * paired back from it, so it never has to change once it's on screen.
 */
export async function startParticles(count: number, logoPixels: LogoPixels | null): Promise<ParticleBuild> {
  const rand = mulberry32(20260929);
  const logoShape = logo(Math.round(count * BUDGET.logo), rand, logoPixels);
  const sky = deepSky(count, rand);
  await nextTask();

  const modelSlot = [SLOT.PLANE, SLOT.MAP, SLOT.GLOBE, SLOT.TICKET, SLOT.LOGO];
  const models: (Shape | null)[] = [null, null, null, null, logoShape];
  const slots: Float32Array[] = Array.from({ length: 6 }, () => new Float32Array(count * 3));
  slots[SLOT.SKY] = sky;
  const act = modelSlot.map(() => new Uint8Array(count));
  const size = modelSlot.map(() => new Float32Array(count).fill(1));
  const acc = modelSlot.map(() => new Float32Array(count));
  const logoColor = new Float32Array(count * 3);
  const timing = {
    planeUp: new Float32Array(count),
    mapUp: new Float32Array(count),
    mapGlobe: new Float32Array(count),
    globeTicket: new Float32Array(count),
    ticketLogo: new Float32Array(count),
  };

  /** Gives position k of model m to particle i. */
  const place = (m: number, k: number, i: number) => {
    const shape = models[m]!;
    slots[modelSlot[m]].set(shape.pos.subarray(k * 3, k * 3 + 3), i * 3);
    act[m][i] = 1;
    size[m][i] = shape.size[k];
    acc[m][i] = shape.accent[k];
    if (m === 4) logoColor.set(logoShape.color.subarray(k * 3, k * 3 + 3), i * 3);
  };
  const members = (m: number) => {
    const ids: number[] = [];
    for (let i = 0; i < count; i++) if (act[m][i]) ids.push(i);
    return ids;
  };
  /** A model's x, turned about its axis first (how the globe faces during a morph). */
  const xOf = (m: number, turn: number) => {
    const slot = slots[modelSlot[m]];
    const c = Math.cos(turn);
    const s = Math.sin(turn);
    return (i: number) => c * slot[i * 3] + s * slot[i * 3 + 2];
  };

  // The logo, on a random subset; it draws itself left to right while loading.
  const pick = shuffled(count, rand);
  for (let k = 0; k < logoShape.pos.length / 3; k++) place(4, k, pick[k]);
  const logoMembers = members(4);
  xQuantiles(logoMembers, xOf(4, 0)).forEach((q, i) => (timing.ticketLogo[i] = q));

  const colors = PALETTE.map(([hex, w]) => [hexToRgb(hex), w] as const);
  const colorRand = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    let w = rand();
    const c = colors.find(([, weight]) => (w -= weight) <= 0)?.[0] ?? colors[0][0];
    colorRand.set(c, i * 4);
    colorRand[i * 4 + 3] = rand();
  }

  const data: ParticleData = {
    count,
    slots,
    active: new Float32Array(count * 4),
    shapeSize: new Float32Array(count * 4),
    order: new Float32Array(count * 4),
    logo: new Float32Array(count * 4),
    colorRand,
  };
  /** Packs per-model data into the vec4 attributes, in place. */
  const pack = () => {
    for (let i = 0; i < count; i++) {
      for (let m = 0; m < 4; m++) {
        data.active[i * 4 + m] = act[m][i];
        data.shapeSize[i * 4 + m] = acc[m][i] ? -size[m][i] : size[m][i]; // negative = accent colour
      }
      data.order.set([timing.planeUp[i], timing.mapUp[i], timing.mapGlobe[i], timing.globeTicket[i]], i * 4);
      const [r, g, b] = [0, 1, 2].map((c) => Math.round(logoColor[i * 3 + c] * 255));
      data.logo.set([act[4][i], timing.ticketLogo[i], size[4][i], r * 65536 + g * 256 + b], i * 4);
    }
  };
  pack();

  /**
   * Model a hands its particles to model b side by side: both are read in
   * columns left to right (each column bottom to top) and matched in that
   * order, so a's right edge becomes b's right edge. Positions b needs
   * beyond that come in from the sky; particles a has spare leave for it.
   * `rightward`: the morph's leading side (the side facing the way it travels).
   */
  const handOver = (a: number, b: number, out: Float32Array, rightward: boolean, turnA = 0, turnB = 0) => {
    const from = members(a);
    const ax = xOf(a, turnA);
    const aSlot = slots[modelSlot[a]];
    const ay = (i: number) => aSlot[i * 3 + 1];
    const shape = models[b]!;
    const nB = shape.pos.length / 3;
    const c = Math.cos(turnB);
    const s = Math.sin(turnB);
    const bx = (k: number) => c * shape.pos[k * 3] + s * shape.pos[k * 3 + 2];
    const by = (k: number) => shape.pos[k * 3 + 1];
    const positions = Array.from({ length: nB }, (_, k) => k);

    const n = Math.min(from.length, nB);
    const aSel = columnOrder(spreadPick(from.slice().sort((i, j) => ax(i) - ax(j)), n), ax, ay);
    const bSel = columnOrder(spreadPick(positions.slice().sort((i, j) => bx(i) - bx(j)), n), bx, by);
    const owner = new Int32Array(nB).fill(-1);
    aSel.forEach((i, j) => (owner[bSel[j]] = i));
    const inA = new Set(from);
    const spare = Array.from(shuffled(count, rand)).filter((i) => !inA.has(i));
    for (let k = 0; k < nB; k++) if (owner[k] < 0) owner[k] = spare.pop()!;
    for (let k = 0; k < nB; k++) place(b, k, owner[k]);

    // Timing: a particle's side of the frame, in whichever shape it belongs to.
    const qa = xQuantiles(from, ax);
    const qb = xQuantiles(positions, bx);
    const posOf = new Map<number, number>();
    owner.forEach((i, k) => posOf.set(i, k));
    for (let i = 0; i < count; i++) {
      const q = qa.get(i) ?? (posOf.has(i) ? qb.get(posOf.get(i)!)! : 0.5);
      out[i] = rightward ? 1 - q : q;
    }
  };

  return {
    data,
    async complete(geo, onProgress = () => {}) {
      const done = async (p: number) => {
        onProgress(p);
        await nextTask();
      };
      models[0] = airplane(Math.round(count * BUDGET.plane), rand);
      await done(0.3);
      models[1] = vietnam(Math.round(count * BUDGET.map), rand, geo);
      await done(0.42);
      models[2] = globe(Math.round(count * BUDGET.globe), rand, geo);
      await done(0.56);
      models[3] = ticket(Math.round(count * BUDGET.ticket), rand);
      await done(0.82);

      // The plane meets the open sky, not a neighbour: a random subset.
      const planePick = shuffled(count, rand);
      for (let k = 0; k < Math.min(count, models[0].pos.length / 3); k++) place(0, k, planePick[k]);

      // Neighbours pair back from the logo. Timings say which side leads when
      // scrolling down: ticket → logo and globe → ticket from the left,
      // map → globe from the right.
      handOver(4, 3, timing.ticketLogo, false);
      handOver(3, 2, timing.globeTicket, false); // globe as it faces then (spin ≈ 0)
      handOver(2, 1, timing.mapGlobe, true, GLOBE_SPIN_FROM); // globe still turned

      // Bottom-to-top timings for the plane's scatter and the map's gather.
      ([
        [0, timing.planeUp],
        [1, timing.mapUp],
      ] as const).forEach(([m, out]) => {
        const slot = slots[modelSlot[m]];
        let lo = Infinity;
        let hi = -Infinity;
        for (let i = 0; i < count; i++) {
          if (!act[m][i]) continue;
          lo = Math.min(lo, slot[i * 3 + 1]);
          hi = Math.max(hi, slot[i * 3 + 1]);
        }
        for (let i = 0; i < count; i++) out[i] = Math.min(1, Math.max(0, (slot[i * 3 + 1] - lo) / (hi - lo)));
      });

      pack();
      onProgress(1);
    },
  };
}

/** A second, fainter and deeper sky behind everything (it only ever flies through). */
export function buildAmbient(count: number) {
  const rand = mulberry32(7);
  const pos = deepSky(count, rand, { far: 62, close: 5 });
  const colors = PALETTE.map(([hex]) => hexToRgb(hex));
  const colorRand = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    colorRand.set(colors[Math.floor(rand() * colors.length)], i * 4);
    colorRand[i * 4 + 3] = rand();
  }
  return { pos, colorRand };
}
