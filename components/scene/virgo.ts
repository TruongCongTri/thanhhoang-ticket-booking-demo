/**
 * The background sky: the constellation Virgo, where it really is — its main
 * stars, the stick figure joining them, the bright stars of its neighbours
 * and, beyond, the galaxies of the Virgo Cluster. Positions are J2000 right
 * ascension / declination (degrees); `ly` is the distance in light years,
 * which sets each star's depth in the scene.
 */

type Spectral = "B" | "A" | "F" | "G" | "K" | "M";
export type CatalogStar = { id: string; ra: number; dec: number; mag: number; ly: number; type: Spectral };

/** Star colours by spectral type, drawn from the logo's blues, white, yellow and orange. */
export const SPECTRAL: Record<Spectral, string> = {
  B: "#9fd0ff",
  A: "#e3efff",
  F: "#fff1cf",
  G: "#ffd27a",
  K: "#f5a830",
  M: "#f07a30",
};

/** Virgo's main stars, in the order they light up: from Spica up the body to the head, then the arm and the legs. */
export const VIRGO: CatalogStar[] = [
  { id: "α Spica", ra: 201.298, dec: -11.161, mag: 0.97, ly: 250, type: "B" },
  { id: "θ", ra: 197.487, dec: -5.539, mag: 4.38, ly: 415, type: "A" },
  { id: "γ Porrima", ra: 190.415, dec: -1.449, mag: 2.74, ly: 38, type: "F" },
  { id: "η Zaniah", ra: 184.976, dec: -0.667, mag: 3.89, ly: 260, type: "A" },
  { id: "β Zavijava", ra: 177.674, dec: 1.765, mag: 3.61, ly: 36, type: "F" },
  { id: "ν", ra: 176.465, dec: 6.529, mag: 4.04, ly: 298, type: "M" },
  { id: "ο", ra: 181.302, dec: 8.733, mag: 4.12, ly: 171, type: "G" },
  { id: "δ Minelauva", ra: 193.901, dec: 3.398, mag: 3.38, ly: 202, type: "M" },
  { id: "ε Vindemiatrix", ra: 195.544, dec: 10.959, mag: 2.79, ly: 110, type: "G" },
  { id: "ζ Heze", ra: 203.673, dec: -0.596, mag: 3.37, ly: 73, type: "A" },
  { id: "τ", ra: 210.412, dec: 1.545, mag: 4.26, ly: 210, type: "A" },
  { id: "109", ra: 221.562, dec: 1.893, mag: 3.72, ly: 129, type: "A" },
  { id: "ι Syrma", ra: 214.004, dec: -6.001, mag: 4.08, ly: 72, type: "F" },
  { id: "μ", ra: 220.765, dec: -5.658, mag: 3.88, ly: 61, type: "F" },
  { id: "κ", ra: 213.224, dec: -10.274, mag: 4.19, ly: 255, type: "K" },
  { id: "λ Khambalia", ra: 214.778, dec: -13.371, mag: 4.52, ly: 187, type: "A" },
];

/** The stick figure, as pairs of indices into VIRGO. */
export const VIRGO_LINES: [number, number][] = [
  [0, 1], // Spica – θ
  [1, 2], // θ – Porrima
  [2, 3], // Porrima – Zaniah
  [3, 4], // Zaniah – Zavijava
  [4, 5], // Zavijava – ν
  [5, 6], // ν – ο
  [2, 7], // Porrima – Minelauva
  [7, 8], // Minelauva – Vindemiatrix
  [7, 9], // Minelauva – Heze
  [9, 10], // Heze – τ
  [10, 11], // τ – 109
  [9, 12], // Heze – Syrma
  [12, 13], // Syrma – μ
  [12, 14], // Syrma – κ
  [14, 15], // κ – Khambalia
];

