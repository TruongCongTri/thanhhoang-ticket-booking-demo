/**
 * Builds components/scene/geo-data.json — the compact map data the particle
 * scene samples from. Run once after changing sources:
 *
 *   node scripts/build-geo.mjs
 *
 * Sources
 * - Vietnam provinces: geoBoundaries VNM ADM1 (public domain), which includes
 *   Hoàng Sa (under Đà Nẵng) and Trường Sa (under Khánh Hòa). The 63 former
 *   provinces are merged into the 34 provincial units in force since
 *   1 July 2025 (Resolution 202/2025/QH15).
 * - World land: Natural Earth 1:50m via world-atlas (public domain).
 * - Land elevation: NOAA ETOPO5 (public domain), downloaded on first run.
 * - Country borders: Natural Earth 1:50m via world-atlas (public domain).
 * - Airports: lib/flights.ts.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { feature, merge, mesh } from "topojson-client";
import { geoEquirectangular, geoPath } from "d3-geo";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));

/* ------------------------------------------------------------------ */
/* Vietnam: outline + borders between the 34 provincial units          */
/* ------------------------------------------------------------------ */

const norm = (s) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[–-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// former province -> unit since 2025-07-01 (unlisted names map to themselves)
const MERGED = {
  "kien giang": "an giang",
  "ba ria vung tau": "ho chi minh",
  "binh duong": "ho chi minh",
  "con dao": "ho chi minh",
  "bac giang": "bac ninh",
  "bac kan": "thai nguyen",
  "bac lieu": "ca mau",
  "ben tre": "vinh long",
  "tra vinh": "vinh long",
  "binh dinh": "gia lai",
  "binh phuoc": "dong nai",
  "binh thuan": "lam dong",
  "dak nong": "lam dong",
  "soc trang": "can tho",
  "hau giang": "can tho",
  "quang nam": "da nang",
  "phu yen": "dak lak",
  "tien giang": "dong thap",
  "ha giang": "tuyen quang",
  "ha nam": "ninh binh",
  "nam dinh": "ninh binh",
  "hai duong": "hai phong",
  "hoa binh": "phu tho",
  "vinh phuc": "phu tho",
  "thai binh": "hung yen",
  "ninh thuan": "khanh hoa",
  "kon tum": "quang ngai",
  "yen bai": "lao cai",
  "long an": "tay ninh",
  "quang binh": "quang tri",
  "thua thien hue": "hue",
};

const vn = read("scripts/data/vnm-adm1.topojson");
const vnObj = vn.objects[Object.keys(vn.objects)[0]];
const unit = (g) => {
  const n = norm(g.properties.shapeName);
  return MERGED[n] ?? n;
};
const units = new Set(vnObj.geometries.map(unit));
if (units.size !== 34) throw new Error(`expected 34 provincial units, got ${units.size}: ${[...units].join(", ")}`);

const outline = mesh(vn, vnObj, (a, b) => a === b).coordinates;
const borders = mesh(vn, vnObj, (a, b) => a !== b && unit(a) !== unit(b)).coordinates;

/** Douglas–Peucker in degrees; closed rings are split at their farthest point first. */
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const [fx, fy] = pts[0];
  const [lx, ly] = pts[pts.length - 1];
  if (fx === lx && fy === ly) {
    let k = 1;
    let far = -1;
    pts.forEach(([x, y], i) => {
      const d = Math.hypot(x - fx, y - fy);
      if (d > far) {
        far = d;
        k = i;
      }
    });
    return [...simplifyOpen(pts.slice(0, k + 1), tol).slice(0, -1), ...simplifyOpen(pts.slice(k), tol)];
  }
  return simplifyOpen(pts, tol);
}

