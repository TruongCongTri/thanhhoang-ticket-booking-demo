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
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { feature, mesh } from "topojson-client";
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

const vnData = { q: Q, outline: encode(outline), borders: encode(borders) };

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

const out = {
  source: "Vietnam: geoBoundaries VNM ADM1 (public domain), merged to the 34 units of 2025. Land: Natural Earth 1:50m via world-atlas (public domain).",
  vietnam: vnData,
  land: { w: W, h: H, rle: rle.join("|") },
};

const file = path.join(root, "components/scene/geo-data.json");
fs.writeFileSync(file, JSON.stringify(out));

const pts = (lines) => lines.reduce((s, l) => s + l.length / 2, 0);
console.log(`units: ${units.size}`);
console.log(`outline: ${outline.length} lines, ${pts(vnData.outline)} pts (simplified)`);
console.log(`borders: ${borders.length} lines, ${pts(vnData.borders)} pts (simplified)`);
console.log(`land: ${((landCells / (W * H)) * 100).toFixed(1)}% of cells`);
console.log(`wrote ${path.relative(root, file)} (${(fs.statSync(file).size / 1024).toFixed(1)} KB)`);
