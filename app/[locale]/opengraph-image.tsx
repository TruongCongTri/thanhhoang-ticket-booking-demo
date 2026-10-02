import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { BRAND } from "@/lib/brand";
import { LOCALES } from "@/lib/i18n";

/**
 * The share card for every page (Zalo, Facebook, X…): the logo on the site's
 * light page, in a field of the particles' triangles — denser toward the
 * edges, clear around the logo.
 */
export const alt = BRAND.name;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** One per language, generated at build time. */
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

/** Deterministic "random" (the same card every build). */
function rand(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}

const COLORS = ["#1f7fd8", "#4fa8ff", "#0a64b8", "#f5a830", "#f07a30"];

export default async function Image() {
  const logo = await readFile(join(process.cwd(), "public", BRAND.logo.src));
  const src = `data:image/png;base64,${logo.toString("base64")}`;
  const r = rand(20131);
  const tris: string[] = [];
  while (tris.length < 170) {
    const x = r() * 1200;
    const y = r() * 630;
    // keep the middle clear for the logo
    if (((x - 600) / 470) ** 2 + ((y - 315) / 230) ** 2 < 1) continue;
    const s = 4 + r() ** 3 * 16;
    const a = r() * Math.PI * 2;
    const pts = [0, 1, 2].map((k) => {
      const t = a + (k * Math.PI * 2) / 3;
      return `${(x + Math.cos(t) * s).toFixed(1)},${(y + Math.sin(t) * s).toFixed(1)}`;
    });
    const c = COLORS[Math.floor(r() * COLORS.length)];
    const o = (0.25 + r() * 0.55).toFixed(2);
    tris.push(`<polygon points="${pts.join(" ")}" fill="${c}" fill-opacity="${o}"/>`);
  }
  const field = `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">${tris.join("")}</svg>`,
  )}`;
  const w = 780;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#f4f6fa", position: "relative" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img> */}
        <img src={field} width={1200} height={630} alt="" style={{ position: "absolute", left: 0, top: 0 }} />
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img> */}
        <img src={src} width={w} height={Math.round((w * BRAND.logo.height) / BRAND.logo.width)} alt="" />
      </div>
    ),
    size,
  );
}
