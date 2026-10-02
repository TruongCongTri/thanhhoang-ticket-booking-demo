"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import geoData from "./geo-data.json";
import { ARCHIPELAGO_LABELS } from "./routes";
import {
  CAMERA_FOV,
  CAMERA_Z,
  GLOBE_FACING_LAT,
  GLOBE_RADIUS,
  GLOBE_SPIN_FROM,
  LOGO_W,
  PLANE_RADIUS,
  buildAmbient,
  mapPoint,
  startParticles,
  type GeoData,
  type LogoPixels,
  type ParticleData,
} from "./shapes";
import { fragmentShader, skyVertexShader, vertexShader } from "./shaders";
import { virgoFit } from "./virgo";
import { BRAND } from "@/lib/brand";
import { LOAD, onPageStart } from "@/lib/loading";
import { currentTheme, onThemeChange } from "@/lib/theme";

gsap.registerPlugin(ScrollTrigger);

/** Where a model stands on screen. */
type Pose = { x: number; y: number; rx: number; ry: number; rz: number; s: number };
type Poses = Record<"loader" | "hero" | "noseIn" | "mapCenter" | "mapLeft" | "ticket" | "globe" | "logo", Pose>;

/** Viewports of scroll per story section — keep in sync with the stage height in app/page.tsx (h-[150svh]). */
const SECTION_VH = 1.5;
const STAGES = 7;
/** Timeline length in sections: from the first section's top to the story's end. */
const END = (STAGES * SECTION_VH - 1) / SECTION_VH;

/** Half the visible height at z = 0. */
const HALF_H = CAMERA_Z * Math.tan(((CAMERA_FOV / 2) * Math.PI) / 180);
const GLOBE_RX = (GLOBE_FACING_LAT * Math.PI) / 180;

/**
 * Particle size per model (plane, map, globe, ticket), and how strongly depth
 * sizes them — the plane gently, so its tail at the far end stays visible.
 * (The plane is also sized by how its surface faces the viewer, the globe by
 * the height of the land; these sizes are the average they work around.)
 */
const MODEL_SIZE = new THREE.Vector4(1.15, 0.8, 1, 0.4);
const MODEL_DEPTH = new THREE.Vector4(0.55, 0, 1, 0);
const LOGO_SIZE = 0.55;
const LOGO_DEPTH = 0.35;

/**
 * How far the nearest stars stream toward the viewer (world units; further
 * out, less — see FLOW_SCALE in shaders.ts): as the loading screen lifts, and
 * over the open-sky chapters, from the plane bursting to the map gathered.
 * By the end the sky has streamed past the screen from about 17 units out;
 * all the way, a star or two is right at the screen and a handful close by.
 */
const TRAVEL = { loader: 3, spread: 27 };

// The company logo at the end of the page. The loading screen shows the very
// same logo (same size, so it reads the same), just centred.
// It sits between the header and the footer (with its contact details) at the end of the page.
const DESKTOP_LOGO: Pose = { x: 0, y: 1.75, rx: 0.06, ry: 0, rz: 0, s: 0.88 };

const DESKTOP: Poses = {
  loader: { ...DESKTOP_LOGO, y: 0.15 },
  // about three-quarters of the screen
  hero: { x: 2.0, y: -0.3, rx: 0.28, ry: -2.45, rz: 0.1, s: 2.0 },
  // nose (+X in model space) turned to face the camera
  noseIn: { x: 0, y: -0.25, rx: 0.1, ry: -Math.PI / 2, rz: 0, s: 1.7 },
  // tipped back a little, so the raised provinces visibly hover over it
  mapCenter: { x: 0, y: -0.1, rx: -0.3, ry: 0, rz: 0, s: 1.2 },
  mapLeft: { x: -4.3, y: -0.1, rx: -0.34, ry: 0.2, rz: 0, s: 1.22 },
  // a big globe across about three-quarters of the screen, on the right of
  // the international routes; Vietnam on its left, the Pacific rim beyond
  globe: { x: 3.4, y: -0.1, rx: GLOBE_RX, ry: 0, rz: 0, s: 1.34 },
  // turned toward the copy on its right
  ticket: { x: -3.2, y: 0, rx: 0.08, ry: 0.32, rz: 0, s: 1.05 },
  logo: DESKTOP_LOGO,
};

