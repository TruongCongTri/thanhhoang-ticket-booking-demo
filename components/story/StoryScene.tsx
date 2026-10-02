"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import geoData from "../scene/geo-data.json";
import {
  CAMERA_FOV,
  CAMERA_Z,
  LOGO_W,
  buildAmbient,
  columnOrder,
  deepSky,
  logo as logoShape,
  mulberry32,
  shuffled,
  spreadPick,
  type GeoData,
  type LogoPixels,
} from "../scene/shapes";
import { fragmentShader, skyVertexShader } from "../scene/shaders";
import { virgoFit } from "../scene/virgo";
import { storyVertexShader } from "./story-shader";
import { history, mission, values, vision, pie, orgChart, TONE, type Model } from "./models";
import { SCRIPTS, stageScreens, stepLengths, type Frame, type ModelKey, type Place, type Style } from "./scripts";
import { storyBus, type FrameRef } from "./bus";
import { BRAND } from "@/lib/brand";
import { LOAD, onPageStart } from "@/lib/loading";
import { currentTheme, onThemeChange } from "@/lib/theme";
import type { StoryPageId } from "@/lib/pages";

gsap.registerPlugin(ScrollTrigger);

type Pose = { x: number; y: number; rx: number; ry: number; rz: number; s: number };

/** Half the visible height at z = 0. */
const HALF_H = CAMERA_Z * Math.tan(((CAMERA_FOV / 2) * Math.PI) / 180);
const COMPACT_QUERY = "(max-width: 1023px)";
/** The logo's place over the footer, and on the loading screen — the same as on the home page. */
const DESKTOP_LOGO: Pose = { x: 0, y: 1.75, rx: 0.06, ry: 0, rz: 0, s: 0.88 };
const LOGO_LOOK = { size: 0.55, depth: 0.35 };
/** Share of the particles a model may use; the rest wait in the sky. */
const BUDGET = 0.9;
const STYLE: Record<Style, number> = { sweep: 0, rise: 1, regather: 2, drift: 3 };

/** One TET orientation for every particle (as in scene/Scene.tsx). */
const TET = [
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0.9428, -0.3333, 0),
  new THREE.Vector3(-0.4714, -0.3333, 0.8165),
  new THREE.Vector3(-0.4714, -0.3333, -0.8165),
];
const FACES = [
  [0, 1, 2],
  [0, 2, 3],
  [0, 3, 1],
  [1, 2, 3],
];
const LIGHT = new THREE.Vector3(-0.35, 0.75, 0.55).normalize();

/** A model, given out to the particles: where each one sits, and how it looks there. */
type FrameData = {
  model: Model;
  pos: Float32Array; // N×3, model space
  info: Float32Array; // N×4: in the model?, size, tone, group
  col: Float32Array; // N×3
  xq: Float32Array; // N: 0 leftmost … 1 rightmost of the model's particles
  yq: Float32Array; // N: 0 lowest … 1 highest
  groups: number;
};

const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Where a model stands, fitted to the screen and to its side of the copy. */
function poseFor(place: Place, box: Model["box"], compact: boolean, aspect: number): Pose {
  const H = HALF_H * 2;
  const W = H * aspect;
  if (place.side === "logo") {
    if (!compact) return DESKTOP_LOGO;
    const s = Math.min((0.9 * W) / LOGO_W, 0.9);
    return { ...DESKTOP_LOGO, y: HALF_H - 1 - 1.89 * s, s };
  }
  const bw = box.x1 - box.x0;
  const bh = box.y1 - box.y0;
  const cx = (box.x0 + box.x1) / 2;
  const cy = (box.y0 + box.y1) / 2;
  const fill = place.fill ?? 1;
  let s: number;
  let x: number;
  let y: number;
  if (compact || place.side === "center") {
    s = Math.min((0.92 * W) / bw, (0.62 * H) / bh) * fill;
    x = -cx * s;
    y = -cy * s;
  } else {
    // beside the copy: the half of the screen it leaves free
    s = Math.min((0.38 * W) / bw, (0.6 * H) / bh) * fill;
    x = (place.side === "right" ? 1 : -1) * 0.225 * W - cx * s;
    y = -cy * s - 0.1;
  }
  y += ((place.dy ?? 0) + (compact ? (place.compactDy ?? 0) : 0)) * HALF_H;
  const turn = compact ? 0.5 : 1;
  return { x, y, rx: place.rx ?? 0, ry: (place.ry ?? 0) * turn, rz: place.rz ?? 0, s };
}

/** The logo image as pixels (as scene/Scene.tsx). */
async function loadLogoPixels(): Promise<LogoPixels | null> {
  try {
    const img = new Image();
    img.src = BRAND.logo.src;
    await img.decode();
    const w = 720;
    const h = Math.round((w * img.naturalHeight) / img.naturalWidth);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    return { w, h, data: ctx.getImageData(0, 0, w, h).data };
  } catch {
    return null;
  }
}

const seedOf = (key: string) => [...key].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 20261002);

const report = (p: number) => window.dispatchEvent(new CustomEvent(LOAD.progress, { detail: p }));
const ready = () => {
  document.documentElement.setAttribute("data-scene-ready", "");
  window.dispatchEvent(new Event(LOAD.ready));
};