/** The bright stars around Virgo: Boötes, Leo, Corvus, Libra, Coma Berenices, Crater. */
export const NEIGHBOURS: CatalogStar[] = [
  { id: "Arcturus", ra: 213.915, dec: 19.182, mag: -0.05, ly: 37, type: "K" },
  { id: "Muphrid", ra: 208.671, dec: 18.398, mag: 2.68, ly: 37, type: "G" },
  { id: "Denebola", ra: 177.265, dec: 14.572, mag: 2.13, ly: 36, type: "A" },
  { id: "Zosma", ra: 168.527, dec: 20.524, mag: 2.56, ly: 58, type: "A" },
  { id: "Gienah", ra: 183.952, dec: -17.542, mag: 2.59, ly: 154, type: "B" },
  { id: "Algorab", ra: 187.466, dec: -16.515, mag: 2.94, ly: 87, type: "A" },
  { id: "Kraz", ra: 188.597, dec: -23.397, mag: 2.65, ly: 140, type: "G" },
  { id: "Minkar", ra: 182.531, dec: -22.62, mag: 3.0, ly: 300, type: "K" },
  { id: "Alchiba", ra: 182.103, dec: -24.729, mag: 4.02, ly: 49, type: "F" },
  { id: "Zubeneschamali", ra: 229.252, dec: -9.383, mag: 2.61, ly: 185, type: "B" },
  { id: "Zubenelgenubi", ra: 222.72, dec: -16.042, mag: 2.75, ly: 76, type: "A" },
  { id: "Diadem", ra: 197.497, dec: 17.529, mag: 4.32, ly: 58, type: "F" },
  { id: "δ Crateris", ra: 169.835, dec: -14.779, mag: 3.56, ly: 163, type: "K" },
];

/** The Virgo Cluster: its Messier galaxies (RA, Dec), around M87; fainter members are scattered about them. */
export const VIRGO_CLUSTER: [number, number][] = [
  [186.265, 12.887], // M84
  [186.549, 12.946], // M86
  [187.706, 12.391], // M87
  [188.916, 12.556], // M89
  [189.208, 13.163], // M90
  [189.431, 11.818], // M58
  [190.51, 11.647], // M59
  [190.917, 11.553], // M60
  [187.445, 8.0], // M49
  [185.479, 4.474], // M61
  [187.997, 14.421], // M88
  [188.86, 14.496], // M91
  [183.451, 14.9], // M98
  [184.707, 14.416], // M99
  [185.729, 15.823], // M100
  [186.35, 18.191], // M85
];
export const CLUSTER_CENTER: [number, number] = [187.7, 12.4];

/* ---- the sequence: stars light up one by one, the figure holds, then fades ---- */

/** Seconds per round of the sequence. */
export const VIRGO_CYCLE = 30;
/** When star i lights up (seconds into the round). */
export const virgoOn = (i: number) => 1.2 + i * 0.9;
/** The lit figure holds until HOLD, then fades out by FADE; the rest of the round is quiet. */
export const VIRGO_HOLD = 20.5;
export const VIRGO_FADE = 23.5;

/* ---- projection ---- */

const D2R = Math.PI / 180;
/** The middle of Virgo; the projection is centred here. */
const CENTER = { ra: 199, dec: -1 };

/**
 * Gnomonic projection onto the plane tangent at Virgo's centre: what a camera
 * pointed there sees, in tangent units (tan of the angle off-centre). East is
 * on the left, as on any chart of the sky seen from the ground.
 */
export function project(ra: number, dec: number): [number, number] {
  const a = (ra - CENTER.ra) * D2R;
  const d = dec * D2R;
  const d0 = CENTER.dec * D2R;
  const cosC = Math.sin(d0) * Math.sin(d) + Math.cos(d0) * Math.cos(d) * Math.cos(a);
  const xi = (Math.cos(d) * Math.sin(a)) / cosC;
  const eta = (Math.cos(d0) * Math.sin(d) - Math.sin(d0) * Math.cos(d) * Math.cos(a)) / cosC;
  return [-xi, eta];
}

/** Depth in the scene for a star this many light years away: nearer stars sit nearer, all of them behind the models. */
export function depthFor(ly: number) {
  const t = (Math.log(ly) - Math.log(30)) / (Math.log(420) - Math.log(30));
  return 22 + Math.min(1, Math.max(0, t)) * 56;
}

/**
 * How the constellation sits on a screen of this aspect (width / height):
 * the turn (on a portrait screen it stands upright, so it can be large),
 * the scale from sky tangent units to camera tangent units, and the offset
 * that centres it. `T` is tan(half the vertical field of view).
 */
export function virgoFit(aspect: number, T: number) {
  const portrait = aspect < 0.85;
  const turn = portrait ? -Math.PI / 2 : -0.06;
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  const pts = VIRGO.map((s) => {
    const [x, y] = project(s.ra, s.dec);
    return [x * cos - y * sin, x * sin + y * cos];
  });
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
  const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  const ex = (Math.max(...xs) - Math.min(...xs)) / 2;
  const ey = (Math.max(...ys) - Math.min(...ys)) / 2;
  // Share of the frame Virgo spans: room left around it for its neighbours.
  const [fx, fy] = portrait ? [0.84, 0.66] : [0.62, 0.5];
  const k = Math.min((fx * T * aspect) / ex, (fy * T) / ey);
  return { k, cos, sin, ox: -k * cx, oy: -k * cy + 0.05 * T };
}