/** Phones and tablets (narrower than this): every model centred, filling the screen, with the copy over it. */
const COMPACT_QUERY = "(max-width: 1023px)";

/**
 * The map's full extent in model units, Hoàng Sa and Trường Sa included (and
 * room for the raised provinces): x from the western border to the
 * easternmost islands, y from the southern islands to the northern tip.
 */
const MAP_BOX = { x0: -1.75, x1: 4.6, y0: -4.15, y1: 3.6 };

/**
 * Poses for phones and tablets, fitted to the screen's shape (width / height)
 * rather than fixed: centred, and as large as the screen allows. Model sizes
 * are in model units: the 747 spans 6.6 wingtip to wingtip and 7.3 long; the
 * map (with both archipelagos) MAP_BOX; the globe 8 across; the boarding
 * pass 7.2 × 3; the logo 9 × 3.8.
 */
function compactPoses(aspect: number): Poses {
  const H = HALF_H * 2; // visible height at the models' depth
  const W = H * aspect; // visible width
  const logoS = Math.min((0.9 * W) / 9, 0.9);
  // the whole map, archipelagos included, centred
  const mapS = Math.min((0.84 * H) / (MAP_BOX.y1 - MAP_BOX.y0), (0.94 * W) / (MAP_BOX.x1 - MAP_BOX.x0));
  const map: Pose = {
    ...DESKTOP.mapCenter,
    x: (-(MAP_BOX.x0 + MAP_BOX.x1) / 2) * mapS,
    y: (-(MAP_BOX.y0 + MAP_BOX.y1) / 2) * mapS,
    s: mapS,
  };
  const logo: Pose = { ...DESKTOP_LOGO, y: HALF_H - 1 - 1.89 * logoS, s: logoS }; // just under the header
  return {
    loader: { ...logo, y: 0.3 },
    // seen a little from above so the wings read; wing tips just past the edges
    hero: { x: 0, y: 0.2, rx: 0.5, ry: -2.3, rz: 0.12, s: Math.min(W / 6.2, (0.8 * H) / 5) },
    noseIn: { ...DESKTOP.noseIn, y: 0, s: Math.min((0.96 * W) / 6.6, (0.8 * H) / 5) },
    mapCenter: map,
    mapLeft: { ...map, ry: 0.12 },
    // a touch wider than the screen
    globe: { ...DESKTOP.globe, x: 0, y: 0, s: Math.min((1.06 * W) / 8, (0.95 * H) / 8) },
    // the right way up, turned a little to the right
    ticket: { x: 0, y: 0, rx: 0.08, ry: 0.26, rz: 0, s: Math.min((0.88 * W) / 7.2, (0.8 * H) / 3) },
    logo,
  };
}

/**
 * Scroll script, in sections: section k's top meets the top of the screen at
 * k, and a centred block of its copy passes the middle of the screen at
 * about k + 0.17 (where a #link to it lands). Text never stops — each change
 * plays out while the copy scrolls, in step with it.
 * Sections: 0 hero · 1 Live inventory · 2 Direct APIs · 3 domestic · 4 international · 5 ticket · 6 logo.
 * Morph: 0 plane · 1 open sky · 2 Vietnam · 3 globe · 4 ticket · 5 logo.
 */
const SCRIPT = {
  turnToCenter: [0.05, 0.55], // plane swings to centre, nose at the viewer
  dissolve: [0.4, 1.2], // plane scatters into the open sky, bottom to top
  gatherMap: [1.3, 2.14], // Vietnam gathers out of it, bottom to top
  mapToLeft: [2.25, 3.0],
  toGlobe: [3.22, 4.12], // map (left) morphs into the globe (right), right side first
  globeSpin: [3.3, 4.12], // the globe turns to rest (Vietnam on the left) by the time its copy is centred
  toTicket: [4.36, 5.14], // globe (right) morphs into the ticket (left), left side first
  toLogo: [5.3, 6.28], // ticket morphs into the company logo, drawn left to right
} as const;

