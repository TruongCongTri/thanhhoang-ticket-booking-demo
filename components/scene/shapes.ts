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
import {
  CLUSTER_CENTER,
  NEIGHBOURS,
  SPECTRAL,
  VIRGO,
  VIRGO_CLUSTER,
  VIRGO_LINES,
  depthFor,
  project,
  virgoOn,
  type CatalogStar,
} from "./virgo";

export type Rand = () => number;
type Vec3 = [number, number, number];
type Pt = [number, number];
/**
 * Colour classes a model can paint a particle in (else it keeps its palette
 * colour) — see colorOf in shaders.ts. aShapeSize carries class × 10 + size.
 */
export const TINT = {
  palette: 0,
  accent: 1, // the logo's yellow: flight lines and airports on the globe
  domestic: 2, // provinces with a domestic airport
  international: 3, // provinces with an international airport
  vietnam: 4, // Vietnam's border on the globe, in red
  ink: 5, // routes and airports over the map: pale on a dark page, navy on a light one
  muted: 6, // the province lines under the raised provinces
  coast: 7, // Vietnam's coastline on the map: a fine, steady hairline
  route: 8, // flight lines (map and globe): grey, with yellow pulses travelling them
  border: 9, // country borders on the globe
} as const;

/**
 * A particle's resting place in a model, its size relative to the model's
 * usual particle, its colour class (TINT) and — on the plane — the surface
 * normal there, which sizes it by how squarely the surface faces the viewer.
 */
type Item = { p: Vec3; s: number; t?: number; n?: Vec3 };
/** A model: N×3 positions, N size factors, N colour classes, N×3 surface normals (or none). */
export type Shape = { pos: Float32Array; size: Float32Array; tint: Float32Array; normal?: Float32Array };

/** Shape of components/scene/geo-data.json (built by scripts/build-geo.mjs). */
export type GeoData = {
  vietnam: {
    q: number;
    outline: number[][];
    borders: number[][];
    /** Provinces with airports: tier, airport codes, centroid and offset (degrees), scale, rings. */
    units: { n: string; t: "intl" | "dom"; a: string[]; c: number[]; o: number[]; k: number; r: number[][] }[];
  };
  land: { w: number; h: number; rle: string };
  /** Land height per 1° cell (see scripts/build-geo.mjs for the encoding). */
  elevation: { w: number; h: number; top: number; rows: string };
  /** Land borders between countries, delta-encoded in 1/q degree (see scripts/build-geo.mjs). */
  countries: { q: number; lines: number[][] };
};

const TAU = Math.PI * 2;
const D2R = Math.PI / 180;

/** Camera the star field and globe framing are laid out for (see Scene.tsx). */
export const CAMERA_Z = 14;
export const CAMERA_FOV = 35;

export const GLOBE_RADIUS = 4;
/**
 * The meridian and latitude facing the camera in the final pose: the western
 * Pacific, so Vietnam and South-East Asia sit on the left half of the disc,
 * China above, Korea and Japan upper right, and Australia lower right.
 */
const GLOBE_LON0 = 140;
export const GLOBE_FACING_LAT = 12;

/** Vivid, never grey (DESIGN.md). sRGB 0..1, written straight out by the shader. */
export const PALETTE: [string, number][] = [
  // the logo's colours: mostly its blue (lifted to glow on black), a spark of its yellow and orange
  ["#1f7fd8", 0.3],
  ["#4fa8ff", 0.22],
  ["#9fd0ff", 0.12],
  ["#0a64b8", 0.12],
  ["#f5a830", 0.16],
  ["#f07a30", 0.08],
];

/** Particle size factors for the finer details. */
const SIZE = { airport: 0.6 }; // flight-line dots are sized in the shader
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

