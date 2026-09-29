/** Hover tuning, in world units at the focal plane (z = 0). */
export const HOVER = {
  radius: 1.95, // reach of the effect around the cursor
  scale: 1.57, // converts pointer-speed and wobble units to this scene's scale
  grow: 0.9, // extra size right under the cursor
};

/**
 * Particles that leave a model for the open sky (or join one from it) by
 * flying straight at the viewer and past the screen — the largest
 * tetrahedra of all as they go by.
 */
const PASS = {
  share: 0.025, // of all particles
  reach: 0.45, // how wide of the viewer's eye they pass, view units
  behind: 2.5, // where they head for, behind the viewer
  end: 0.85, // share of the move spent flying past; then they turn up as a star
};

/**
 * The fly-through: as a model bursts into the open sky, the nearer stars
 * stream toward the viewer (by uTravel, world units) — fully within `near`
 * of the viewer, not at all beyond `far`, so the deep sky stays put.
 */
const FLOW ={ near: 4, far: 28 };

export const vertexShader = /* glsl */ `
#define PI 3.14159265
#define PASS_SHARE ${PASS.share.toFixed(3)}
#define PASS_REACH ${PASS.reach.toFixed(3)}
#define PASS_BEHIND ${PASS.behind.toFixed(3)}
#define PASS_END ${PASS.end.toFixed(3)}
#define FLOW_NEAR ${FLOW.near.toFixed(3)}
#define FLOW_FAR ${FLOW.far.toFixed(3)}

uniform float uMorph;      // 0 plane · 1 open sky · 2 Vietnam · 3 globe · 4 boarding pass · 5 logo
uniform float uTime;
uniform float uAppear;       // fades the constellation in once it's first built
uniform float uLoadProgress; // page-load progress 0..1 — the loading-screen logo draws itself with it
uniform float uLoader;       // 1 while the loading screen is up, 0 once the page runs
uniform mat4 uMVLoader;      // where the logo stands on the loading screen
uniform float uTravel;       // fly-through: how far the nearer stars have streamed toward the viewer
uniform float uSize;       // px at the focal plane
uniform float uPixelRatio;
uniform float uMaxPoint;   // the GPU's largest point size, px
uniform vec2 uViewport;    // drawing-buffer size, px
uniform float uCamZ;
// Each model has its own place on screen (model-view matrices), so during a
// side-by-side morph both are drawn where they stand.
uniform mat4 uMV0;         // plane
uniform mat4 uMV2;         // Vietnam
uniform mat4 uMV3;         // globe
uniform mat4 uMV4;         // boarding pass
uniform mat4 uMV5;         // company logo
uniform vec4 uModelSize;   // particle size per model (plane, map, globe, ticket)
uniform vec4 uModelDepth;  // how strongly depth sets size, per model
uniform vec4 uModelR;      // model radius in view units, per model
uniform vec3 uLogo;        // the logo's particle size, depth strength, radius
uniform vec2 uMouse;       // eased pointer, NDC
uniform vec2 uDelta;       // eased pointer velocity
uniform vec2 uHalfView;    // half the view size at the focal plane, world units
uniform float uHover;      // pointer presence 0..1
uniform float uSkyBoost;   // 1 while the loading screen is up: the sky shines at full strength
uniform float uTheme;      // 0 dark page, 1 light page: colours deepen so they read on white

attribute vec3 aP0; // plane (model space)
attribute vec3 aP1; // deep sky (WORLD space)
attribute vec3 aP2; // Vietnam (model space)
attribute vec3 aP3; // globe (model space)
attribute vec3 aP4; // boarding pass (model space)
attribute vec3 aP5; // company logo (model space)
// Packed tight to stay well within the GPU's vertex-attribute limit.
attribute vec4 aActive;    // part of plane / map / globe / ticket? otherwise it waits as a star
attribute vec4 aShapeSize; // size factor in plane / map / globe / ticket; negative = accent colour
attribute vec4 aOrder;     // timings: plane scatter, map gather, map→globe sweep, globe→ticket sweep
attribute vec4 aLogo;      // in the logo?, ticket→logo timing, size factor, colour as r·65536+g·256+b
attribute vec4 aColorRand; // palette colour, random 0..1

varying vec3 vColor;
varying float vAlpha;
varying float vSize;
varying float vHover;
varying float vBlur;

// Smootherstep: starts and stops without a jolt, so each particle glides.
float ease(float t) { return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }

// Per-model value from a vec4 (plane, map, globe, ticket); the sky (1) is never a model.
float pick(vec4 v, float s) {
  if (s < 0.5) return v.x;
  if (s < 1.5) return 0.0;
  if (s < 2.5) return v.y;
  if (s < 3.5) return v.z;
  return v.w;
}

float activeOf(float s) { return s > 4.5 ? aLogo.x : pick(aActive, s); }
float shapeSizeOf(float s) { return s > 4.5 ? aLogo.z : abs(pick(aShapeSize, s)); }
float accentOf(float s) { return s > 4.5 ? 0.0 : (pick(aShapeSize, s) < 0.0 ? 1.0 : 0.0); }
float modelSizeOf(float s) { return s > 4.5 ? uLogo.x : pick(uModelSize, s); }
float depthKOf(float s) { return s > 4.5 ? uLogo.y : pick(uModelDepth, s); }
float radiusOf(float s) { return s > 4.5 ? uLogo.z : pick(uModelR, s); }

mat4 mvOf(float s) {
  if (s < 0.5) return uMV0;
  if (s < 2.5) return uMV2;
  if (s < 3.5) return uMV3;
  if (s < 4.5) return uMV4;
  return uMV5;
}

vec3 modelPos(float s) {
  if (s < 0.5) return aP0;
  if (s < 2.5) return aP2;
  if (s < 3.5) return aP3;
  if (s < 4.5) return aP4;
  return aP5;
}

vec3 centerOf(mat4 mv) { return (mv * vec4(0.0, 0.0, 0.0, 1.0)).xyz; }

// The particle's colour while part of model s: the logo's own colours there,
// saffron for flight lines, otherwise its palette colour.
vec3 colorOf(float s) {
  if (s > 4.5) {
    float c = aLogo.w;
    vec3 brand = vec3(floor(c / 65536.0), floor(mod(c, 65536.0) / 256.0), mod(c, 256.0)) / 255.0;
    // Dark page: lifted a little (deep blue reads dim on black). Light page: the
    // logo's own colours — pre-lightened by the inverse of the light-theme
    // deepening applied at the end, so they come out true.
    return mix(min(mix(brand, vec3(1.0), 0.1) * 1.25, vec3(1.0)), pow(brand, vec3(1.0 / 1.8)), uTheme);
  }
  return mix(aColorRand.rgb, vec3(0.961, 0.659, 0.188), accentOf(s));
}

// This particle's share of a sweep; x is the phase progress 0..1.
float sweep(float x, float order, float spread, float width) {
  float d = order * spread + aColorRand.a * 0.1;
  return ease(smoothstep(d, d + width, x));
}

// Where p sits within a model standing at mv, of radius r: -1 far side … +1 the side facing you.
float depthAt(vec3 p, mat4 mv, float r) {
  return clamp((p.z - centerOf(mv).z) / r, -1.0, 1.0);
}
float depthIn(vec3 p, float s) { return depthAt(p, mvOf(s), radiusOf(s)); }

// Depth tiers for the 3D models (k = strength): the far side small and dimmer, the near side larger.
float tierOf(float d, float k) { return mix(1.0, mix(0.12, 1.0, smoothstep(-1.0, 1.0, d)), k); }
float fadeOf(float d, float k) { return mix(1.0, mix(0.14, 1.0, smoothstep(-1.0, 0.5, d)), k); }

// Where a passer heads for, just behind the viewer: on its way there from p
// it flies outward on screen (away from the model's centre c) and passes
// the screen within PASS_REACH of the viewer's eye.
vec3 passBy(vec3 p, vec3 c) {
  float rnd = aColorRand.a;
  vec2 away = p.xy - c.xy + (vec2(fract(rnd * 13.71), fract(rnd * 29.37)) - 0.5) * 0.6;
  vec2 e = normalize(away + 1e-4) * PASS_REACH * (0.25 + 0.75 * fract(rnd * 5.17));
  float k = PASS_BEHIND / max(-p.z, 0.5);
  return vec3(-p.xy * k + e * (1.0 + k), PASS_BEHIND);
}

void main() {
  float rnd = aColorRand.a;
  float jitter = 0.9 + 0.2 * fract(rnd * 17.31); // size comes from depth, not randomness
  bool passer = fract(rnd * 71.37) < PASS_SHARE;
  float idx = min(floor(uMorph), 5.0);
  float f = uMorph - idx;
  float next = min(idx + 1.0, 5.0);
  float actA = activeOf(idx);
  float actB = activeOf(next);

  vec3 sky = aP1 + vec3(sin(uTime * 0.12 + rnd * 30.0), cos(uTime * 0.1 + rnd * 17.0), 0.0) * 0.25;
  vec3 skyV = (viewMatrix * vec4(sky, 1.0)).xyz;
  // The fly-through: as the models burst, the nearer stars stream toward the
  // viewer and on past the screen; the deep sky stays where it is.
  skyV.z += uTravel * (1.0 - smoothstep(FLOW_NEAR, FLOW_FAR, -skyV.z));
  vec3 A = actA > 0.5 ? (mvOf(idx) * vec4(modelPos(idx), 1.0)).xyz : skyV;
  vec3 B = actB > 0.5 ? (mvOf(next) * vec4(modelPos(next), 1.0)).xyz : skyV;

  vec3 view;
  float t; // 0 at A -> 1 at B
  float shown = 1.0; // a passer is gone once past the viewer, until it turns up as a star
  if (idx < 0.5) {
    // Plane -> open sky, scattering from the belly up to the fin. The burst
    // swells toward the viewer, and a few particles fly right past the screen.
    t = sweep(f, aOrder.x, 0.45, 0.45);
    if (passer && actA > 0.5) {
      view = t < PASS_END ? mix(A, passBy(A, centerOf(uMV0)), t / PASS_END) : B;
      shown = t < PASS_END ? 1.0 : smoothstep(PASS_END, 1.0, t);
    } else {
      view = mix(A, B, t);
      float arc = sin(t * PI) * actA;
      view.y += arc * (0.4 + rnd * 0.9);
      view.z += arc * (0.5 + rnd * 1.5);
    }
  } else if (idx < 1.5) {
    // Open sky -> Vietnam, gathering from Cà Mau up to Hà Giang; a few come
    // in from behind the viewer, past the screen.
    t = sweep(f, aOrder.y, 0.45, 0.45);
    float lead = 1.0 - PASS_END;
    if (passer && actB > 0.5) {
      view = t > lead ? mix(passBy(B, centerOf(uMV2)), B, (t - lead) / PASS_END) : A;
      shown = t > lead ? 1.0 : 1.0 - smoothstep(0.0, lead, t);
    } else {
      view = mix(A, B, t);
      float arc = sin(t * PI) * actB;
      view.y -= arc * (0.3 + rnd * 0.6);
      view.z += arc * (0.5 + rnd * 1.5);
    }
  } else if (idx < 4.5) {
    // Neighbouring models morph straight into each other, sweeping across:
    // the side facing the way they travel goes first, so mid-way you see
    // one model's remaining half beside the other's finished half.
    float o = idx < 2.5 ? aOrder.z : (idx < 3.5 ? aOrder.w : aLogo.y);
    t = sweep(f, o, 0.5, 0.4);
    view = mix(A, B, t);
    float arc = sin(t * PI);
    view.y += arc * (0.3 + rnd * 0.5);
    view.z += arc * (0.5 + rnd * 0.9);
  } else {
    t = 1.0; // resting on the logo
    view = B;
  }

  float model = mix(actA, actB, t); // 1 = part of a model, 0 = a star

  // Size and look, blended from where it came from to where it's going.
  float dA = actA > 0.5 ? depthIn(A, idx) : 0.0;
  float dB = actB > 0.5 ? depthIn(B, next) : 0.0;
  float kA = actA > 0.5 ? depthKOf(idx) : 0.0;
  float kB = actB > 0.5 ? depthKOf(next) : 0.0;
  float szA = actA > 0.5 ? shapeSizeOf(idx) * modelSizeOf(idx) * tierOf(dA, kA) : 1.0;
  float szB = actB > 0.5 ? shapeSizeOf(next) * modelSizeOf(next) * tierOf(dB, kB) : 1.0;
  float sizeK = mix(szA, szB, t);
  float fade = mix(fadeOf(dA, kA), fadeOf(dB, kB), t);
  vec3 color = mix(actA > 0.5 ? colorOf(idx) : aColorRand.rgb, actB > 0.5 ? colorOf(next) : aColorRand.rgb, t);

  // Stars shine brightest when the open sky is the whole show.
  float skyStage = idx < 0.5 ? smoothstep(0.3, 1.0, f) : (idx < 1.5 ? 1.0 - smoothstep(0.0, 0.7, f) : 0.0);
  skyStage = max(skyStage, uSkyBoost);

  vec3 wob = vec3(
    sin(rnd * 91.7 + uTime * 0.7),
    cos(rnd * 57.3 + uTime * 0.6),
    sin(rnd * 33.1 - uTime * 0.5)
  ) * 0.02;
  view += wob;

  // Loading screen: the company logo draws itself out of the stars, left to
  // right, as the page loads — just as the finale draws it (same shimmer,
  // same depth shading). When the page starts, every particle leaves it for
  // wherever the page wants it: morphing into a model (the plane, or a
  // #section's model), or spreading into the sky — the burst swelling
  // toward the viewer, a few flying right past the screen.
  float lo = aLogo.y; // 0 = the logo's left edge
  float formed = aLogo.x * ease(smoothstep(lo * 0.8, lo * 0.8 + 0.2, uLoadProgress));
  vec3 logoV = (uMVLoader * vec4(aP5, 1.0)).xyz;
  vec3 loaderV = mix(skyV, logoV, formed) + wob;
  float releaseAt = mix(rnd * 0.4, lo * 0.4 + rnd * 0.1, aLogo.x);
  float release = ease(smoothstep(releaseAt, releaseAt + 0.5, 1.0 - uLoader));
  float hold = 1.0 - release;
  if (passer && formed > 0.5 && model < 0.5) {
    view = release < PASS_END ? mix(loaderV, passBy(loaderV, centerOf(uMVLoader)), release / PASS_END) : view;
    shown *= release < PASS_END ? 1.0 : smoothstep(PASS_END, 1.0, release);
  } else {
    view = mix(view, loaderV, hold);
    view.z += sin(release * PI) * (0.6 + rnd * 1.8) * formed;
  }
  float dL = depthAt(logoV, uMVLoader, uLogo.z);
  model = mix(model, formed, hold);
  sizeK = mix(sizeK, mix(1.0, uLogo.x * aLogo.z * tierOf(dL, uLogo.y), formed), hold);
  fade = mix(fade, mix(1.0, fadeOf(dL, uLogo.y), formed), hold);
  color = mix(color, colorOf(5.0), formed * hold);

  // Hover — only on a formed model, never on the open sky or the stars
  // behind a model: particles within reach circle their spot, get dragged
  // along by the pointer's motion, grow and fade to grey. The reach widens
  // with pointer speed.
  vec4 clip0 = projectionMatrix * vec4(view, 1.0);
  vec2 ndc = clip0.xy / clip0.w;
  float reach = ${HOVER.radius.toFixed(3)} + abs(max(uDelta.x, uDelta.y)) * ${HOVER.scale.toFixed(3)};
  float hover = (1.0 - smoothstep(0.0, reach, length((ndc - uMouse) * uHalfView))) * uHover * model;
  float freq = 0.2 + 0.8 * fract(rnd * 7.13);
  float amp = 0.5 + 0.5 * fract(rnd * 3.71);
  view.x += hover * sin(uTime * freq) * (amp * 0.35 + uDelta.x) * ${HOVER.scale.toFixed(3)};
  view.y += hover * cos(uTime * freq) * (amp * 0.35 + uDelta.y) * ${HOVER.scale.toFixed(3)};

  gl_Position = projectionMatrix * vec4(view, 1.0);

  // Perspective: stars keep the full range — distant ones are specks, those
  // passing close by the viewer the largest of all; models get a tamer version.
  float persp = uCamZ / max(-view.z, 0.5);
  float perspK = mix(clamp(persp, 0.14, 18.0), clamp(persp, 0.35, 2.2), model);
  float size = uSize * uPixelRatio * jitter * perspK * sizeK * (1.0 + hover * ${HOVER.grow.toFixed(3)});
  float ps = clamp(size, 1.2 * uPixelRatio, uMaxPoint);
  gl_PointSize = ps;
  vSize = ps;

  // Depth of field: the nearest stars go soft, the farthest dim. Right at the
  // viewer a particle fades as it passes, and a big one fades out at the
  // frame's edge rather than popping when its centre leaves the frame.
  float blur = (1.0 - model) * smoothstep(1.4, 3.0, persp);
  float farDim = mix(1.0, mix(0.5, 1.0, smoothstep(0.14, 0.6, persp)), 1.0 - model);
  float passing = smoothstep(0.3, 1.1, -view.z);
  vec2 toEdge = (1.0 - abs(gl_Position.xy / max(gl_Position.w, 0.001))) * uViewport * 0.5;
  float atEdge = smoothstep(0.0, ps * 0.5, min(toEdge.x, toEdge.y));
  float twinkle = 0.8 + 0.2 * sin(uTime * (1.2 + (1.0 - model) * 1.4) + rnd * 40.0);
  vAlpha = twinkle * fade * farDim * (1.0 - 0.45 * blur) * uAppear * mix(mix(0.3, 1.0, skyStage), 1.0, model)
    * shown * passing * atEdge;
  // Nothing to draw (say, a big particle right at the viewer, faded out):
  // skip it rather than fill a huge sprite with discarded pixels.
  if (vAlpha < 0.004) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
  }
  vBlur = blur;
  // On a light page, pale blues and the logo's yellow would wash out: deepen
  // and saturate every colour (the gamma curve darkens light tints most).
  // Models show a touch more; the stars behind a touch less, so the sky stays
  // quiet behind the copy.
  vColor = mix(color, pow(color, vec3(1.8)) * 0.86, uTheme);
  vAlpha = min(1.0, vAlpha * (1.0 + uTheme * (0.25 * model - 0.3 * (1.0 - model))));
  vHover = hover;
}
`;