/** One tetrahedron, apex up; every particle shares its orientation. */
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
const TET_TILT = 0.42; // lean toward the viewer so the base reads
const TET_SPIN = 0.35; // rad/s about the particle's own Y axis
const LIGHT = new THREE.Vector3(-0.35, 0.75, 0.55).normalize();

/** The logo image as pixels, at the resolution the particles are printed from. */
async function loadLogoPixels(): Promise<LogoPixels | null> {
  try {
    const img = new Image();
    img.src = BRAND.logo.src; // the company logo the particles draw at the end of the page
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
    return null; // the finale simply stays a starfield
  }
}

/** Tells the loader how far along the scene is (0..1), and when it can play. */
const report = (p: number) => window.dispatchEvent(new CustomEvent(LOAD.progress, { detail: p }));
const ready = () => {
  document.documentElement.setAttribute("data-scene-ready", "");
  window.dispatchEvent(new Event(LOAD.ready));
};

/** `labels`: the archipelago names shown over the map, in the page's language. */
export default function Scene({ labels }: { labels?: readonly string[] }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    } catch {
      ready(); // no WebGL: the page still works on plain black
      return;
    }

    const small = window.matchMedia("(max-width: 767px)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let alive = true;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    // The page's background, per theme; the particles recolour to match (uTheme).
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

    const uniforms = {
      uMorph: { value: 0 },
      uTime: { value: 0 },
      uAppear: { value: 0 }, // the constellation fades in once built
      uLoadProgress: { value: 0 }, // the loading-screen logo draws itself with it
      uLoader: { value: 1 }, // 1 on the loading screen → 0 once the page runs
      uMVLoader: { value: new THREE.Matrix4() },
      uTravel: { value: 0 }, // the fly-through (shared with the ambient field)
      uSize: { value: small ? 11 : 13 },
      uPixelRatio: { value: renderer.getPixelRatio() },
      // the GPU's limit, and never more than ~300 CSS px (a particle right at the viewer)
      uMaxPoint: { value: Math.min(maxPoint, 300 * renderer.getPixelRatio()) },
      uViewport: { value: renderer.getDrawingBufferSize(new THREE.Vector2()) },
      uCamZ: { value: CAMERA_Z },
      uOpacity: { value: 1 },
      // where each model stands (model-view matrices), refreshed every frame
      uMV0: { value: new THREE.Matrix4() },
      uMV2: { value: new THREE.Matrix4() },
      uMV3: { value: new THREE.Matrix4() }, // globe
      uMV4: { value: new THREE.Matrix4() }, // boarding pass
      uMV5: { value: new THREE.Matrix4() },
      uModelSize: { value: MODEL_SIZE },
      uModelDepth: { value: MODEL_DEPTH },
      uModelR: { value: new THREE.Vector4(1, 1, 1, 1) },
      uLogo: { value: new THREE.Vector3(LOGO_SIZE, LOGO_DEPTH, 1) },
      // pointer (shared with the ambient field, which ignores it)
      uMouse: { value: new THREE.Vector2() },
      uDelta: { value: new THREE.Vector2() },
      uHalfView: { value: new THREE.Vector2(HALF_H * camera.aspect, HALF_H) },
      uHover: { value: 0 },
      uSkyBoost: { value: 1 }, // full-strength sky behind the loading screen
      uTheme: { value: startLight }, // 0 dark page, 1 light page (shared with the ambient field)
      uMotion: { value: reduced ? 0 : 1 }, // flight-line pulses; off for reduced motion
      // tetrahedron orientation (shared)
      uTet: { value: TET.map(() => new THREE.Vector3()) },
      uFace: { value: new THREE.Vector4() },
      uFill: { value: 0.22 },
    };
    // Normal (not additive) blending: overlapping particles keep their colour.
    const makeMaterial = (u: typeof uniforms) =>
      new THREE.ShaderMaterial({ uniforms: u, vertexShader, fragmentShader, transparent: true, depthWrite: false });

    /* ---- the background: a deep field and Virgo — up at once: it's the loading screen's backdrop ---- */
    const amb = buildAmbient(small ? 450 : 900);
    const ambGeo = new THREE.BufferGeometry();
    ambGeo.setAttribute("position", new THREE.BufferAttribute(amb.pos, 3));
    ambGeo.setAttribute("aColorRand", new THREE.BufferAttribute(amb.colorRand, 4));
    ambGeo.setAttribute("aStar", new THREE.BufferAttribute(amb.star, 4));
    const ambUniforms = {
      ...uniforms,
      uAppear: { value: 1 },
      uOpacity: { value: 1 },
      uFieldOpacity: { value: 0.55 + 0.2 * startLight }, // the deep field: a little stronger on a light page
      uSize: { value: small ? 9 : 10 },
      uPixelRatio: { value: renderer.getPixelRatio() },
      uVirgo: { value: new THREE.Vector4() },
      uVirgoOffset: { value: new THREE.Vector2() },
    };
    /** Fits Virgo to the screen's shape: wide across a landscape screen, upright on a portrait one. */
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

    /* ---- the constellation: built in the background while the loader shows ---- */
    const disposables: { dispose(): void }[] = [ambGeo, ambMaterial];
    /** Adds the particles; returns a function that re-uploads their data after phase two fills it in. */
    const addConstellation = (data: ParticleData) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(data.slots[1], 3));
      data.slots.forEach((s, i) => geo.setAttribute(`aP${i}`, new THREE.BufferAttribute(s, 3)));
      geo.setAttribute("aActive", new THREE.BufferAttribute(data.active, 4));
      geo.setAttribute("aShapeSize", new THREE.BufferAttribute(data.shapeSize, 4));
      geo.setAttribute("aOrder", new THREE.BufferAttribute(data.order, 4));
      geo.setAttribute("aLogo", new THREE.BufferAttribute(data.logo, 4));
      geo.setAttribute("aColorRand", new THREE.BufferAttribute(data.colorRand, 4));
      geo.setAttribute("aNormal", new THREE.BufferAttribute(data.normal, 3));
      const material = makeMaterial(uniforms);
      const points = new THREE.Points(geo, material);
      points.frustumCulled = false;
      scene.add(points);
      disposables.push(geo, material);
      return () => Object.values(geo.attributes).forEach((a) => ((a as THREE.BufferAttribute).needsUpdate = true));
    };

    /** Load progress drives the logo drawing itself (and anyone listening). */
    const progress = (p: number) => {
      gsap.to(uniforms.uLoadProgress, { value: p, duration: 0.7, ease: "power2.out", overwrite: true });
      report(p);
    };

    /* ---- scroll choreography: one morph value, plus each model's own pose ---- */
    const morph = { v: 0 };
    const flight = { v: 0 }; // scroll's share of the fly-through
    const aspectNow = () => window.innerWidth / window.innerHeight;
    const P0 = window.matchMedia(COMPACT_QUERY).matches ? compactPoses(aspectNow()) : DESKTOP;
    const loader = { ...P0.loader };
    const plane = { ...P0.hero };
    const map = { ...P0.mapCenter };
    const ticket = { ...P0.ticket };
    const globe = { ...P0.globe, spin: GLOBE_SPIN_FROM };
    const logo = { ...P0.logo };
    const mm = gsap.matchMedia();
    let builtAspect = aspectNow();
    let choreographed = false;
    const choreograph = () =>
      mm.add({ compact: COMPACT_QUERY, wide: "(min-width: 1024px)" }, (ctx) => {
        builtAspect = aspectNow();
        const P = ctx.conditions?.compact ? compactPoses(builtAspect) : DESKTOP;
        Object.assign(loader, P.loader);
        Object.assign(plane, P.hero);
        Object.assign(map, P.mapCenter);
        Object.assign(ticket, P.ticket);
        Object.assign(globe, P.globe, { spin: GLOBE_SPIN_FROM });
        Object.assign(logo, P.logo);
        morph.v = 0;
        flight.v = 0;
        // Scrub with no lag of its own: Lenis already smooths the scroll, so
        // the 3D moves exactly with the text.
        const tl = gsap.timeline({
          defaults: { ease: "sine.inOut", immediateRender: false },
          scrollTrigger: { trigger: "#story", start: "top top", end: "bottom bottom", scrub: true },
        });
        type Span = readonly [number, number];
        // Morph runs linearly so each sweep maps evenly onto scroll.
        const step = (from: number, to: number, [a, b]: Span) =>
          tl.fromTo(morph, { v: from }, { v: to, duration: b - a, ease: "none" }, a);
        const move = <T extends object>(target: T, from: T, to: T, [a, b]: Span) =>
          tl.fromTo(target, { ...from }, { ...to, duration: b - a }, a);

        move(plane, P.hero, P.noseIn, SCRIPT.turnToCenter);
        step(0, 1, SCRIPT.dissolve);
        // From the plane bursting to the map gathered, fly on through the sky:
        // the near stars stream up to the screen and past it, steadily with the scroll.
        tl.fromTo(
          flight,
          { v: 0 },
          { v: TRAVEL.spread, duration: SCRIPT.gatherMap[1] - SCRIPT.dissolve[0], ease: "none" },
          SCRIPT.dissolve[0],
        );
        step(1, 2, SCRIPT.gatherMap);
        move(map, P.mapCenter, P.mapLeft, SCRIPT.mapToLeft);
        step(2, 3, SCRIPT.toGlobe);
        tl.fromTo(
          globe,
          { spin: GLOBE_SPIN_FROM },
          { spin: 0, duration: SCRIPT.globeSpin[1] - SCRIPT.globeSpin[0], ease: "sine.inOut" },
          SCRIPT.globeSpin[0],
        );
        step(3, 4, SCRIPT.toTicket);
        step(4, 5, SCRIPT.toLogo);
        tl.set({}, {}, END);
      });

    // Phase one (the logo and the sky) puts the loading screen up; phase two
    // builds the other models behind it while the logo draws itself. Then we
    // hand over to the page — it jumps to any #section before telling us to go.
    (async () => {
      try {
        const logoPixels = await loadLogoPixels();
        if (!alive) return;
        const build = await startParticles(small ? 3800 : 6500, logoPixels);
        if (!alive) return;
        const refresh = addConstellation(build.data);
        gsap.to(uniforms.uAppear, { value: 1, duration: 0.8, ease: "power1.out" });
        progress(0.15);
        await build.complete(geoData as GeoData, (p) => {
          if (alive) progress(0.15 + p * 0.85);
        });
        if (!alive) return;
        refresh();
        choreograph();
        choreographed = true;
      } catch (err) {
        console.error(err);
      }
      if (alive) ready();
    })();

    // Once the page starts, every particle leaves the logo for wherever the
    // scroll position wants it: morphing into the plane on a fresh load (or
    // the model of the #section the link pointed to), or spreading into the
    // sky for the open-sky sections.
    // Theme switches: background and particle colours cross-fade together.
    const theme = { v: startLight };
    const stopTheme = onThemeChange((next) => {
      gsap.to(theme, {
        v: next === "light" ? 1 : 0,
        duration: reduced ? 0 : 0.6,
        ease: "power2.inOut",
        overwrite: true,
        onUpdate: () => {
          uniforms.uTheme.value = theme.v;
          ambUniforms.uFieldOpacity.value = 0.55 + 0.2 * theme.v;
          renderer.setClearColor(clear.lerpColors(BG.dark, BG.light, theme.v), 1);
        },
      });
    });

    const stopWaiting = onPageStart(() => {
      if (reduced) {
        uniforms.uLoadProgress.value = 1;
        uniforms.uLoader.value = 0;
        uniforms.uSkyBoost.value = 0;
        return;
      }
      gsap.to(uniforms.uLoadProgress, { value: 1, duration: 0.4, ease: "power2.out", overwrite: true });
      gsap.to(uniforms.uLoader, { value: 0, duration: 2.8, ease: "power2.inOut", delay: 0.45 });
      gsap.to(uniforms.uSkyBoost, { value: 0, duration: 2.6, ease: "power2.inOut", delay: 0.9 });
    });

    /* ---- pointer: eased position + a decaying velocity, as on the reference ---- */
    const mouse = { x: 0, y: 0, px: 0, py: 0, dx: 0, dy: 0, present: 0 };
    const toNdc = (e: PointerEvent) => [2 * (e.clientX / window.innerWidth - 0.5), -2 * (e.clientY / window.innerHeight - 0.5)];
    const onPointerMove = (e: PointerEvent) => {
      const [x, y] = toNdc(e);
      const lim = e.pointerType === "touch" ? 0.1 : 2;
      mouse.dx = THREE.MathUtils.clamp(50 * (x - mouse.px), -lim, lim);
      mouse.dy = THREE.MathUtils.clamp(50 * (y - mouse.py), -lim, lim);
      mouse.x = mouse.px = x;
      mouse.y = mouse.py = y;
      mouse.present = 1;
    };
    const onPointerDown = (e: PointerEvent) => {
      const [x, y] = toNdc(e);
      mouse.x = mouse.px = x;
      mouse.y = mouse.py = y;
      mouse.dx = mouse.dy = 0;
      mouse.present = 1;
    };
    const onPointerEnd = (e: PointerEvent) => {
      if (e.pointerType === "touch") mouse.present = 0;
    };
    const onPointerOut = (e: PointerEvent) => {
      if (e.relatedTarget) return;
      mouse.present = 0; // left the window
      mouse.dx = mouse.dy = 0;
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
      uniforms.uPixelRatio.value = ambUniforms.uPixelRatio.value = renderer.getPixelRatio();
      renderer.getDrawingBufferSize(uniforms.uViewport.value);
      // Phones and tablets size their models to the screen's shape: refit when
      // it really changes (a rotation) — not for the address bar sliding away.
      window.clearTimeout(refit);
      refit = window.setTimeout(() => {
        const a = aspectNow();
        if (!choreographed || !window.matchMedia(COMPACT_QUERY).matches) return;
        if (Math.abs(a - builtAspect) / builtAspect < 0.15) return;
        mm.revert();
        choreograph();
        ScrollTrigger.refresh();
      }, 250);
    };
    let refit = 0;
    window.addEventListener("resize", onResize);

    /* ---- per-frame tetrahedron orientation (shared by every particle) ---- */
    const tetEuler = new THREE.Euler();
    const tetQuat = new THREE.Quaternion();
    const corners = TET.map(() => new THREE.Vector3());
    const ab = new THREE.Vector3();
    const ac = new THREE.Vector3();
    const n = new THREE.Vector3();
    const centroid = new THREE.Vector3();
    const faceShade = [0, 0, 0, 0];
    const updateTetra = (time: number) => {
      tetEuler.set(TET_TILT, reduced ? 0.6 : time * TET_SPIN, 0); // spin about its own Y, then lean
      tetQuat.setFromEuler(tetEuler);
      corners.forEach((c, i) => {
        c.copy(TET[i]).applyQuaternion(tetQuat);
        uniforms.uTet.value[i].set(c.x * 0.8, c.y * 0.8, c.z);
      });
      FACES.forEach(([a, b, c], i) => {
        ab.subVectors(corners[b], corners[a]);
        ac.subVectors(corners[c], corners[a]);
        n.crossVectors(ab, ac).normalize();
        centroid.copy(corners[a]).add(corners[b]).add(corners[c]);
        if (n.dot(centroid) < 0) n.negate(); // outward
        faceShade[i] = n.z > 0 ? 0.35 + 0.65 * Math.max(0, n.dot(LIGHT)) : 0;
      });
      uniforms.uFace.value.set(faceShade[0], faceShade[1], faceShade[2], faceShade[3]);
    };

    /* ---- per-frame model placement ---- */
    const eased = { x: 0, y: 0 };
    const tPos = new THREE.Vector3();
    const tEuler = new THREE.Euler();
    const tQuat = new THREE.Quaternion();
    const tScale = new THREE.Vector3();
    const worldMap = new THREE.Matrix4();
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

    /* ---- archipelago names, pinned to the map as it moves ---- */
    const labels = ARCHIPELAGO_LABELS.map((l) => mapPoint(l.lon, l.lat));
    const labelPos = new THREE.Vector3();
    const updateLabels = (m: number) => {
      // shown once the map has formed (and the particles have arrived);
      // gone as its right side starts to morph
      const formed = m <= 2 ? THREE.MathUtils.smoothstep(m, 1.8, 2) : 1 - THREE.MathUtils.smoothstep(m, 2, 2.15);
      const shown = formed * THREE.MathUtils.smoothstep(1 - uniforms.uLoader.value, 0.7, 1);
      labels.forEach(([x, y], i) => {
        const el = labelRefs.current[i];
        if (!el) return;
        el.style.opacity = shown.toFixed(3);
        if (shown < 0.001) return;
        labelPos.set(x, y, 0).applyMatrix4(worldMap).project(camera);
        const sx = (labelPos.x * 0.5 + 0.5) * window.innerWidth;
        const sy = (-labelPos.y * 0.5 + 0.5) * window.innerHeight;
        el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -50%)`;
      });
    };

    /* ---- render loop on GSAP's ticker so it stays in step with ScrollTrigger ---- */
    const rate = (perFrame: number, dt: number) => 1 - Math.pow(1 - perFrame, dt * 60);

    const tick = (time: number, deltaMs: number) => {
      const dt = Math.min(deltaMs / 1000, 0.1);
      const m = morph.v;
      uniforms.uTime.value = time;
      uniforms.uMorph.value = m;
      // The fly-through starts when the loading screen lifts, so a #section
      // that's already scrolled into the open sky gets its full rush then.
      uniforms.uTravel.value = (TRAVEL.loader + flight.v) * (1 - uniforms.uLoader.value);
      updateTetra(time);

      // Pointer, eased like the reference: position 7.5%/frame, velocity
      // decays 10%/frame and is itself eased 7.5%/frame.
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

      place(plane, uniforms.uMV0.value, time);
      place(map, uniforms.uMV2.value, time);
      place(globe, uniforms.uMV3.value, time, globe.spin);
      place(ticket, uniforms.uMV4.value, time);
      // the logo sways gently, so its curve reads in 3D — on the loading screen too
      const sway = reduced ? 0 : Math.sin(time * 0.45) * 0.16;
      place(logo, uniforms.uMV5.value, time, sway);
      place(loader, uniforms.uMVLoader.value, time, sway);
      uniforms.uModelR.value.set(PLANE_RADIUS * plane.s, 1, GLOBE_RADIUS * globe.s, 1);
      uniforms.uLogo.value.z = (LOGO_W / 2) * logo.s;

      worldOf(map, worldMap, time);
      updateLabels(m);

      renderer.render(scene, camera);
    };
    gsap.ticker.add(tick);

    return () => {
      alive = false;
      gsap.ticker.remove(tick);
      stopWaiting();
      stopTheme();
      gsap.killTweensOf(theme);
      mm.revert();
      gsap.killTweensOf([uniforms.uAppear, uniforms.uLoadProgress, uniforms.uLoader, uniforms.uSkyBoost]);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
      document.removeEventListener("pointerout", onPointerOut);
      window.removeEventListener("resize", onResize);
      window.clearTimeout(refit);
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <>
      <div ref={hostRef} aria-hidden className="fixed inset-0 z-0" />
      <div aria-hidden className="pointer-events-none fixed inset-0 z-5 overflow-hidden">
        {ARCHIPELAGO_LABELS.map((l, i) => (
          <span
            key={l.text}
            ref={(el) => {
              labelRefs.current[i] = el;
            }}
            className="map-label"
          >
            {labels?.[i] ?? l.text}
          </span>
        ))}
      </div>
    </>
  );
}