function simplifyOpen(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a];
    const [bx, by] = pts[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1e-12;
    let best = -1;
    let bi = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / len;
      if (d > best) {
        best = d;
        bi = i;
      }
    }
    if (best > tol) {
      keep[bi] = 1;
      stack.push([a, bi], [bi, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

const Q = 200; // 1/200 degree
/** [x0, y0, dx1, dy1, ...] in 1/Q degree — small ints keep the JSON tiny. */
function encode(lines) {
  return lines.map((line) => {
    const s = simplify(line, 0.006);
    const out = [];
    let px = 0;
    let py = 0;
    for (const [lon, lat] of s) {
      const x = Math.round(lon * Q);
      const y = Math.round(lat * Q);
      if (out.length && x === px && y === py) continue;
      out.push(x - px, y - py);
      px = x;
      py = y;
    }
    return out;
  });
}

/* ------------------------------------------------------------------ */
/* Provinces with airports: their shapes, enlarged and spread apart    */
/* ------------------------------------------------------------------ */

// Vietnam's airports, read from lib/flights.ts (`gateway` = international too).
const flightsSrc = fs.readFileSync(path.join(root, "lib/flights.ts"), "utf8");
const airports = [...flightsSrc.matchAll(/\{ code: "(\w{3})"[^}]*?lat: (-?[\d.]+), lon: (-?[\d.]+)([^}]*)\}/g)]
  .map(([, code, lat, lon, rest]) => ({ code, lat: +lat, lon: +lon, foreign: /intl: true/.test(rest), gateway: /gateway: true/.test(rest) }))
  .filter((a) => !a.foreign);
if (airports.length < 20) throw new Error(`expected Vietnam's airports in lib/flights.ts, found ${airports.length}`);

/** Planar (lon, lat) helpers. */
const ringArea = (r) => {
  let s = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]);
  return s / 2;
};
const ringCentroid = (r) => {
  let a = 0;
  let x = 0;
  let y = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const f = r[j][0] * r[i][1] - r[i][0] * r[j][1];
    a += f;
    x += (r[j][0] + r[i][0]) * f;
    y += (r[j][1] + r[i][1]) * f;
  }
  return [x / (3 * a), y / (3 * a)];
};
/** Even-odd: inside any of the rings (holes included). */
const inRings = (rings, x, y) => {
  let inside = false;
  for (const r of rings) {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i];
      const [xj, yj] = r[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
};

const unitGeoms = new Map();
for (const g of vnObj.geometries) {
  const u = unit(g);
  if (!unitGeoms.has(u)) unitGeoms.set(u, []);
  unitGeoms.get(u).push(g);
}

/**
 * Each unit with an airport: its main landmass plus islands close by (Phú
 * Quốc, Cát Bà, Hạ Long Bay…) — but not the far archipelagos, which the map
 * draws on their own.
 */
/** Airports the coarse boundaries put across a border (Nội Bài is in Hà Nội, a few km from Phú Thọ). */
const AIRPORT_UNIT = { HAN: "ha noi" };
const lifted = [];
for (const [name, geoms] of unitGeoms) {
  const polys = merge(vn, geoms).coordinates; // [polygon][ring][point]
  const sized = polys.map((p) => ({ p, area: Math.abs(ringArea(p[0])), c: ringCentroid(p[0]) }));
  const main = sized.reduce((a, b) => (b.area > a.area ? b : a));
  const kept = sized.filter((s) => s.area >= main.area * 0.004 && Math.hypot(s.c[0] - main.c[0], s.c[1] - main.c[1]) <= 1.6);
  const rings = kept.flatMap((s) => s.p);
  const codes = airports
    .filter((a) => (AIRPORT_UNIT[a.code] ? AIRPORT_UNIT[a.code] === name : inRings(polys.flat(), a.lon, a.lat)))
    .map((a) => a.code);
  if (!codes.length) continue;
  const area = kept.reduce((s, k) => s + k.area, 0);
  const c = [
    kept.reduce((s, k) => s + k.c[0] * k.area, 0) / area,
    kept.reduce((s, k) => s + k.c[1] * k.area, 0) / area,
  ];
  const tier = codes.some((code) => airports.find((a) => a.code === code).gateway) ? "intl" : "dom";
  lifted.push({ name, tier, codes, rings, area, c, o: [0, 0] });
}
const missing = airports.filter((a) => !lifted.some((u) => u.codes.includes(a.code)));
if (missing.length) throw new Error(`airports outside every province: ${missing.map((a) => a.code).join(", ")}`);

/**
 * Raised above the map, each of these provinces is drawn larger — those with
 * an international airport more so — then neighbours are nudged apart along
 * the line between them until a clear gap separates every pair.
 */
const SCALE = { intl: 1.12, dom: 1.06 };
const GAP = 0.07; // degrees
const samplesOf = (rings) => {
  const out = [];
  for (const r of rings) {
    for (let i = 1; i < r.length; i++) {
      const [ax, ay] = r[i - 1];
      const [bx, by] = r[i];
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 0.04));
      for (let k = 0; k < n; k++) out.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
    }
  }
  return out;
};
for (const u of lifted) {
  u.k = SCALE[u.tier];
  u.simple = u.rings.map((r) => simplify(r, 0.012));
  u.base = samplesOf(u.simple);
}
const place = (u, [x, y]) => [u.c[0] + (x - u.c[0]) * u.k + u.o[0], u.c[1] + (y - u.c[1]) * u.k + u.o[1]];
const unplace = (u, [x, y]) => [u.c[0] + (x - u.c[0] - u.o[0]) / u.k, u.c[1] + (y - u.c[1] - u.o[1]) / u.k];
const bboxOf = (pts) => {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of pts) [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
  return [x0, y0, x1, y1];
};
let rounds = 0;
for (; rounds < 400; rounds++) {
  for (const u of lifted) {
    u.pts = u.base.map((p) => place(u, p));
    u.box = bboxOf(u.pts);
  }
  let moved = false;
  for (let i = 0; i < lifted.length; i++) {
    for (let j = i + 1; j < lifted.length; j++) {
      const a = lifted[i];
      const b = lifted[j];
      if (a.box[0] > b.box[2] + GAP || b.box[0] > a.box[2] + GAP || a.box[1] > b.box[3] + GAP || b.box[1] > a.box[3] + GAP) continue;
      let overlap = a.pts.some((p) => inRings(b.simple, ...unplace(b, p))) || b.pts.some((p) => inRings(a.simple, ...unplace(a, p)));
      if (!overlap) {
        let d2 = Infinity;
        for (const [ax, ay] of a.pts) for (const [bx, by] of b.pts) d2 = Math.min(d2, (ax - bx) ** 2 + (ay - by) ** 2);
        overlap = d2 < GAP * GAP;
      }
      if (!overlap) continue;
      const dx = a.c[0] + a.o[0] - (b.c[0] + b.o[0]);
      const dy = a.c[1] + a.o[1] - (b.c[1] + b.o[1]);
      const len = Math.hypot(dx, dy) || 1;
      const step = 0.01;
      // the smaller province gives way more
      const wa = b.area / (a.area + b.area);
      a.o[0] += (dx / len) * step * wa;
      a.o[1] += (dy / len) * step * wa;
      b.o[0] -= (dx / len) * step * (1 - wa);
      b.o[1] -= (dy / len) * step * (1 - wa);
      moved = true;
    }
  }
  if (!moved) break;
}
const r3 = (v) => Math.round(v * 1000) / 1000;
const unitsData = lifted.map((u) => ({
  n: u.name,
  t: u.tier,
  a: u.codes,
  c: u.c.map(r3),
  o: u.o.map(r3),
  k: u.k,
  r: encode(u.simple),
}));