/**
 * The particle scene behind every story page. It lives in their shared
 * layout, so moving from one page to the next never rebuilds it: the end of
 * one page's script morphs straight into the start of the next.
 *
 * Every model is paired against the company logo (see `assign`), the same way
 * whichever page asks for it — so the frame a hand-off morphs into is exactly
 * the frame the next page opens on.
 */
export default function StoryScene() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    } catch {
      ready();
      return;
    }

    const html = document.documentElement;
    const small = window.matchMedia("(max-width: 767px)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // A fresh load shows the loading screen (the logo drawing itself); arriving
    // from the home page, the particles gather straight from the sky.
    const freshLoad = html.hasAttribute("data-loading");
    let alive = true;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    const BG = { dark: new THREE.Color(0x000000), light: new THREE.Color(0xf4f6fa) };
    const startLight = currentTheme() === "light" ? 1 : 0;
    const clear = new THREE.Color().lerpColors(BG.dark, BG.light, startLight);
    renderer.setClearColor(clear, 1);
    host.appendChild(renderer.domElement);
    const gl = renderer.getContext();
    const maxPoint = (gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE) as Float32Array | null)?.[1] ?? 256;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(CAMERA_FOV, window.innerWidth / window.innerHeight, 0.1, 150);
    camera.position.set(0, 0, CAMERA_Z);
    camera.updateMatrixWorld();

    const shared = {
      uTime: { value: 0 },
      uPixelRatio: { value: renderer.getPixelRatio() },
      uMaxPoint: { value: Math.min(maxPoint, 300 * renderer.getPixelRatio()) },
      uViewport: { value: renderer.getDrawingBufferSize(new THREE.Vector2()) },
      uCamZ: { value: CAMERA_Z },
      uOpacity: { value: 1 },
      uSkyBoost: { value: freshLoad ? 1 : 0 },
      uTheme: { value: startLight },
      uTravel: { value: 0 },
      uTet: { value: TET.map(() => new THREE.Vector3()) },
      uFace: { value: new THREE.Vector4() },
      uFill: { value: 0.22 },
    };
    const uniforms = {
      ...shared,
      uT: { value: 0 },
      uStyle: { value: 0 },
      uMVA: { value: new THREE.Matrix4() },
      uMVB: { value: new THREE.Matrix4() },
      uLookA: { value: new THREE.Vector4(1, 0, 1, 0) },
      uLookB: { value: new THREE.Vector4(1, 0, 1, 0) },
      uPulse: { value: new THREE.Vector2() },
      uReveal: { value: new THREE.Vector2(-1, -1) },
      uAppear: { value: 0 },
      uLoadProgress: { value: 0 },
      uLoader: { value: 1 },
      uMVLoader: { value: new THREE.Matrix4() },
      uLogo: { value: new THREE.Vector3(LOGO_LOOK.size, LOGO_LOOK.depth, 1) },
      uSize: { value: small ? 11 : 13 },
      uMouse: { value: new THREE.Vector2() },
      uDelta: { value: new THREE.Vector2() },
      uHalfView: { value: new THREE.Vector2(HALF_H * camera.aspect, HALF_H) },
      uHover: { value: 0 },
      uSkyStage: { value: 0 },
    };

    /* ---- the background: the same deep field and Virgo as the home page ---- */
    const amb = buildAmbient(small ? 450 : 900);
    const ambGeo = new THREE.BufferGeometry();
    ambGeo.setAttribute("position", new THREE.BufferAttribute(amb.pos, 3));
    ambGeo.setAttribute("aColorRand", new THREE.BufferAttribute(amb.colorRand, 4));
    ambGeo.setAttribute("aStar", new THREE.BufferAttribute(amb.star, 4));
    const ambUniforms = {
      ...shared,
      uMorph: { value: 1.7 }, // see skyStage below
      uAppear: { value: 1 },
      uFieldOpacity: { value: 0.55 + 0.2 * startLight },
      uSize: { value: small ? 9 : 10 },
      uVirgo: { value: new THREE.Vector4() },
      uVirgoOffset: { value: new THREE.Vector2() },
    };
    const fitVirgo = () => {
      const fit = virgoFit(window.innerWidth / window.innerHeight, HALF_H / CAMERA_Z);
      ambUniforms.uVirgo.value.set(fit.k, fit.cos, fit.sin, 0);
      ambUniforms.uVirgoOffset.value.set(fit.ox, fit.oy);
    };
    fitVirgo();
    const ambMaterial = new THREE.ShaderMaterial({
      uniforms: ambUniforms,
      vertexShader: skyVertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
    });
    const ambient = new THREE.Points(ambGeo, ambMaterial);
    ambient.frustumCulled = false;
    scene.add(ambient);
    const disposables: { dispose(): void }[] = [ambGeo, ambMaterial];

    /* ---- the particles ---- */
    const N = small ? 3800 : 6500;
    const rand = mulberry32(20261002);
    const sky = deepSky(N, rand);
    const colorRand = new Float32Array(N * 4);
    {
      const palette = (
        [
          ["#1f7fd8", 0.3],
          ["#4fa8ff", 0.22],
          ["#9fd0ff", 0.12],
          ["#0a64b8", 0.12],
          ["#f5a830", 0.16],
          ["#f07a30", 0.08],
        ] as const
      ).map(([hex, w]) => {
        const n = parseInt(hex.slice(1), 16);
        return [[((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255], w] as const;
      });
      for (let i = 0; i < N; i++) {
        let w = rand();
        const c = palette.find(([, weight]) => (w -= weight) <= 0)?.[0] ?? palette[0][0];
        colorRand.set(c, i * 4);
        colorRand[i * 4 + 3] = rand();
      }
    }

    const geo = new THREE.BufferGeometry();
    const attr = (name: string, size: number) => {
      const a = new THREE.BufferAttribute(new Float32Array(N * size), size);
      a.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute(name, a);
      return a;
    };
    geo.setAttribute("position", new THREE.BufferAttribute(sky, 3));
    geo.setAttribute("aColorRand", new THREE.BufferAttribute(colorRand, 4));
    const A = { pos: attr("aA", 3), info: attr("aInfoA", 4), col: attr("aColA", 3) };
    const B = { pos: attr("aB", 3), info: attr("aInfoB", 4), col: attr("aColB", 3) };
    const order = attr("aOrder", 1);
    const loaderPos = attr("aLoader", 3);
    const loaderInfo = attr("aLoaderInfo", 4);
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: storyVertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
    });
    const points = new THREE.Points(geo, material);
    points.frustumCulled = false;
    points.visible = false;
    scene.add(points);
    disposables.push(geo, material);

    /* ---- models, paired against the logo ---- */
    // The logo goes to a random subset of the particles; it's the anchor
    // every other model is paired back from.
    let logoFrame: FrameData | null = null;
    let logoIds: number[] = [];
    let spare: number[] = [];
    const frames = new Map<ModelKey, FrameData>();

    /** Fills in the quantiles a morph's timing reads. */
    const finishFrame = (model: Model, pos: Float32Array, info: Float32Array, col: Float32Array): FrameData => {
      const ids: number[] = [];
      for (let i = 0; i < N; i++) if (info[i * 4] > 0.5) ids.push(i);
      const xq = new Float32Array(N).fill(0.5);
      const yq = new Float32Array(N).fill(0.5);
      const rank = (axis: number, out: Float32Array) =>
        ids
          .slice()
          .sort((a, b) => pos[a * 3 + axis] - pos[b * 3 + axis])
          .forEach((i, r) => (out[i] = ids.length > 1 ? r / (ids.length - 1) : 0.5));
      rank(0, xq);
      rank(1, yq);
      return { model, pos, info, col, xq, yq, groups: Math.max(0, ...model.group) };
    };

    /**
     * Gives a model's points to particles: the logo's particles, read in
     * columns left to right (each bottom to top), are matched in that order to
     * the model's points read the same way; points beyond them come from the
     * sky. So the pairing depends only on the model — and any two models
     * line up with each other side by side, as they do with the logo.
     */
    const assign = (model: Model): FrameData => {
      const pos = new Float32Array(N * 3);
      const info = new Float32Array(N * 4);
      const col = new Float32Array(N * 3);
      const nB = model.pos.length / 3;
      const lp = logoFrame!.pos;
      const lx = (i: number) => lp[i * 3];
      const ly = (i: number) => lp[i * 3 + 1];
      const bx = (k: number) => model.pos[k * 3];
      const by = (k: number) => model.pos[k * 3 + 1];
      const n = Math.min(logoIds.length, nB);
      const aSel = columnOrder(spreadPick(logoIds.slice().sort((i, j) => lx(i) - lx(j)), n), lx, ly);
      const all = Array.from({ length: nB }, (_, k) => k);
      const bSel = columnOrder(spreadPick(all.sort((i, j) => bx(i) - bx(j)), n), bx, by);
      const owner = new Int32Array(nB).fill(-1);
      aSel.forEach((i, j) => (owner[bSel[j]] = i));
      let s = 0;
      for (let k = 0; k < nB; k++) {
        if (owner[k] < 0) owner[k] = s < spare.length ? spare[s++] : -1;
        const i = owner[k];
        if (i < 0) continue;
        pos.set(model.pos.subarray(k * 3, k * 3 + 3), i * 3);
        info.set([1, model.size[k], model.tone[k], model.group[k]], i * 4);
        if (model.color) col.set(model.color.subarray(k * 3, k * 3 + 3), i * 3);
      }
      return finishFrame(model, pos, info, col);
    };

    /**
     * A family's models (the history years) keep their shared base on the
     * same particles: the first one is paired as usual and its base owners
     * remembered; later ones reuse them, and their own points (the year) go
     * to a fixed pool of the rest, in the same left-to-right order.
     */
    const families = new Map<string, { owners: Int32Array; pool: number[] }>();
    const assignFamily = (model: Model): FrameData => {
      const fam = model.family!;
      let known = families.get(fam.id);
      if (!known) {
        const first = assign({ ...model, pos: model.pos.subarray(0, fam.base * 3) });
        const owners = new Int32Array(fam.base).fill(-1);
        // recover which particle holds each base point (positions are unique)
        const at = new Map<string, number>();
        for (let i = 0; i < N; i++) if (first.info[i * 4] > 0.5) at.set(first.pos.subarray(i * 3, i * 3 + 3).join(","), i);
        for (let k = 0; k < fam.base; k++) owners[k] = at.get(model.pos.subarray(k * 3, k * 3 + 3).join(",")) ?? -1;
        const used = new Set(owners);
        known = { owners, pool: [...logoIds, ...spare].filter((i) => !used.has(i)) };
        families.set(fam.id, known);
      }
      const pos = new Float32Array(N * 3);
      const info = new Float32Array(N * 4);
      const col = new Float32Array(N * 3);
      const put = (k: number, i: number) => {
        if (i < 0) return;
        pos.set(model.pos.subarray(k * 3, k * 3 + 3), i * 3);
        info.set([1, model.size[k], model.tone[k], model.group[k]], i * 4);
      };
      for (let k = 0; k < fam.base; k++) put(k, known.owners[k]);
      const own = Array.from({ length: model.size.length - fam.base }, (_, j) => fam.base + j);
      const ordered = columnOrder(own, (k) => model.pos[k * 3], (k) => model.pos[k * 3 + 1]);
      ordered.forEach((k, j) => put(k, j < known!.pool.length ? known!.pool[j] : -1));
      return finishFrame(model, pos, info, col);
    };

    const BUILDERS: Record<Exclude<ModelKey, "logo">, (budget: number, r: () => number) => Model> = {
      "history-2013": (b, r) => history(b, r, geoData as GeoData, 2013),
      "history-2016": (b, r) => history(b, r, geoData as GeoData, 2016),
      "history-2019": (b, r) => history(b, r, geoData as GeoData, 2019),
      "history-2022": (b, r) => history(b, r, geoData as GeoData, 2022),
      vision,
      mission,
      values,
      pie: (b, r) => pie(b, r),
      org: orgChart,
    };

    /** Builds (once) every model a script needs; yields between models so the page stays responsive. */
    const ensure = async (keys: ModelKey[], onProgress?: (p: number) => void) => {
      const todo = [...new Set(keys)].filter((k) => !frames.has(k));
      for (let j = 0; j < todo.length; j++) {
        const key = todo[j];
        if (key === "logo") frames.set(key, logoFrame!);
        else {
          const model = BUILDERS[key](Math.round(N * BUDGET), mulberry32(seedOf(key)));
          frames.set(key, model.family ? assignFamily(model) : assign(model));
        }
        onProgress?.((j + 1) / todo.length);
        await nextTask();
        if (!alive) return;
      }
    };

    /* ---- what's on screen: the page's script, or an override ---- */
    const morph = { v: 0 };
    let script: {
      page: StoryPageId;
      frames: Frame[];
      lits: { v: number }[];
      steps: { v: number }[];
      tl: gsap.core.Timeline;
    } | null = null;
    let arrivedAt = 0;
    let started = false;

    const keysOf = (page: StoryPageId) => SCRIPTS[page].map((f) => f.model);

    /** Builds a page's models and its scroll timeline. */
    const play = async (page: StoryPageId) => {
      if (script) {
        script.tl.scrollTrigger?.kill();
        script.tl.kill();
        script = null;
      }
      await ensure(keysOf(page));
      if (!alive || storyBus.page !== page || !document.getElementById("story")) return;
      const list = SCRIPTS[page];
      const F = list.length;
      // The timeline runs in screens of scroll from the top of #story, and
      // each chapter is as long as its markup says (stageScreens): 1.5
      // screens, or more for a stepped one.
      const len = list.map(stageScreens);
      const at = len.map((_, k) => len.slice(0, k).reduce((sum, h) => sum + h, 0));
      const END = len.reduce((sum, h) => sum + h, 0) - 1;
      morph.v = 0;
      // a stepped chapter's progress through its steps: 0.55 … steps + 0.45
      const steps = list.map(() => ({ v: 0.55 }));
      const lits = list.map((f, k) => (f.lit === "scroll" ? steps[k] : { v: typeof f.lit === "number" ? f.lit : 0 }));
      // Scrub with no lag of its own: Lenis already smooths the scroll.
      const tl = gsap.timeline({
        defaults: { ease: "none", immediateRender: false },
        scrollTrigger: { trigger: "#story", start: "top top", end: "bottom bottom", scrub: true },
      });
      for (let k = 1; k < F; k++) {
        // Each morph completes as its chapter's copy reaches the middle of the
        // screen; after a stepped chapter it waits until every step has played.
        const held = !!list[k - 1].steps;
        const last = k === F - 1;
        const a = held ? at[k] - 0.8 : at[k] - (last ? 0.83 : 0.93);
        const b = last ? Math.min(at[k] + 0.45, END) : at[k] + 0.18;
        tl.fromTo(morph, { v: k - 1 }, { v: k, duration: b - a }, a);
      }
      list.forEach((f, k) => {
        if (!f.steps) return;
        // One step after another while the copy is pinned: from just after the
        // model has formed, to before the next chapter's morph sets off.
        const from = at[k] + 0.2;
        const to = at[k] + len[k] - 0.95;
        // each step its own share of that scroll (stepLengths), one after another
        const lengths = stepLengths(f);
        const total = lengths.reduce((sum, l) => sum + l, 0);
        let when = from;
        lengths.forEach((l, i) => {
          const duration = ((to - from) * l) / total;
          const v0 = i === 0 ? 0.55 : i + 0.5;
          const v1 = i === lengths.length - 1 ? f.steps! + 0.45 : i + 1.5;
          tl.fromTo(steps[k], { v: v0 }, { v: v1, duration }, when);
          when += duration;
        });
      });
      tl.set({}, {}, END);
      script = { page, frames: list, lits, steps, tl };
      arrivedAt = performance.now();
      ScrollTrigger.refresh();
      // Warm up the pages either side, so a hand-off never waits on a build.
      for (const other of Object.keys(SCRIPTS) as StoryPageId[]) {
        if (other !== page) await ensure(keysOf(other));
      }
    };

    /** The frame a reference points at (a model and where it stands), if built. */
    const frameAt = (ref: FrameRef): { frame: Frame; data: FrameData; index: number } | null => {
      const list = SCRIPTS[ref.page];
      let index: number;
      if (ref.index === "last") index = list.length - 1;
      else if (ref.index === "here") {
        // resolved once, the moment a jump starts
        index = script?.page === ref.page ? Math.round(morph.v) : 0;
        ref.index = index;
      } else index = ref.index;
      const frame = list[Math.max(0, Math.min(list.length - 1, index))];
      const data = frames.get(frame.model);
      return data ? { frame, data, index } : null;
    };

    /* ---- uploading the pair being morphed between ---- */
    let shownKey = "";
    const upload = (a: FrameData, b: FrameData, style: Style, rightward: boolean) => {
      const key = `${frameKey(a)}|${frameKey(b)}|${style}|${rightward}`;
      if (key === shownKey) return;
      shownKey = key;
      (A.pos.array as Float32Array).set(a.pos);
      (A.info.array as Float32Array).set(a.info);
      (A.col.array as Float32Array).set(a.col);
      (B.pos.array as Float32Array).set(b.pos);
      (B.info.array as Float32Array).set(b.info);
      (B.col.array as Float32Array).set(b.col);
      const o = order.array as Float32Array;
      for (let i = 0; i < N; i++) {
        const inA = a.info[i * 4] > 0.5;
        const inB = b.info[i * 4] > 0.5;
        if (style === "rise") o[i] = inB ? b.yq[i] : inA ? a.yq[i] : 0.5;
        else {
          const q = style === "regather" ? (inB ? b.xq[i] : inA ? a.xq[i] : 0.5) : inA ? a.xq[i] : inB ? b.xq[i] : 0.5;
          o[i] = rightward ? 1 - q : q;
        }
      }
      [A.pos, A.info, A.col, B.pos, B.info, B.col, order].forEach((x) => (x.needsUpdate = true));
    };
    const ids = new WeakMap<FrameData, number>();
    let nextId = 0;
    const frameKey = (f: FrameData) => {
      if (!ids.has(f)) ids.set(f, nextId++);
      return ids.get(f)!;
    };

    /* ---- the loading screen, or the gather from the sky ---- */
    const progress = (p: number) => {
      gsap.to(uniforms.uLoadProgress, { value: p, duration: 0.7, ease: "power2.out", overwrite: true });
      report(p);
    };
    const release = () => {
      if (reduced) {
        uniforms.uLoadProgress.value = 1;
        uniforms.uLoader.value = 0;
        shared.uSkyBoost.value = 0;
        return;
      }
      if (freshLoad) gsap.to(uniforms.uLoadProgress, { value: 1, duration: 0.4, ease: "power2.out", overwrite: true });
      gsap.to(uniforms.uLoader, { value: 0, duration: freshLoad ? 2.8 : 2.2, ease: "power2.inOut", delay: freshLoad ? 0.45 : 0 });
      gsap.to(shared.uSkyBoost, { value: 0, duration: 2.6, ease: "power2.inOut", delay: freshLoad ? 0.9 : 0 });
    };

    let stopWaiting = () => {};
    (async () => {
      try {
        const pixels = await loadLogoPixels();
        if (!alive) return;
        const shape = logoShape(Math.round(N * 0.95), rand, pixels);
        const pick = shuffled(N, rand);
        const nL = shape.pos.length / 3;
        logoIds = Array.from(pick.subarray(0, nL));
        spare = Array.from(pick.subarray(nL));
        const pos = new Float32Array(N * 3);
        const info = new Float32Array(N * 4);
        const col = new Float32Array(N * 3);
        logoIds.forEach((i, k) => {
          pos.set(shape.pos.subarray(k * 3, k * 3 + 3), i * 3);
          info.set([1, shape.size[k], TONE.logo, 0], i * 4);
          col.set(shape.color.subarray(k * 3, k * 3 + 3), i * 3);
        });
        const logoModel: Model = {
          pos: shape.pos,
          size: shape.size,
          tone: new Float32Array(nL).fill(TONE.logo),
          group: new Float32Array(nL),
          color: shape.color,
          box: { x0: -LOGO_W / 2, x1: LOGO_W / 2, y0: -1.9, y1: 1.9 },
          look: LOGO_LOOK,
        };
        logoFrame = finishFrame(logoModel, pos, info, col);
        frames.set("logo", logoFrame);

        // The loading screen's logo: drawn left to right, released the same way.
        const lp = loaderPos.array as Float32Array;
        const li = loaderInfo.array as Float32Array;
        lp.set(pos);
        for (let i = 0; i < N; i++) {
          if (!info[i * 4]) continue;
          const [r, g, b] = [0, 1, 2].map((c) => Math.round(col[i * 3 + c] * 255));
          li.set([1, logoFrame.xq[i], info[i * 4 + 1], r * 65536 + g * 256 + b], i * 4);
        }
        loaderPos.needsUpdate = loaderInfo.needsUpdate = true;
        upload(logoFrame, logoFrame, "sweep", false);
        points.visible = true;
        gsap.to(uniforms.uAppear, { value: 1, duration: 0.8, ease: "power1.out" });
        if (freshLoad) progress(0.15);

        // The page this load is for (its effects ran before ours).
        const page = storyBus.page;
        if (page) {
          await ensure(keysOf(page), (p) => freshLoad && progress(0.15 + p * 0.85));
          if (!alive) return;
          await play(page);
        }
      } catch (err) {
        console.error(err);
      }
      if (!alive) return;
      started = true;
      if (freshLoad) {
        ready();
        stopWaiting = onPageStart(release);
      } else release();
    })();

    const stopPage = storyBus.onPage(() => {
      const page = storyBus.page;
      if (page && started) play(page);
    });

    /* ---- theme ---- */
    const theme = { v: startLight };
    const stopTheme = onThemeChange((next) => {
      gsap.to(theme, {
        v: next === "light" ? 1 : 0,
        duration: reduced ? 0 : 0.6,
        ease: "power2.inOut",
        overwrite: true,
        onUpdate: () => {
          shared.uTheme.value = theme.v;
          ambUniforms.uFieldOpacity.value = 0.55 + 0.2 * theme.v;
          renderer.setClearColor(clear.lerpColors(BG.dark, BG.light, theme.v), 1);
        },
      });
    });

    /* ---- pointer (as scene/Scene.tsx), plus where it is for hovering boxes ---- */
    const mouse = { x: 0, y: 0, px: 0, py: 0, dx: 0, dy: 0, present: 0, cx: -1, cy: -1 };
    const toNdc = (e: PointerEvent) => [2 * (e.clientX / window.innerWidth - 0.5), -2 * (e.clientY / window.innerHeight - 0.5)];
    const onPointerMove = (e: PointerEvent) => {
      const [x, y] = toNdc(e);
      const lim = e.pointerType === "touch" ? 0.1 : 2;
      mouse.dx = THREE.MathUtils.clamp(50 * (x - mouse.px), -lim, lim);
      mouse.dy = THREE.MathUtils.clamp(50 * (y - mouse.py), -lim, lim);
      mouse.x = mouse.px = x;
      mouse.y = mouse.py = y;
      mouse.cx = e.clientX;
      mouse.cy = e.clientY;
      mouse.present = 1;
    };
    const onPointerDown = (e: PointerEvent) => {
      const [x, y] = toNdc(e);
      mouse.x = mouse.px = x;
      mouse.y = mouse.py = y;
      mouse.cx = e.clientX;
      mouse.cy = e.clientY;
      mouse.dx = mouse.dy = 0;
      mouse.present = 1;
    };
    const onPointerEnd = (e: PointerEvent) => {
      if (e.pointerType === "touch") mouse.present = 0;
    };
    const onPointerOut = (e: PointerEvent) => {
      if (e.relatedTarget) return;
      mouse.present = 0;
      mouse.dx = mouse.dy = 0;
      mouse.cx = mouse.cy = -1;
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointerup", onPointerEnd);
    window.addEventListener("pointercancel", onPointerEnd);
    document.addEventListener("pointerout", onPointerOut);

    const onResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      fitVirgo();
      uniforms.uHalfView.value.set(HALF_H * camera.aspect, HALF_H);
      shared.uPixelRatio.value = renderer.getPixelRatio();
      renderer.getDrawingBufferSize(shared.uViewport.value);
    };
    window.addEventListener("resize", onResize);

    /* ---- per frame ---- */
    const tetEuler = new THREE.Euler();
    const tetQuat = new THREE.Quaternion();
    const corners = TET.map(() => new THREE.Vector3());
    const ab = new THREE.Vector3();
    const ac = new THREE.Vector3();
    const nrm = new THREE.Vector3();
    const centroid = new THREE.Vector3();
    const faceShade = [0, 0, 0, 0];
    const updateTetra = (time: number) => {
      tetEuler.set(0.42, reduced ? 0.6 : time * 0.35, 0);
      tetQuat.setFromEuler(tetEuler);
      corners.forEach((c, i) => {
        c.copy(TET[i]).applyQuaternion(tetQuat);
        shared.uTet.value[i].set(c.x * 0.8, c.y * 0.8, c.z);
      });
      FACES.forEach(([a, b, c], i) => {
        ab.subVectors(corners[b], corners[a]);
        ac.subVectors(corners[c], corners[a]);
        nrm.crossVectors(ab, ac).normalize();
        centroid.copy(corners[a]).add(corners[b]).add(corners[c]);
        if (nrm.dot(centroid) < 0) nrm.negate();
        faceShade[i] = nrm.z > 0 ? 0.35 + 0.65 * Math.max(0, nrm.dot(LIGHT)) : 0;
      });
      shared.uFace.value.set(faceShade[0], faceShade[1], faceShade[2], faceShade[3]);
    };

    const eased = { x: 0, y: 0 };
    const tPos = new THREE.Vector3();
    const tEuler = new THREE.Euler();
    const tQuat = new THREE.Quaternion();
    const tScale = new THREE.Vector3();
    const tWorld = new THREE.Matrix4();
    const worldOf = (p: Pose, out: THREE.Matrix4, time: number, spin = 0) => {
      tPos.set(p.x + eased.x * 0.2, p.y + Math.sin(time * 0.8) * 0.08 + eased.y * 0.1, 0);
      tEuler.set(p.rx - eased.y * 0.08, p.ry + spin + eased.x * 0.15, p.rz + Math.sin(time * 0.6) * 0.02);
      tQuat.setFromEuler(tEuler);
      tScale.setScalar(p.s);
      return out.compose(tPos, tQuat, tScale);
    };
    const place = (p: Pose, mv: THREE.Matrix4, time: number, spin = 0) =>
      mv.multiplyMatrices(camera.matrixWorldInverse, worldOf(p, tWorld, time, spin));

    /**
     * A model's hover targets (the org chart's positions) on screen: published
     * for the names shown beside them, and hit-tested for the pointer.
     */
    const centre = new THREE.Vector3();
    const edge = new THREE.Vector3();
    const hoverWorld = new THREE.Matrix4();
    const trackTargets = (
      page: StoryPageId,
      data: FrameData,
      pose: Pose,
      time: number,
      spin: number,
      reveal: number,
      presence: number,
    ) => {
      const targets = data.model.targets;
      if (!targets) {
        storyBus.setNodes(null);
        return storyBus.setHover(null);
      }
      worldOf(pose, hoverWorld, time, spin);
      const W = window.innerWidth;
      const H = window.innerHeight;
      const list = targets.map((t) => {
        centre.set(t.c[0], t.c[1], t.c[2]).applyMatrix4(hoverWorld).project(camera);
        edge.set(t.c[0] + t.hw, t.c[1], t.c[2]).applyMatrix4(hoverWorld).project(camera);
        return {
          group: t.group,
          x: (centre.x * 0.5 + 0.5) * W,
          y: (-centre.y * 0.5 + 0.5) * H,
          r: Math.max(8, Math.hypot(edge.x - centre.x, edge.y - centre.y) * 0.5 * W),
          shown: presence * (reveal < 0 ? 1 : Math.max(0, Math.min(1, reveal - t.group + 1))),
        };
      });
      storyBus.setNodes({ page, list });
      const hit =
        mouse.cx < 0 ? undefined : list.find((n) => n.shown > 0.6 && Math.hypot(mouse.cx - n.x, mouse.cy - n.y) <= n.r + 6);
      storyBus.setHover(hit ? { page, group: hit.group, x: hit.x, y: hit.y + hit.r, top: hit.y - hit.r } : null);
    };

    const aspectNow = () => window.innerWidth / window.innerHeight;
    const rate = (perFrame: number, dt: number) => 1 - Math.pow(1 - perFrame, dt * 60);

    const tick = (time: number, deltaMs: number) => {
      const dt = Math.min(deltaMs / 1000, 0.1);
      shared.uTime.value = time;
      updateTetra(time);

      mouse.dx -= mouse.dx * rate(0.1, dt);
      mouse.dy -= mouse.dy * rate(0.1, dt);
      const mu = uniforms.uMouse.value;
      const du = uniforms.uDelta.value;
      mu.x += (mouse.x - mu.x) * rate(0.075, dt);
      mu.y += (mouse.y - mu.y) * rate(0.075, dt);
      du.x += (mouse.dx - du.x) * rate(0.075, dt);
      du.y += (mouse.dy - du.y) * rate(0.075, dt);
      uniforms.uHover.value += (mouse.present - uniforms.uHover.value) * rate(0.05, dt);
      const k = reduced ? 1 : Math.min(1, dt * 3);
      eased.x += (mouse.x - eased.x) * k;
      eased.y += (mouse.y - eased.y) * k;

      const compact = window.matchMedia(COMPACT_QUERY).matches;
      const aspect = aspectNow();
      const loaderPose = poseFor({ side: "logo" }, logoFrame?.model.box ?? { x0: 0, x1: 1, y0: 0, y1: 1 }, compact, aspect);
      const sway = reduced ? 0 : Math.sin(time * 0.45) * 0.16;
      place({ ...loaderPose, y: compact ? 0.3 : 0.15 }, uniforms.uMVLoader.value, time, sway);
      uniforms.uLogo.value.z = (LOGO_W / 2) * loaderPose.s;

      // Which two frames, and how far between them.
      let pair: {
        a: ReturnType<typeof frameAt>;
        b: ReturnType<typeof frameAt>;
        t: number;
        aLit: number;
        bLit: number;
        aReveal: number;
        bReveal: number;
      } | null = null;
      const o = storyBus.override;
      if (o) {
        const a = frameAt(o.from);
        const b = frameAt(o.to);
        // a frame met through a hand-off or a jump shows all its groups
        const all = (f: Frame) => (f.reveal ? f.reveal[f.reveal.length - 1] : -1);
        if (a && b) pair = { a, b, t: o.t, aLit: litOf(a.frame), bLit: litOf(b.frame), aReveal: all(a.frame), bReveal: all(b.frame) };
        // Back on the page the override led to, and its own scroll shows the
        // same frame: hand back to the scroll.
        if (script && script.page === o.to.page && b && performance.now() - arrivedAt > 120) {
          const settled = Math.abs(morph.v - b.index) < 0.02 && o.t >= 1;
          if (settled || performance.now() - arrivedAt > 2500) storyBus.setOverride(null);
        }
      }
      if (!pair && script) {
        const F = script.frames.length;
        const m = Math.max(0, Math.min(F - 1, morph.v));
        const i = Math.min(F - 1, Math.floor(m));
        const j = Math.min(F - 1, i + 1);
        const a = frameAt({ page: script.page, index: i });
        const b = frameAt({ page: script.page, index: j });
        const aReveal = revealAt(script.frames[i], script.steps[i].v);
        const bReveal = revealAt(script.frames[j], script.steps[j].v);
        if (a && b) pair = { a, b, t: m - i, aLit: script.lits[i].v, bLit: script.lits[j].v, aReveal, bReveal };
        // the copy beside a stepped model shows the step it's on (1 … steps)
        script.frames.forEach((f, k) => {
          if (f.steps) storyBus.setLit(f.model, Math.max(1, Math.min(f.steps, Math.round(script!.steps[k].v))));
        });
        // and the frame on show (half-way through a morph, it's the one arriving)
        storyBus.setLit(`frame:${script.page}`, Math.round(m));
      }

      if (pair && pair.a && pair.b) {
        const { a, b, t } = pair;
        const poseA = poseFor(a.frame.place, a.data.model.box, compact, aspect);
        const poseB = poseFor(b.frame.place, b.data.model.box, compact, aspect);
        const style = b.frame.enter ?? "sweep";
        upload(a.data, b.data, style, poseB.x > poseA.x + 0.05);
        const spinA = a.frame.spin ? Math.sin(time * 0.25) * a.frame.spin : 0;
        const spinB = b.frame.spin ? Math.sin(time * 0.25) * b.frame.spin : 0;
        place(poseA, uniforms.uMVA.value, time, spinA);
        place(poseB, uniforms.uMVB.value, time, spinB);
        uniforms.uT.value = t;
        uniforms.uStyle.value = STYLE[style];

        // The org chart: its positions' names, and hovering one lights it.
        // Two of its chapters side by side stand in the same place: settled throughout.
        const page = script?.page;
        // Mid-morph, the names follow whichever side is still (or already)
        // mostly there, fading out and in with it.
        const same = a.data === b.data && a.frame.place === b.frame.place;
        const settledOn = !o && page ? (same || t >= 0.5 ? b : a) : null;
        const presence = same ? 1 : settledOn === a ? 1 - Math.min(1, t * 2.5) : Math.min(1, (t - 0.6) * 2.5);
        if (settledOn?.frame.hover && page && presence > 0) {
          const onA = settledOn === a && !same;
          trackTargets(
            page,
            settledOn.data,
            onA ? poseA : poseB,
            time,
            onA ? spinA : spinB,
            onA ? pair.aReveal : pair.bReveal,
            presence,
          );
        } else {
          if (storyBus.hover) storyBus.setHover(null);
          if (storyBus.nodes) storyBus.setNodes(null);
        }
        const hovered = storyBus.hover?.group ?? 0;
        const litA = settledOn === a && hovered ? hovered : pair.aLit;
        const litB = settledOn === b && hovered ? hovered : pair.bLit;

        const look = (d: FrameData, p: Pose, lit: number, out: THREE.Vector4) => {
          const bx = Math.max(Math.abs(d.model.box.x0), Math.abs(d.model.box.x1), Math.abs(d.model.box.y0), Math.abs(d.model.box.y1));
          out.set(d.model.look.size, d.model.look.depth, bx * p.s, lit);
        };
        look(a.data, poseA, litA, uniforms.uLookA.value);
        look(b.data, poseB, litB, uniforms.uLookB.value);
        uniforms.uPulse.value.set(a.frame.pulse ?? 0, b.frame.pulse ?? 0);
        uniforms.uReveal.value.set(pair.aReveal, pair.bReveal);
      }

      // The stars shine at full strength behind the loading screen only.
      const skyStage = shared.uSkyBoost.value;
      uniforms.uSkyStage.value = skyStage;
      ambUniforms.uMorph.value = 1 + 0.7 * (1 - skyStage);

      renderer.render(scene, camera);
    };
    gsap.ticker.add(tick);

    return () => {
      alive = false;
      gsap.ticker.remove(tick);
      stopWaiting();
      stopPage();
      stopTheme();
      if (script) {
        script.tl.scrollTrigger?.kill();
        script.tl.kill();
      }
      storyBus.setOverride(null);
      storyBus.setHover(null);
      storyBus.setNodes(null);
      gsap.killTweensOf([theme, uniforms.uAppear, uniforms.uLoadProgress, uniforms.uLoader, shared.uSkyBoost]);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
      document.removeEventListener("pointerout", onPointerOut);
      window.removeEventListener("resize", onResize);
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={hostRef} aria-hidden className="fixed inset-0 z-0" />;
}

/**
 * How far a stepped frame has revealed its groups, given its step progress
 * (0.55 … steps + 0.45): each step brings in the groups up to its entry in
 * `reveal` over the first part of its stretch of scroll, then holds them
 * there a while to be read. −1: the frame reveals nothing step by step.
 */
function revealAt(f: Frame, progress: number) {
  const r = f.reveal;
  if (!r || !f.steps) return -1;
  const u = Math.max(0, Math.min(f.steps, ((progress - 0.55) / (f.steps - 0.1)) * f.steps));
  const i = Math.min(f.steps - 1, Math.floor(u));
  const p = Math.min(1, (u - i) / 0.85);
  return r[i] + (r[i + 1] - r[i]) * p;
}

/** A frame's fixed lit group (scroll-lit frames start unlit). */
const litOf = (f: Frame) => (typeof f.lit === "number" ? f.lit : 0);