export function hexToRgb(hex: string): Vec3 {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function shuffled(n: number, rand: Rand): Uint32Array {
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
  const tint = new Float32Array(items.length);
  const normal = items.some((it) => it.n) ? new Float32Array(items.length * 3) : undefined;
  items.forEach(({ p, s, t = TINT.palette, n }, i) => {
    pos.set(p, i * 3);
    size[i] = s;
    tint[i] = t;
    if (normal && n) normal.set(n, i * 3);
  });
  return { pos, size, tint, normal };
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
 * with neighbours roughly the same distance apart. With `metric` (the same
 * candidates in warped coordinates), "the same distance" is measured there,
 * which lets the spacing vary smoothly from place to place.
 */
export function evenly(cands: Float32Array, count: number, rand: Rand, metric: Float32Array = cands): Float32Array {
  const picked = evenlyPick(metric, count, rand);
  const out = new Float32Array(picked.length * 3);
  picked.forEach((c, i) => out.set(cands.subarray(c * 3, c * 3 + 3), i * 3));
  return out;
}

/** As `evenly`, but returns which candidates were kept (to carry other data along with them). */
function evenlyPick(cands: Float32Array, count: number, rand: Rand): number[] {
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
  return best.slice(0, Math.min(count, best.length));
}

const OVERSAMPLE = 4;

/* ------------------------------------------------------------------ */
/* Airliner — nose at +X, wings along Z, fin up +Y                     */
/* ------------------------------------------------------------------ */

/** Just the positions and normals (so parts with different extra attributes merge). */
function positionNormal(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const src = geo.index ? geo.toNonIndexed() : geo;
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", src.getAttribute("position"));
  out.setAttribute("normal", src.getAttribute("normal"));
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
export function airplane(target: number, rand: Rand): Shape {
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
  // so every particle sits on the outer skin. Each keeps the surface normal
  // where it sits: the shader sizes it by how squarely that faces the viewer.
  const SCALE = 0.72;
  type Hidden = (x: number, y: number, z: number) => boolean;
  /** For a rounded part: a point on its axis near p — normals must point away from it. */
  type Core = (p: THREE.Vector3) => [number, number, number];
  const sample = (parts: THREE.BufferGeometry[], n: number, s: number, hidden: Hidden, core?: Core): Item[] => {
    const merged = mergeGeometries(parts.map(positionNormal));
    const sampler = new MeshSurfaceSampler(new THREE.Mesh(merged)).build();
    const v = new THREE.Vector3();
    const nv = new THREE.Vector3();
    const cands: number[] = [];
    const normals: number[] = [];
    for (let guard = 0; cands.length < n * OVERSAMPLE * 3 && guard < n * OVERSAMPLE * 6; guard++) {
      sampler.sample(v, nv);
      if (hidden(v.x, v.y, v.z)) continue;
      if (core) {
        const [cx, cy, cz] = core(v);
        if (nv.x * (v.x - cx) + nv.y * (v.y - cy) + nv.z * (v.z - cz) < 0) nv.negate();
      }
      nv.normalize();
      cands.push(v.x * SCALE, v.y * SCALE, v.z * SCALE);
      normals.push(nv.x, nv.y, nv.z);
    }
    merged.dispose();
    const c = Float32Array.from(cands);
    return evenlyPick(c, n, rand).map((k) => ({
      p: [c[k * 3], c[k * 3 + 1], c[k * 3 + 2]] as Vec3,
      s,
      n: [normals[k * 3], normals[k * 3 + 1], normals[k * 3 + 2]] as Vec3,
    }));
  };
  const insideFuselage: Hidden = (x, y, z) => Math.hypot(y, z) < radiusAt(x) - 0.01;
  const fuselageCore: Core = (p) => [p.x, 0, 0];
  const humpCore: Core = (p) => [p.x, HUMP.y, 0];
  const engineCore: Core = (p) => {
    const z = [-2.9, -1.6, 1.6, 2.9].reduce((a, b) => (Math.abs(b - p.z) < Math.abs(a - p.z) ? b : a));
    return [p.x, -0.64 + Math.abs(z) * DIHEDRAL, z];
  };

  // The tail is thin and far away, so it's sampled on its own at about twice
  // the density, with slightly larger particles — otherwise it all but vanishes.
  const tailN = Math.round(target * 0.2);
  const humpN = Math.round(target * 0.1);
  const bodyN = Math.round((target - tailN - humpN) * 0.55);
  const engineN = Math.round((target - tailN - humpN - bodyN) * 0.22);
  const items = [
    ...sample([fuselage], bodyN, 1, inHump, fuselageCore),
    ...sample([hump], humpN, 1, insideFuselage, humpCore),
    ...sample([wing], target - tailN - humpN - bodyN - engineN, 1, insideFuselage),
    ...sample(engines, engineN, 1, insideFuselage, engineCore),
    ...sample([fin, stabilizer], tailN, 1.25, insideFuselage),
  ];
  [fuselage, hump, wing, stabilizer, fin, ...engines].forEach((p) => p.dispose());
  return toShape(items);
}

/* ------------------------------------------------------------------ */
/* Deep sky — WORLD space, a real volume in front of the camera        */
/* ------------------------------------------------------------------ */

/**
 * Distances from the camera the sky spans — about a hundred levels of depth,
 * from right in front of the viewer to 100 units out — and how far past the
 * frame's edges it reaches. The further out, the more stars (per unit of
 * depth, as the distance^1.5), so far away they crowd into a fine haze of
 * tiny points while only a few drift by up close. In 3D they keep an even
 * spacing that opens up only gently with distance (as its sixth root), so
 * any two neighbours stay roughly the same gap apart. Plus a few
 * `close` ones right in front of the viewer, the largest of all, kept to the
 * frame's edges (clear of the models and the copy).
 */
const SKY = { near: 1.2, far: 100, spreadX: 1.5, spreadY: 1.35, voids: 8, groups: 16, close: 6 };
/** Depth at which the spacing is "1" in the warped space the even spacing is measured in. */
const SKY_REF = 14;

export function deepSky(count: number, rand: Rand, { far = SKY.far, close = SKY.close } = {}): Float32Array {
  const T = Math.tan((CAMERA_FOV / 2) * D2R);
  const aspect = 1.9; // ≈ the widest common aspect ratio
  const lo = SKY.near ** 2.5;
  const hi = far ** 2.5;
  const distance = () => (lo + rand() * (hi - lo)) ** 0.4; // stars per unit of depth ∝ depth^1.5
  // Voids and groups are laid out along lines of sight (in screen units,
  // 1 = half the frame's height), so they read as dark gaps and denser star
  // systems on screen rather than being filled in by stars in front or behind.
  const spot = () => ({ u: (rand() * 2 - 1) * aspect * SKY.spreadX * 0.9, v: (rand() * 2 - 1) * SKY.spreadY * 0.9 });
  const voids = Array.from({ length: SKY.voids }, () => ({ ...spot(), r: 0.2 + rand() * 0.18 })); // "dark energy"
  const groups = Array.from({ length: SKY.groups }, () => ({ ...spot(), s: 0.14 + rand() * 0.16 }));

  const cands: number[] = [];
  const metric: number[] = [];
  for (let guard = 0; cands.length < count * 12 && guard < count * 500; guard++) {
    const d = distance();
    const u = (rand() * 2 - 1) * aspect * SKY.spreadX;
    const v = (rand() * 2 - 1) * SKY.spreadY;
    if (voids.some((o) => (u - o.u) ** 2 + (v - o.v) ** 2 < o.r * o.r)) continue;
    let density = 0.22;
    for (const g of groups) density += Math.exp(-((u - g.u) ** 2 + (v - g.v) ** 2) / (2 * g.s * g.s));
    if (rand() * 1.2 > density) continue;
    cands.push(u * d * T, v * d * T, CAMERA_Z - d);
    // Spacing measured in a space shrunk by (SKY_REF / d)^(1/6): gaps there
    // are even, so out here they grow with the sixth root of the distance.
    const w = (SKY_REF / d) ** (1 / 6);
    metric.push(u * d * T * w, v * d * T * w, d * w);
  }
  // Even spacing in 3D: within a group every star keeps its distance; between
  // groups, where candidates are scarce, the gaps open up.
  const out = new Float32Array(count * 3);
  out.set(evenly(Float32Array.from(cands), count - close, rand, Float32Array.from(metric)));

  // The close ones, spaced apart on screen (relaxed if it takes too long).
  const placed: { u: number; v: number }[] = [];
  for (let guard = 0; placed.length < close; guard++) {
    const u = (rand() * 2 - 1) * aspect * 0.95;
    const v = (rand() * 2 - 1) * 0.95;
    const strict = guard < 4000;
    if (Math.abs(v) < 0.55 && Math.abs(u) < 1.2) continue;
    if (strict && voids.some((o) => (u - o.u) ** 2 + (v - o.v) ** 2 < o.r * o.r)) continue;
    if (strict && placed.some((p) => (u - p.u) ** 2 + (v - p.v) ** 2 < 0.45 ** 2)) continue;
    const d = SKY.near + 0.2 + rand() ** 0.8 * 3;
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
function marker(x: number, y: number, n: number, r: number, s: number, rand: Rand, out: Item[], z = 0, tint: number = TINT.palette) {
  out.push({ p: [x, y, z], s, t: tint });
  for (let k = 1; k < n; k++) {
    const a = (k / (n - 1)) * TAU + rand();
    out.push({ p: [x + Math.cos(a) * r, y + Math.sin(a) * r, z], s: s * 0.8, t: tint });
  }
}

/**
 * One route, between two raised provinces' main airports: an arc that bows
 * out seaward (else north) and lifts a little toward the viewer, so the
 * network fans out over the East Sea as flight paths rather than more lines
 * on the provinces.
 */
/**
 * A flight-line dot carries which line it's on and how far along (0..1)
 * instead of a size; the shader sizes, colours and animates it from those
 * (a pulse travelling the line). Packed into the size slot's fraction:
 * (id · 512 + progress · 511) / 32768 — up to 64 lines per model.
 */
function routeDot(id: number, t: number): number {
  return (id * 512 + Math.round(Math.min(1, Math.max(0, t)) * 511)) / 32768;
}

function domesticRoute(from: Unit, to: Unit, rand: Rand, out: Item[], id: number) {
  const a = airport(from.a[0]);
  const b = airport(to.a[0]);
  const [ax, ay] = mapPoint(...placeIn(from, a.lon, a.lat));
  const [bx, by] = mapPoint(...placeIn(to, b.lon, b.lat));
  const [az, bz] = [LIFT[from.t] + 0.03, LIFT[to.t] + 0.03];
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
      p: [
        u * u * ax + 2 * u * t * cx + t * t * bx,
        u * u * ay + 2 * u * t * cy + t * t * by,
        az + (bz - az) * t + Math.sin(Math.PI * t) * len * 0.08,
      ],
      s: routeDot(id, t),
      t: TINT.route,
    });
  }
}

/**
 * The provinces with airports, raised above the map: how high each tier
 * hovers (model units), and how its particles are drawn.
 */
export const LIFT = { dom: 0.3, intl: 0.48 } as const;
const RAISED = {
  dom: { tint: TINT.domestic, edge: 1.15, fill: 0.62 },
  intl: { tint: TINT.international, edge: 1.3, fill: 0.7 },
} as const;
const FILL_STEP = 0.13; // model units between fill particles inside a raised province

type Unit = GeoData["vietnam"]["units"][number];

/** A raised province's placement: degrees in, degrees out (enlarged around its centre, then nudged apart). */
const placeIn = (u: Unit, lon: number, lat: number): Pt => [
  u.c[0] + (lon - u.c[0]) * u.k + u.o[0],
  u.c[1] + (lat - u.c[1]) * u.k + u.o[1],
];

function decodeRings(rings: number[][], q: number): Pt[][] {
  return rings.map((arr) => {
    const pts: Pt[] = [];
    let x = 0;
    let y = 0;
    for (let i = 0; i < arr.length; i += 2) {
      x += arr[i];
      y += arr[i + 1];
      pts.push([x / q, y / q]);
    }
    return pts;
  });
}

/** Even-odd: inside any of the rings (holes included). */
function inRings(rings: Pt[][], x: number, y: number): boolean {
  let inside = false;
  for (const r of rings) {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i];
      const [xj, yj] = r[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

/**
 * Vietnam, drawn flat — the coast and all 34 provinces in quiet tones — with
 * every province that has an airport raised above it, drawn larger and in
 * its own colour: blue for domestic airports, gold (larger, higher) for
 * international ones; neighbours spread apart so each stands clear. One
 * flight line joins each pair of provinces with flights between them.
 */
function vietnam(budget: number, rand: Rand, geo: GeoData): Shape {
  const { q, outline, borders, units } = geo.vietnam;
  // Offshore rings come from the archipelago list instead, sized by area.
  const offshore = (l: Pt[]) => l.every(([x]) => x / MAP_K + MAP_CX > 110);
  const coast = decodeLines(outline, q).filter((l) => !offshore(l));
  const inner = decodeLines(borders, q);

  // Kept whole: every feature of Hoàng Sa and Trường Sa, the raised
  // provinces' edges and their airports.
  const keep: Item[] = [];
  for (const [, lat, lon, size] of [...HOANG_SA, ...TRUONG_SA]) {
    const [x, y] = mapPoint(lon, lat);
    const { n, r, s } = ISLAND[size];
    marker(x, y, n, r, s, rand, keep);
  }

  // Thinned only if over budget: the base map, the raised provinces' fill, routes.
  const rest: Item[] = [];
  const pts: Vec3[] = [];
  // The coast: a fine, unbroken hairline (dimmed in the shader), never thinned.
  for (const l of coast) alongLine(l, OUTLINE_STEP * 0.6, rand, pts, 3);
  pts.splice(0).forEach((p) => keep.push({ p, s: 0.7, t: TINT.coast }));
  for (const l of inner) alongLine(l, OUTLINE_STEP * 1.3, rand, pts);
  pts.splice(0).forEach((p) => rest.push({ p, s: 0.65, t: TINT.muted }));

  const unitOf = new Map<string, Unit>();
  for (const u of units) {
    const look = RAISED[u.t];
    const z = LIFT[u.t];
    const rings = decodeRings(u.r, q);
    // The edge, raised and enlarged…
    for (const ring of rings) {
      alongLine(
        ring.map(([lon, lat]) => mapPoint(...placeIn(u, lon, lat))),
        OUTLINE_STEP * 0.8,
        rand,
        pts,
        3,
      );
    }
    pts.splice(0).forEach(([x, y]) => keep.push({ p: [x, y, z], s: look.edge, t: look.tint }));
    // …filled with a light grid, so it reads as a solid tile floating over the map.
    const placed = rings.map((r) => r.map(([lon, lat]) => mapPoint(...placeIn(u, lon, lat))));
    const xs = placed.flat().map((p) => p[0]);
    const ys = placed.flat().map((p) => p[1]);
    const jitter = () => (rand() - 0.5) * FILL_STEP * 0.3;
    for (let y = Math.min(...ys) + FILL_STEP / 2; y < Math.max(...ys); y += FILL_STEP) {
      for (let x = Math.min(...xs) + FILL_STEP / 2; x < Math.max(...xs); x += FILL_STEP) {
        if (inRings(placed, x, y)) rest.push({ p: [x + jitter(), y + jitter(), z], s: look.fill, t: look.tint });
      }
    }
    // Its airports, on top.
    for (const code of u.a) {
      unitOf.set(code, u);
      const a = airport(code);
      const [x, y] = mapPoint(...placeIn(u, a.lon, a.lat));
      marker(x, y, 4, 0.03, SIZE.airport * 1.5, rand, keep, z + 0.03, TINT.ink);
    }
  }

  // One line per pair of provinces (Hà Nội – TP. Hồ Chí Minh once, whichever
  // airports the flights use), between their main airports.
  const seen = new Set<string>();
  for (const [from, to] of DOMESTIC_ROUTES) {
    const ua = unitOf.get(from);
    const ub = unitOf.get(to);
    if (!ua || !ub || ua === ub) continue;
    const key = [ua.n, ub.n].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    domesticRoute(ua, ub, rand, rest, seen.size);
  }

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

export function landMask(geo: GeoData): (lat: number, lon: number) => boolean {
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

/**
 * How far Vietnam's border floats over the globe, as a share of its radius —
 * the same height on screen as the international provinces over the map
 * (LIFT.intl at the map's desktop scale, 1.22, over the globe's, 1.34).
 */
export const GLOBE_VN_LIFT = (LIFT.intl * 1.22) / 1.34 / GLOBE_RADIUS;

/**
 * A great-circle arc from radius r0 to r1 (shares of the globe's), lifted a
 * little off the surface between — a touch higher for longer flights.
 */
function greatCircle(from: readonly [number, number], to: readonly [number, number], rand: Rand, out: Item[], id: number, r0 = 1, r1 = 1) {
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
      .multiplyScalar(GLOBE_RADIUS * (r0 + (r1 - r0) * t + lift * Math.sin(Math.PI * t)));
    out.push({ p: [p.x, p.y, p.z], s: routeDot(id, t), t: TINT.route });
  }
}

function globeMarker(lat: number, lon: number, n: number, s: number, rand: Rand, out: Item[], r = 1.004) {
  out.push({ p: latLon(lat, lon, GLOBE_RADIUS * r), s, t: TINT.accent });
  for (let k = 1; k < n; k++) {
    const a = (k / (n - 1)) * TAU + rand();
    out.push({ p: latLon(lat + Math.sin(a) * 0.9, lon + Math.cos(a) * 0.9, GLOBE_RADIUS * r), s: s * 0.8, t: TINT.accent });
  }
}

/** Land height in metres at any point, from the 1° grid (bilinear); 0 over the sea. */
function elevation(geo: GeoData): (lat: number, lon: number) => number {
  const { w, h, top, rows } = geo.elevation;
  const LEVELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const grid = new Float32Array(w * h);
  rows.split("|").forEach((row, y) => {
    let x = 0;
    for (let i = 0; i < row.length; i++) {
      if (row[i] === ".") {
        const end = row.indexOf(".", i + 1);
        x += parseInt(row.slice(i + 1, end), 36);
        i = end;
      } else {
        const level = LEVELS.indexOf(row[i]) / 61;
        grid[y * w + x++] = level * level * top;
      }
    }
  });
  const at = (x: number, y: number) => grid[Math.min(h - 1, Math.max(0, y)) * w + (((x % w) + w) % w)];
  return (lat, lon) => {
    const fx = lon + 180 - 0.5;
    const fy = 90 - lat - 0.5;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;
    const top0 = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx;
    const bottom = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx;
    return top0 * (1 - ty) + bottom * ty;
  };
}

/** The terrain in particle sizes: the higher the land, the larger its particles; the coast the smallest. */
const terrainSize = (metres: number) => 0.42 + 1.5 * Math.min(1, Math.max(0, metres) / 5000) ** 0.6;
/** Relief: land rises off the sphere with its height (exaggerated, so the ranges stand out in 3D). */
const reliefAt = (metres: number) => 1 + 0.04 * Math.min(1, Math.max(0, metres) / 5000) ** 0.7;

function globe(budget: number, rand: Rand, geo: GeoData): Shape {
  const extra: Item[] = [];
  const vnR = 1 + GLOBE_VN_LIFT;

  // Vietnam's border — coast and land borders, both archipelagos too —
  // floating above the globe in red.
  const { q, outline } = geo.vietnam;
  for (const line of decodeRings(outline, q)) {
    const along: Vec3[] = [];
    alongLine(line, 0.3, rand, along, 2);
    for (const [lon, lat] of along) extra.push({ p: latLon(lat, lon, GLOBE_RADIUS * vnR), s: 0.62, t: TINT.vietnam });
  }

  // One line to each destination, from the gateway that serves it (or the
  // first that does), rising off Vietnam's raised border.
  const served = new Map<string, { from: string; at: [number, number] }>();
  for (const [from, name, lat, lon] of INTERNATIONAL_ROUTES) if (!served.has(name)) served.set(name, { from, at: [lat, lon] });
  [...served.values()].forEach(({ from, at }, id) => greatCircle(GATEWAYS[from], at, rand, extra, id, vnR, 1.004));
  for (const code of new Set([...served.values()].map((s) => s.from))) {
    const [lat, lon] = GATEWAYS[code];
    globeMarker(lat, lon, 4, 0.85, rand, extra, vnR);
  }
  for (const { at } of served.values()) globeMarker(at[0], at[1], 3, 0.6, rand, extra);

  // Land in two layers, so the continents read: their coastlines, traced
  // as a fine continuous edge, and the land inside, each particle sized by
  // the height of the land under it. The side that faces the viewer while
  // the globe is on screen (it turns from 52° east of its rest to rest) gets
  // most of the particles; the far side, drawn small by depth anyway, few.
  const isLand = landMask(geo);
  const heightAt = elevation(geo);
  const lonOf = (x: number, z: number) => {
    const lon = GLOBE_LON0 + Math.atan2(x, z) / D2R;
    return lon > 180 ? lon - 360 : lon;
  };
  const seaNear = (lat: number, lon: number) =>
    !isLand(lat + 0.7, lon) || !isLand(lat - 0.7, lon) || !isLand(lat, lon + 0.7) || !isLand(lat, lon - 0.7);
  const front = new THREE.Vector3(...latLon(GLOBE_FACING_LAT, GLOBE_LON0 + 26, 1));
  const target = Math.max(0, budget - extra.length);
  const coastN = Math.round(target * 0.3);
  const bordersN = Math.round(target * 0.18);
  const want = target * OVERSAMPLE;
  const coast: number[] = [];
  const inland: number[] = [];
  for (let guard = 0; coast.length + inland.length < want * 3 && guard < want * 60; guard++) {
    const [x, y, z] = onSphere(rand, 1);
    if (x * front.x + y * front.y + z * front.z < -0.2 && rand() > 0.3) continue; // the far side, thinly
    const lat = Math.asin(y) / D2R;
    const lon = lonOf(x, z);
    if (!isLand(lat, lon)) continue;
    (seaNear(lat, lon) ? coast : inland).push(x * GLOBE_RADIUS, y * GLOBE_RADIUS, z * GLOBE_RADIUS);
  }
  const items: Item[] = [];
  /** A land point, lifted by its relief and sized by its height. */
  const landItem = (x: number, y: number, z: number, s?: number): Item => {
    const h = heightAt(Math.asin(y / GLOBE_RADIUS) / D2R, lonOf(x, z));
    const k = reliefAt(h);
    return { p: [x * k, y * k, z * k], s: s ?? terrainSize(h) };
  };

  // Country borders: fine dotted lines in their own colour, on the side
  // that faces the viewer (thinned if there's more than their share).
  const borders: Item[] = [];
  for (const line of decodeRings(geo.countries.lines, geo.countries.q)) {
    const along: Vec3[] = [];
    alongLine(line, 0.4, rand, along);
    for (const [lon, lat] of along) {
      const [x, y, z] = latLon(lat, lon, GLOBE_RADIUS);
      if ((x * front.x + y * front.y + z * front.z) / GLOBE_RADIUS < -0.1) continue;
      const it = landItem(x, y, z, 0.5);
      it.p = [it.p[0] * 1.003, it.p[1] * 1.003, it.p[2] * 1.003];
      borders.push({ ...it, t: TINT.border });
    }
  }
  const borderShape = take(borders, bordersN, rand);
  for (let i = 0; i < borderShape.size.length; i++) {
    items.push({ p: [borderShape.pos[i * 3], borderShape.pos[i * 3 + 1], borderShape.pos[i * 3 + 2]], s: 0.62, t: TINT.border });
  }

  const edge = evenly(Float32Array.from(coast), coastN, rand);
  for (let i = 0; i < edge.length; i += 3) items.push(landItem(edge[i], edge[i + 1], edge[i + 2], 0.78));
  const land = evenly(Float32Array.from(inland), target - edge.length / 3 - borderShape.size.length, rand);
  for (let i = 0; i < land.length; i += 3) items.push(landItem(land[i], land[i + 1], land[i + 2]));
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

export function logo(budget: number, rand: Rand, px: LogoPixels | null): Shape & { color: Float32Array } {
  const empty = { pos: new Float32Array(0), size: new Float32Array(0), tint: new Float32Array(0), color: new Float32Array(0) };
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
const BUDGET = { plane: 0.62, map: 0.5, ticket: 0.95, globe: 0.9, logo: 0.95 };
/** Columns the side-by-side hand-over is organised in. */
const HANDOVER_COLUMNS = 28;

export type ParticleData = {
  count: number;
  /** One N×3 array per SLOT. Inactive particles' model positions are unused. */
  slots: Float32Array[];
  /** N×4: 1 if the particle belongs to plane, map, globe, ticket. */
  active: Float32Array;
  /**
   * N×4: within plane, map, globe, ticket: colour class (TINT) × 10 + size
   * factor (islands by area, fine route lines, the tail, the terrain).
   * Packed to stay within the GPU's attribute limit.
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
  /** N×3: the plane's surface normal at each of its particles (model space). */
  normal: Float32Array;
};

/** Evenly picks k of the items, keeping their order. */
export function spreadPick<T>(items: T[], k: number): T[] {
  if (k >= items.length) return items.slice();
  return Array.from({ length: k }, (_, j) => items[Math.floor(((j + 0.5) * items.length) / k)]);
}

/** Columns left to right, each read bottom to top — an order two shapes can share. */
export function columnOrder<T>(items: T[], x: (t: T) => number, y: (t: T) => number): T[] {
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
export function xQuantiles<T>(items: T[], x: (t: T) => number): Map<T, number> {
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
  const tint = modelSlot.map(() => new Float32Array(count));
  const normal = new Float32Array(count * 3);
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
    tint[m][i] = shape.tint[k];
    if (shape.normal) normal.set(shape.normal.subarray(k * 3, k * 3 + 3), i * 3);
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
    normal,
    order: new Float32Array(count * 4),
    logo: new Float32Array(count * 4),
    colorRand,
  };
  /** Packs per-model data into the vec4 attributes, in place. */
  const pack = () => {
    for (let i = 0; i < count; i++) {
      for (let m = 0; m < 4; m++) {
        data.active[i * 4 + m] = act[m][i];
        data.shapeSize[i * 4 + m] = tint[m][i] * 10 + size[m][i]; // colour class × 10 + size
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

/** What each background particle is (aStar.x in the sky shader). */
export const STAR = { field: 0, virgo: 1, line: 2, neighbour: 3, galaxy: 4 } as const;

/**
 * The background, behind everything: a second deep field of stars (fainter,
 * flying through with the open sky), and — fixed, as if infinitely far —
 * the constellation Virgo with its figure, the bright stars around it and
 * the galaxies of the Virgo Cluster beyond.
 */
export function buildAmbient(fieldCount: number) {
  const rand = mulberry32(7);
  const palette = PALETTE.map(([hex]) => hexToRgb(hex));
  type Entry = { p: Vec3; c: Vec3; star: [number, number, number, number] };
  const entries: Entry[] = [];

  // The deep field: world space, 100 units deep, streaming by in the fly-through.
  const field = deepSky(fieldCount, rand, { close: 4 });
  for (let i = 0; i < fieldCount; i++) {
    entries.push({
      p: [field[i * 3], field[i * 3 + 1], field[i * 3 + 2]],
      c: palette[Math.floor(rand() * palette.length)],
      star: [STAR.field, 0, 1, 0],
    });
  }

  // Virgo and the sky around it, where they really are: positions in sky
  // tangent units plus a depth (the scene fits them to the screen; see virgoFit).
  const magSize = (mag: number) => Math.min(2.6, Math.max(0.7, 2.5 - 0.38 * mag));
  const at = (s: CatalogStar): Vec3 => [...project(s.ra, s.dec), depthFor(s.ly)];
  const pts = VIRGO.map(at);
  VIRGO.forEach((s, i) =>
    entries.push({ p: pts[i], c: hexToRgb(SPECTRAL[s.type]), star: [STAR.virgo, virgoOn(i), magSize(s.mag) * 1.5, 0] }),
  );

  // The stick figure, as fine dotted lines that draw themselves from one star
  // to the next as the sequence reaches it.
  const LINE_STEP = 0.012; // sky tangent units between dots
  const LINE_GAP = 0.02; // left clear around each star
  const lineColor = hexToRgb("#cfe3ff");
  for (const [a, b] of VIRGO_LINES) {
    const [early, late] = virgoOn(a) < virgoOn(b) ? [a, b] : [b, a];
    const pa = pts[early];
    const pb = pts[late];
    const len = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
    const draw = Math.min(1.1, virgoOn(late) - virgoOn(early)); // seconds the line takes to draw
    const n = Math.max(2, Math.round((len - 2 * LINE_GAP) / LINE_STEP));
    for (let k = 0; k <= n; k++) {
      const s = (LINE_GAP + (k / n) * (len - 2 * LINE_GAP)) / len;
      entries.push({
        p: [pa[0] + (pb[0] - pa[0]) * s, pa[1] + (pb[1] - pa[1]) * s, pa[2] + (pb[2] - pa[2]) * s],
        c: lineColor,
        star: [STAR.line, virgoOn(late) - draw + s * draw, 0.32, 0],
      });
    }
  }

  for (const s of NEIGHBOURS) entries.push({ p: at(s), c: hexToRgb(SPECTRAL[s.type]), star: [STAR.neighbour, 0, magSize(s.mag) * 1.15, 0] });

  // The Virgo Cluster, far beyond the stars: its Messier galaxies, and fainter
  // members scattered about them — soft specks of warm and cool white.
  const galaxyTints = [hexToRgb("#ffe9c8"), hexToRgb("#d6e4ff")];
  const galaxy = (ra: number, dec: number, size: number) =>
    entries.push({
      p: [...project(ra, dec), 86 + rand() * 13],
      c: galaxyTints[Math.floor(rand() * 2)],
      star: [STAR.galaxy, 0, size, 0],
    });
  for (const [ra, dec] of VIRGO_CLUSTER) galaxy(ra, dec, 1.5);
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
  for (let i = 0; i < 50; i++) galaxy(CLUSTER_CENTER[0] + gauss() * 2.6, CLUSTER_CENTER[1] + gauss() * 2.4, 0.9 + rand() * 0.5);

  const n = entries.length;
  const pos = new Float32Array(n * 3);
  const colorRand = new Float32Array(n * 4);
  const star = new Float32Array(n * 4);
  entries.forEach((e, i) => {
    pos.set(e.p, i * 3);
    colorRand.set(e.c, i * 4);
    colorRand[i * 4 + 3] = rand();
    star.set(e.star, i * 4);
  });
  return { pos, colorRand, star };
}
