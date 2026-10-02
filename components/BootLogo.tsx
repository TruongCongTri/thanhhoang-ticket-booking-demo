import { BRAND } from "@/lib/brand";

/**
 * The very first paint: the company logo, as plain HTML, exactly where the
 * particle logo of the loading screen draws itself. It holds the screen
 * while the 3D scene's chunk downloads (otherwise the page is black until
 * then), and fades as the particles take over (html[data-particles], set by
 * the scenes) or the page starts. Server-rendered, no JavaScript of its own.
 */
export default function BootLogo() {
  return (
    <div aria-hidden className="boot-logo">
      {/* eslint-disable-next-line @next/next/no-img-element -- must be in the HTML itself, not lazy */}
      <img src={BRAND.logo.src} width={BRAND.logo.width} height={BRAND.logo.height} alt="" fetchPriority="high" />
    </div>
  );
}
