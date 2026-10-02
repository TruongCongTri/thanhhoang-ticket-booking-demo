import { HOVER } from "../scene/shaders";

/** How much larger a glowing particle's sprite is drawn (BLOOM in scene/shaders.ts). */
const BLOOM = 0.9;

/**
 * The story pages' particles. Unlike the home page — six models fixed in six
 * attribute slots — a story page can have any number of frames: the scene
 * uploads just the two being morphed between (A → B, at uT), whenever the
 * scroll moves on to another pair. Same tetrahedra (scene/shaders.ts'
 * fragment shader), same sizing by depth, hover and loading-screen logo.
 */
export const storyVertexShader = /* glsl */ `
#define PI 3.14159265

uniform float uT;          // 0 at frame A … 1 at frame B
uniform float uStyle;      // 0 sweep · 1 rise · 2 regather · 3 drift (Style in scripts.ts)
uniform mat4 uMVA;         // where each frame stands (model-view)
uniform mat4 uMVB;
uniform vec4 uLookA;       // particle size, depth strength, radius (view units), lit group
uniform vec4 uLookB;
uniform vec2 uPulse;       // groups pulse, per frame
uniform vec2 uReveal;      // per frame: groups 1…n have gathered in, one after another (−1: all shown)
uniform vec2 uSolo;        // per frame: 1 = only the lit group is shown (one partner logo at a time)
uniform float uTime;
uniform float uAppear;
uniform float uLoadProgress;
uniform float uLoader;     // 1 on the loading screen (or gathering from the sky) → 0 once the page runs
uniform mat4 uMVLoader;
uniform vec3 uLogo;        // the loader logo's particle size, depth strength, radius
uniform float uSize;
uniform float uPixelRatio;
uniform float uMaxPoint;
uniform vec2 uViewport;
uniform float uCamZ;
uniform vec2 uMouse;
uniform vec2 uDelta;
uniform vec2 uHalfView;
uniform float uHover;
uniform float uSkyStage;   // 1 = the open sky is the whole show
uniform float uTheme;

attribute vec3 aA;         // frame A, model space
attribute vec3 aB;
attribute vec4 aInfoA;     // in the model?, size factor, tone, group
attribute vec4 aInfoB;
attribute vec3 aColA;      // rgb, for the logo's own colours
attribute vec3 aColB;
attribute float aOrder;    // 0 = first to move in this morph
attribute vec4 aColorRand; // palette colour, random 0..1
attribute vec3 aLoader;    // the loading-screen logo, model space
attribute vec4 aLoaderInfo;// in the logo?, left-to-right order, size factor, colour as r·65536+g·256+b

varying vec3 vColor;
varying float vAlpha;
varying float vSize;
varying float vHover;
varying float vBlur;
varying float vGlow;

float ease(float t) { return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }
vec3 forTheme(vec3 c, float theme) { return mix(c, pow(c, vec3(1.8)) * 0.86, theme); }

float sweep(float x, float order, float spread, float width) {
  float d = order * spread + aColorRand.a * 0.1;
  return ease(smoothstep(d, d + width, x));
}

// The logo's colours: lifted a little on a dark page; true on a light one
// (pre-lightened against the light-theme deepening applied at the end).
vec3 brandColor(vec3 brand) {
  return mix(min(mix(brand, vec3(1.0), 0.1) * 1.25, vec3(1.0)), pow(brand, vec3(1.0 / 1.8)), uTheme);
}

vec3 toneColor(float tone, vec3 col) {
  if (tone < 0.5) return aColorRand.rgb;
  if (tone < 1.5) return vec3(0.961, 0.659, 0.188);
  if (tone < 2.5) return vec3(0.3, 0.66, 1.0);
  if (tone < 3.5) return mix(vec3(0.9, 0.94, 1.0), vec3(0.2, 0.44, 0.7), uTheme);
  if (tone < 4.5) return brandColor(col);
  if (tone < 5.5) return mix(aColorRand.rgb, vec3(0.45, 0.58, 0.76), 0.5) * 0.8;
  if (tone < 6.5) return vec3(0.94, 0.48, 0.19);
  return mix(vec3(0.9, 0.94, 1.0), brandColor(col), uTheme);
}

float depthAt(vec3 p, mat4 mv, float r) {
  return clamp((p.z - (mv * vec4(0.0, 0.0, 0.0, 1.0)).z) / max(r, 0.01), -1.0, 1.0);
}
float tierOf(float d, float k) { return mix(1.0, mix(0.12, 1.0, smoothstep(-1.0, 1.0, d)), k); }
float fadeOf(float d, float k) { return mix(1.0, mix(0.14, 1.0, smoothstep(-1.0, 0.5, d)), k); }

// Solo frames: the lit value with a plateau at each whole group, so one logo
// holds still for most of its step and the next takes over in between.
float soloAt(float l) { return floor(l) + smoothstep(0.4, 0.6, fract(l)); }

// How lit a particle of group g is, with group lit lit (0 = none).
float litOf(float g, float lit) {
  return g > 0.5 && lit > 0.5 ? 1.0 - smoothstep(0.15, 0.8, abs(g - lit)) : 0.0;
}

void main() {
  float rnd = aColorRand.a;
  float jitter = 0.9 + 0.2 * fract(rnd * 17.31);
  float actA = aInfoA.x;
  float actB = aInfoB.x;

  vec3 sky = position + vec3(sin(uTime * 0.12 + rnd * 30.0), cos(uTime * 0.1 + rnd * 17.0), 0.0) * 0.25;
  vec3 skyV = (viewMatrix * vec4(sky, 1.0)).xyz;
  vec3 A = actA > 0.5 ? (uMVA * vec4(aA, 1.0)).xyz : skyV;
  vec3 B = actB > 0.5 ? (uMVB * vec4(aB, 1.0)).xyz : skyV;
  // Shown one by one (the org chart's positions): a group not yet reached
  // waits in the sky as a star, then gathers into place.
  float visA = uReveal.x < 0.0 || aInfoA.w < 0.5 ? 1.0 : ease(clamp(uReveal.x - aInfoA.w + 1.0, 0.0, 1.0));
  float visB = uReveal.y < 0.0 || aInfoB.w < 0.5 ? 1.0 : ease(clamp(uReveal.y - aInfoB.w + 1.0, 0.0, 1.0));
  // Solo: as the lit value moves on from one group to the next, the one
  // leaving dissolves into the sky and the next gathers in its place.
  // Each logo holds for most of its step; the hand-over happens in the middle fifth.
  if (uSolo.x > 0.5 && aInfoA.w > 0.5) visA *= 1.0 - smoothstep(0.25, 0.75, abs(aInfoA.w - soloAt(uLookA.w)));
  if (uSolo.y > 0.5 && aInfoB.w > 0.5) visB *= 1.0 - smoothstep(0.25, 0.75, abs(aInfoB.w - soloAt(uLookB.w)));
  A = mix(skyV, A, visA);
  B = mix(skyV, B, visB);

  vec3 view;
  float t;
  if (uStyle < 0.5) {
    // side by side: the leading edge goes first, the rest follows across
    t = sweep(uT, aOrder, 0.5, 0.4);
    view = mix(A, B, t);
    float arc = sin(t * PI);
    view.y += arc * (0.3 + rnd * 0.5);
    view.z += arc * (0.5 + rnd * 0.9);
  } else if (uStyle < 1.5) {
    // gathers up from below, bottom first
    t = sweep(uT, aOrder, 0.45, 0.45);
    view = mix(A, B, t);
    float arc = sin(t * PI);
    view.y -= arc * (0.7 + rnd * 1.4);
    view.z += arc * (0.3 + rnd * 0.9);
  } else if (uStyle < 2.5) {
    // spreads out in every direction, then regathers
    t = sweep(uT, aOrder, 0.3, 0.6);
    view = mix(A, B, t);
    float arc = sin(t * PI);
    vec3 dir = normalize(vec3(fract(rnd * 13.71), fract(rnd * 29.37), fract(rnd * 5.17)) - 0.5 + 1e-4);
    view += dir * arc * (0.7 + 1.5 * fract(rnd * 3.31));
  } else {
    // a slow glide, keeping its shape
    t = sweep(uT, aOrder, 0.25, 0.65);
    view = mix(A, B, t);
    view.z += sin(t * PI) * (0.2 + rnd * 0.4);
  }

  float model = mix(actA * visA, actB * visB, t);

  float gA = aInfoA.w;
  float gB = aInfoB.w;
  float litA = litOf(gA, uLookA.w) * actA;
  float litB = litOf(gB, uLookB.w) * actB;
  // while one group is lit, the others step back
  float dimA = uLookA.w > 0.5 && gA > 0.5 ? mix(0.42, 1.0, litA) : 1.0;
  float dimB = uLookB.w > 0.5 && gB > 0.5 ? mix(0.42, 1.0, litB) : 1.0;
  float pulseA = gA > 0.5 ? 1.0 + uPulse.x * 0.24 * sin(uTime * 1.6 + gA * 1.9) : 1.0;
  float pulseB = gB > 0.5 ? 1.0 + uPulse.y * 0.24 * sin(uTime * 1.6 + gB * 1.9) : 1.0;

  float dA = actA > 0.5 ? depthAt(A, uMVA, uLookA.z) : 0.0;
  float dB = actB > 0.5 ? depthAt(B, uMVB, uLookB.z) : 0.0;
  float kA = actA > 0.5 ? uLookA.y : 0.0;
  float kB = actB > 0.5 ? uLookB.y : 0.0;
  float szA = actA > 0.5 ? aInfoA.y * uLookA.x * tierOf(dA, kA) * pulseA * (1.0 + 0.6 * litA) : 1.0;
  float szB = actB > 0.5 ? aInfoB.y * uLookB.x * tierOf(dB, kB) * pulseB * (1.0 + 0.6 * litB) : 1.0;
  float sizeK = mix(mix(1.0, szA, visA), mix(1.0, szB, visB), t);
  float fade = mix(fadeOf(dA, kA) * dimA, fadeOf(dB, kB) * dimB, t);
  // lit: the logo's yellow — on a light page fully, so it deepens to amber rather than olive
  vec3 lit = mix(vec3(1.0, 0.78, 0.3), vec3(1.0, 0.62, 0.12), uTheme);
  float litMix = mix(0.6, 0.92, uTheme);
  // (a solo frame's logo is the highlight itself: it keeps its own colours)
  vec3 colA = actA > 0.5 ? mix(toneColor(aInfoA.z, aColA), lit, litMix * litA * (1.0 - uSolo.x)) : aColorRand.rgb;
  vec3 colB = actB > 0.5 ? mix(toneColor(aInfoB.z, aColB), lit, litMix * litB * (1.0 - uSolo.y)) : aColorRand.rgb;
  vec3 color = mix(mix(aColorRand.rgb, colA, visA), mix(aColorRand.rgb, colB, visB), t);
  float glowAmt = mix(litA * visA, litB * visB, t) * 0.55;

  vec3 wob = vec3(
    sin(rnd * 91.7 + uTime * 0.7),
    cos(rnd * 57.3 + uTime * 0.6),
    sin(rnd * 33.1 - uTime * 0.5)
  ) * 0.02;
  view += wob;

  // Loading screen (or, arriving from another page, the open sky): the logo
  // draws itself left to right as the page loads; when the page starts,
  // every particle leaves it for wherever the scroll wants it.
  float lo = aLoaderInfo.y;
  float formed = aLoaderInfo.x * ease(smoothstep(lo * 0.8, lo * 0.8 + 0.2, uLoadProgress));
  vec3 logoV = (uMVLoader * vec4(aLoader, 1.0)).xyz;
  vec3 loaderV = mix(skyV, logoV, formed) + wob;
  float releaseAt = mix(rnd * 0.4, lo * 0.4 + rnd * 0.1, aLoaderInfo.x);
  float release = ease(smoothstep(releaseAt, releaseAt + 0.5, 1.0 - uLoader));
  float hold = 1.0 - release;
  view = mix(view, loaderV, hold);
  view.z += sin(release * PI) * (0.6 + rnd * 1.8) * max(formed, model);
  float dL = depthAt(logoV, uMVLoader, uLogo.z);
  model = mix(model, formed, hold);
  sizeK = mix(sizeK, mix(1.0, uLogo.x * aLoaderInfo.z * tierOf(dL, uLogo.y), formed), hold);
  fade = mix(fade, mix(1.0, fadeOf(dL, uLogo.y), formed), hold);
  float c = aLoaderInfo.w;
  vec3 brand = vec3(floor(c / 65536.0), floor(mod(c, 65536.0) / 256.0), mod(c, 256.0)) / 255.0;
  color = mix(color, brandColor(brand), formed * hold);
  glowAmt *= release;

  // Hover — only on a formed model: particles within reach circle their spot,
  // get dragged along by the pointer, grow and fade to grey.
  vec4 clip0 = projectionMatrix * vec4(view, 1.0);
  vec2 ndc = clip0.xy / clip0.w;
  float reach = ${HOVER.radius.toFixed(3)} + abs(max(uDelta.x, uDelta.y)) * ${HOVER.scale.toFixed(3)};
  float hover = (1.0 - smoothstep(0.0, reach, length((ndc - uMouse) * uHalfView))) * uHover * model;
  // a lit group (an org chart box under the pointer) keeps its colour and shape
  hover *= 1.0 - min(1.0, glowAmt * 2.0);
  float freq = 0.2 + 0.8 * fract(rnd * 7.13);
  float amp = 0.5 + 0.5 * fract(rnd * 3.71);
  view.x += hover * sin(uTime * freq) * (amp * 0.35 + uDelta.x) * ${HOVER.scale.toFixed(3)};
  view.y += hover * cos(uTime * freq) * (amp * 0.35 + uDelta.y) * ${HOVER.scale.toFixed(3)};

  gl_Position = projectionMatrix * vec4(view, 1.0);

  float persp = uCamZ / max(-view.z, 0.5);
  float perspK = mix(clamp(persp, 0.16, 18.0), clamp(persp, 0.35, 2.2), model);
  float size = uSize * uPixelRatio * jitter * perspK * sizeK * (1.0 + hover * ${HOVER.grow.toFixed(3)});
  float ps = clamp(size, 1.2 * uPixelRatio, uMaxPoint) * (1.0 + ${BLOOM.toFixed(2)} * glowAmt);
  gl_PointSize = ps;
  vSize = ps;

  float blur = (1.0 - model) * smoothstep(1.4, 3.0, persp);
  float farDim = mix(1.0, mix(0.5, 1.0, smoothstep(0.14, 0.7, persp)), 1.0 - model);
  float passing = smoothstep(0.3, 1.1, -view.z);
  vec2 toEdge = (1.0 - abs(gl_Position.xy / max(gl_Position.w, 0.001))) * uViewport * 0.5;
  float atEdge = smoothstep(0.0, ps * 0.5, min(toEdge.x, toEdge.y));
  float twinkle = 0.8 + 0.2 * sin(uTime * (1.2 + (1.0 - model) * 1.4) + rnd * 40.0);
  vAlpha = twinkle * fade * farDim * (1.0 - 0.45 * blur) * uAppear * mix(mix(0.3, 1.0, uSkyStage), 1.0, model)
    * passing * atEdge;
  if (vAlpha < 0.004) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
  }
  vBlur = blur;
  vColor = forTheme(color, uTheme);
  vAlpha = min(1.0, vAlpha * (1.0 + uTheme * (0.25 * model - 0.3 * (1.0 - model))));
  vHover = hover;
  vGlow = glowAmt;
}
`;