const vnData = { q: Q, outline: encode(outline), borders: encode(borders), units: unitsData };

/* ------------------------------------------------------------------ */
/* Country borders for the globe (land borders only, not coasts)       */
/* ------------------------------------------------------------------ */

const countries = read("node_modules/world-atlas/countries-50m.json");
const countryBorders = mesh(countries, countries.objects.countries, (a, b) => a !== b).coordinates;
// coarser than Vietnam's: the globe draws them as fine dotted lines
const QW = 20; // 1/20 degree
const encodeWorld = (lines) =>
  lines
    .map((line) => {
      const pts = simplify(line, 0.08);
      const out = [];
      let px = 0;
      let py = 0;
      for (const [lon, lat] of pts) {
        const x = Math.round(lon * QW);
        const y = Math.round(lat * QW);
        if (out.length && x === px && y === py) continue;
        out.push(x - px, y - py);
        px = x;
        py = y;
      }
      return out;
    })
    .filter((l) => l.length >= 4);
const worldBorders = { q: QW, lines: encodeWorld(countryBorders) };

/* ------------------------------------------------------------------ */
/* World land mask, 0.5° equirectangular, run-length encoded            */
/* ------------------------------------------------------------------ */

const W = 720;
const H = 360;
const land = read("node_modules/world-atlas/land-50m.json");
const landGeo = feature(land, land.objects.land);
const projection = geoEquirectangular()
  .scale(W / (2 * Math.PI))
  .translate([W / 2, H / 2])
  .precision(0.1);

// Record projected rings (d3 cuts them at the antimeridian and closes polar caps).
const rings = [];
let current = null;
geoPath(projection, {
  moveTo(x, y) {
    current = [[x, y]];
    rings.push(current);
  },
  lineTo(x, y) {
    current.push([x, y]);
  },
  closePath() {},
  arc() {},
  rect() {},
})(landGeo);

const bits = new Uint8Array(W * H);
for (let row = 0; row < H; row++) {
  const y = row + 0.5;
  const xs = [];
  for (const r of rings) {
    for (let i = 0; i < r.length; i++) {
      const [x1, y1] = r[i];
      const [x2, y2] = r[(i + 1) % r.length];
      if (y1 <= y !== y2 <= y) xs.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
    }
  }
  xs.sort((a, b) => a - b);
  for (let k = 0; k + 1 < xs.length; k += 2) {
    const a = Math.max(0, Math.ceil(xs[k] - 0.5));
    const b = Math.min(W - 1, Math.floor(xs[k + 1] - 0.5));
    for (let x = a; x <= b; x++) bits[row * W + x] = 1;
  }
}