/**
 * Each particle is a small tetrahedron. They all share one orientation —
 * apex up, slowly turning about their own Y axis — so the corners and the
 * face shading come in as uniforms computed once per frame on the CPU.
 */
export const fragmentShader = /* glsl */ `
uniform float uOpacity;
uniform vec3 uTet[4]; // corners in sprite space (xy) + depth (z), after spin and tilt
uniform vec4 uFace;   // brightness of faces 012, 023, 031, 123; 0 when facing away
uniform float uFill;  // face opacity (edges are always drawn)

varying vec3 vColor;
varying float vAlpha;
varying float vSize;
varying float vHover;
varying float vBlur;

float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

float side(vec2 p, vec2 a, vec2 b) {
  return (p.x - b.x) * (a.y - b.y) - (a.x - b.x) * (p.y - b.y);
}

float inside(vec2 p, vec2 a, vec2 b, vec2 c) {
  float d1 = side(p, a, b);
  float d2 = side(p, b, c);
  float d3 = side(p, c, a);
  bool neg = d1 < 0.0 || d2 < 0.0 || d3 < 0.0;
  bool pos = d1 > 0.0 || d2 > 0.0 || d3 > 0.0;
  return (neg && pos) ? 0.0 : 1.0;
}

void main() {
  vec2 uv = gl_PointCoord * 2.0 - 1.0;
  uv.y = -uv.y;

  float pxUnit = vSize * 0.5; // px per sprite unit
  // Out-of-focus stars get soft edges — the bigger (nearer) the softer.
  float stroke = clamp(vSize * 0.05, 0.55, 1.3) + vBlur * vSize * 0.004;
  float aa = 0.5 + vBlur * (2.0 + vSize * 0.012);

  // Edges: back edges dimmer, so the solid reads in depth.
  float edge = 0.0;
  vec2 v[4];
  v[0] = uTet[0].xy; v[1] = uTet[1].xy; v[2] = uTet[2].xy; v[3] = uTet[3].xy;
  float z[4];
  z[0] = uTet[0].z; z[1] = uTet[1].z; z[2] = uTet[2].z; z[3] = uTet[3].z;
  #define EDGE(i, j) edge = max(edge, (1.0 - smoothstep(stroke - aa, stroke + aa, segDist(uv, v[i], v[j]) * pxUnit)) * mix(0.35, 1.0, clamp((z[i] + z[j]) * 0.3 + 0.5, 0.0, 1.0)));
  EDGE(0, 1) EDGE(0, 2) EDGE(0, 3) EDGE(1, 2) EDGE(2, 3) EDGE(3, 1)

  // Faces toward the viewer, softly shaded.
  float shade = 0.0;
  shade = max(shade, uFace.x * inside(uv, v[0], v[1], v[2]));
  shade = max(shade, uFace.y * inside(uv, v[0], v[2], v[3]));
  shade = max(shade, uFace.z * inside(uv, v[0], v[3], v[1]));
  shade = max(shade, uFace.w * inside(uv, v[1], v[2], v[3]));

  float a = max(edge, step(0.001, shade) * uFill * (1.0 - 0.5 * vBlur));
  if (a < 0.02) discard;

  vec3 col = mix(vColor, vec3(0.585), vHover); // hovered particles fade to grey
  vec3 rgb = col * mix(shade, 1.0, edge);
  gl_FragColor = vec4(rgb, a * vAlpha * uOpacity);
}
`;