// Each row: alternating run lengths (water first), base36, comma separated.
const rle = [];
let landCells = 0;
for (let row = 0; row < H; row++) {
  const runs = [];
  let v = 0;
  let n = 0;
  for (let x = 0; x < W; x++) {
    const b = bits[row * W + x];
    landCells += b;
    if (b === v) n++;
    else {
      runs.push(n.toString(36));
      v = b;
      n = 1;
    }
  }
  runs.push(n.toString(36));
  rle.push(runs.join(","));
}

/* ------------------------------------------------------------------ */
/* Land elevation, 1°, from NOAA ETOPO5 (public domain)                */
/* ------------------------------------------------------------------ */

// 4320 × 2160 big-endian int16 metres, 5′ cells, from 90°N and 0°E. Downloaded
// once into scripts/data (git-ignored: 18 MB).
const ETOPO_URL = "https://www.ngdc.noaa.gov/mgg/global/relief/ETOPO5/TOPO/ETOPO5/ETOPO5.DAT";
const etopoFile = path.join(root, "scripts/data/ETOPO5.DAT");
if (!fs.existsSync(etopoFile)) {
  console.log(`downloading ${ETOPO_URL} …`);
  const res = await fetch(ETOPO_URL);
  if (!res.ok) throw new Error(`ETOPO5 download failed: ${res.status}`);
  fs.writeFileSync(etopoFile, Buffer.from(await res.arrayBuffer()));
}
const etopo = fs.readFileSync(etopoFile);
if (etopo.length !== 4320 * 2160 * 2) throw new Error(`unexpected ETOPO5 size ${etopo.length}`);

/**
 * Per 1° cell: the land's height — mostly its mean, part its peak, so ranges
 * keep their crests — quantised to 62 levels on a square-root scale (detail
 * where most land is: low). Sea is 0. Rows from 90°N; columns from 180°W.
 * Encoding: one character per land cell ("A"…"9" = levels 1…62), and runs
 * of sea as ".<count in base 36>." — rows joined by "|".
 */
const EW = 360;
const EH = 180;
const LEVELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const TOP = 6000; // metres at the top level
const elevRows = [];
let highest = 0;
for (let row = 0; row < EH; row++) {
  let line = "";
  let sea = 0;
  const flush = () => {
    if (sea) line += `.${sea.toString(36)}.`;
    sea = 0;
  };
  for (let col = 0; col < EW; col++) {
    let sum = 0;
    let n = 0;
    let max = 0;
    for (let dy = 0; dy < 12; dy++) {
      for (let dx = 0; dx < 12; dx++) {
        const lon = (col + 180) % 360; // our column 0 is 180°W, i.e. 180°E in ETOPO's 0–360
        const v = etopo.readInt16BE(((row * 12 + dy) * 4320 + lon * 12 + dx) * 2);
        if (v <= 0) continue;
        sum += v;
        n++;
        max = Math.max(max, v);
      }
    }
    if (!n) {
      sea++;
      continue;
    }
    flush();
    const h = 0.6 * (sum / n) + 0.4 * max;
    highest = Math.max(highest, h);
    line += LEVELS[Math.round(Math.sqrt(Math.min(h, TOP) / TOP) * 61)];
  }
  flush();
  elevRows.push(line);
}

const out = {
  source:
    "Vietnam: geoBoundaries VNM ADM1 (public domain), merged to the 34 units of 2025. Land: Natural Earth 1:50m via world-atlas (public domain). Elevation: NOAA ETOPO5 (public domain).",
  vietnam: vnData,
  land: { w: W, h: H, rle: rle.join("|") },
  elevation: { w: EW, h: EH, top: TOP, rows: elevRows.join("|") },
  countries: worldBorders,
};

const file = path.join(root, "components/scene/geo-data.json");
fs.writeFileSync(file, JSON.stringify(out));

const pts = (lines) => lines.reduce((s, l) => s + l.length / 2, 0);
console.log(`units: ${units.size}`);
console.log(`outline: ${outline.length} lines, ${pts(vnData.outline)} pts (simplified)`);
console.log(`borders: ${borders.length} lines, ${pts(vnData.borders)} pts (simplified)`);
console.log(`land: ${((landCells / (W * H)) * 100).toFixed(1)}% of cells`);
console.log(`provinces with airports: ${lifted.map((u) => `${u.name} (${u.tier}: ${u.codes.join(" ")})`).join(", ")}`);
console.log(`spread apart in ${rounds} rounds; offsets: ${lifted.map((u) => `${u.name} ${u.o.map(r3).join(",")}`).join("; ")}`);
console.log(`elevation: highest 1° cell ${Math.round(highest)} m`);
console.log(`wrote ${path.relative(root, file)} (${(fs.statSync(file).size / 1024).toFixed(1)} KB)`);
