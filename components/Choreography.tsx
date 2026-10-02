"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import Lenis from "lenis";
import { LOAD } from "@/lib/loading";
import { hasLocale, intlLocale } from "@/lib/i18n";
import { HALT_SCROLL, SCROLL_TO, isSeamless } from "@/components/story/bus";

gsap.registerPlugin(ScrollTrigger, SplitText);

/**
 * The loading screen stays up at least this long (ms since navigation), so the
 * particle logo is seen drawing itself rather than flashing past.
 */
const MIN_LOADER_MS = 2200;

/**
 * …and at most this long: on a slow connection the 3D scene (its own chunk,
 * the biggest download) may still be on its way. The page starts without it
 * — copy, booking dock and all — and the particles gather in when they land.
 */
const MAX_LOADER_MS = 4000;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Gentle in, gentle out — for jumps between sections. */
const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;

/**
 * Wires the DOM-side motion: smooth (Lenis) scrolling, the start of the page
 * once the 3D scene is ready (jumping to any #section first), masked line
 * reveals for [data-split], fades for [data-fade], counters for [data-count],
 * and the stage progress rail. Elements with the value "hero" play when the
 * page starts instead of on scroll.
 */
export default function Choreography({
  wheel = 0.7,
  lerp = 0.055,
}: {
  /** Scroll per wheel notch (Lenis' wheelMultiplier); touch scales with it. */
  wheel?: number;
  /** How quickly the smoothed scroll catches up, per frame (Lenis' lerp). */
  lerp?: number;
} = {}) {
  useEffect(() => {
    const html = document.documentElement;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Inertial scrolling, driven by GSAP's ticker so ScrollTrigger and the
    // WebGL scene read the same scroll position every frame — soft and a
    // little slow, so the morphs glide. Paused while the loading screen is up.
    let lenis: Lenis | null = null;
    const raf = (time: number) => lenis?.raf(time * 1000);
    if (!reduced) {
      lenis = new Lenis({ lerp, wheelMultiplier: wheel, touchMultiplier: 0.9 * (wheel / 0.7) });
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add(raf);
      gsap.ticker.lagSmoothing(0);
      if (html.hasAttribute("data-loading")) lenis.stop();
    }

    // Where a #section lands: its scroll-margin (set per stage) centres its copy.
    const anchorY = (el: HTMLElement) =>
      el.getBoundingClientRect().top + window.scrollY - (parseFloat(getComputedStyle(el).scrollMarginTop) || 0);
    // Jumps take longer the further they go (2–4.5 s), eased in and out, so
    // every morph on the way plays out rather than flashing past.
    const scrollToY = (y: number, immediate: boolean, fixed?: number) => {
      const sections = Math.abs(y - window.scrollY) / (1.5 * window.innerHeight);
      const duration = fixed ?? Math.min(4.5, 2 + sections * 0.6);
      if (lenis) lenis.scrollTo(y, { immediate, force: true, duration, easing: easeInOutSine });
      else window.scrollTo({ top: y, behavior: immediate ? "instant" : "smooth" });
    };
    const onAnchorClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.('a[href^="#"]');
      const id = link ? decodeURIComponent(link.getAttribute("href")!.slice(1)) : "";
      const target = id ? document.getElementById(id) : null;
      if (!target) return;
      e.preventDefault();
      history.replaceState(null, "", `#${id}`);
      scrollToY(anchorY(target), false);
    };
    document.addEventListener("click", onAnchorClick);
    // A story page hand-off is completing: hold the page where it is.
    const halt = () => lenis?.stop();
    window.addEventListener(HALT_SCROLL, halt);
    // A click on a step (story pages): glide straight there, briskly.
    const onScrollTo = (e: Event) => {
      const { y, duration } = (e as CustomEvent<{ y: number; duration?: number }>).detail;
      scrollToY(y, false, duration);
    };
    window.addEventListener(SCROLL_TO, onScrollTo);

    const ctx = gsap.context(() => {
      if (!reduced) {
        gsap.utils.toArray<HTMLElement>("[data-split]:not([data-split='hero'])").forEach((el) => {
          SplitText.create(el, {
            type: "lines",
            mask: "lines",
            autoSplit: true,
            onSplit: (self) =>
              gsap.from(self.lines, {
                yPercent: 115,
                duration: 1.4,
                stagger: 0.1,
                ease: "expo.out",
                scrollTrigger: { trigger: el, start: "top 88%", toggleActions: "play none none reverse" },
              }),
          });
        });

        gsap.utils.toArray<HTMLElement>("[data-fade]:not([data-fade='hero'])").forEach((el) => {
          gsap.from(el, {
            autoAlpha: 0,
            y: 28,
            duration: 1.2,
            ease: "power3.out",
            delay: Number(el.dataset.delay ?? 0.25),
            scrollTrigger: { trigger: el, start: "top 88%", toggleActions: "play none none reverse" },
          });
        });

        const lang = html.lang;
        const numbers = hasLocale(lang) ? intlLocale(lang) : "en-GB";
        gsap.utils.toArray<HTMLElement>("[data-count]").forEach((el) => {
          const end = Number(el.dataset.count);
          const suffix = el.dataset.suffix ?? "";
          const n = { v: 0 };
          el.textContent = `0${suffix}`;
          gsap.to(n, {
            v: end,
            duration: 1.8,
            ease: "power2.out",
            scrollTrigger: { trigger: el, start: "top 85%" },
            onUpdate: () => {
              el.textContent = `${Math.round(n.v).toLocaleString(numbers)}${suffix}`;
            },
          });
        });
      }

      const dots = gsap.utils.toArray<HTMLElement>("[data-dot]");
      const counter = document.querySelector("[data-counter]");
      gsap.utils.toArray<HTMLElement>("[data-stage]").forEach((stage, i) => {
        ScrollTrigger.create({
          trigger: stage,
          start: "top center",
          end: "bottom center",
          onToggle: (self) => {
            if (!self.isActive) return;
            dots.forEach((d, j) => d.toggleAttribute("data-active", i === j));
            if (counter) counter.textContent = String(i + 1).padStart(2, "0");
            // The address follows along (no history entries, no jump): the
            // first section is the page itself, every other its #section.
            if (html.hasAttribute("data-loading")) return;
            const hash = i === 0 ? "" : `#${stage.id}`;
            if (window.location.hash !== hash) {
              history.replaceState(history.state, "", `${window.location.pathname}${window.location.search}${hash}`);
            }
          },
        });
      });
    });

    /** The hero copy's entrance, once the loading screen lifts. */
    // Skipped after a story hand-off: the hero is already on screen, drawn in place.
    const seamless = isSeamless();
    const revealHero = () =>
      ctx.add(() => {
        if (reduced || seamless) return;
        gsap.utils.toArray<HTMLElement>("[data-split='hero']").forEach((el) => {
          SplitText.create(el, {
            type: "lines",
            mask: "lines",
            autoSplit: true,
            onSplit: (self) =>
              gsap.from(self.lines, { yPercent: 115, duration: 1.4, stagger: 0.1, ease: "expo.out", delay: 0.35 }),
          });
        });
        gsap.utils.toArray<HTMLElement>("[data-fade='hero']").forEach((el) => {
          gsap.from(el, {
            autoAlpha: 0,
            y: 28,
            duration: 1.2,
            ease: "power3.out",
            delay: 0.35 + Number(el.dataset.delay ?? 0.25),
          });
        });
      });

    // Start the page once the scene has built its particles: jump to the
    // #section in the URL (or keep a restored scroll position), then lift the
    // loading screen — the particles gather into whatever that spot shows.
    let started = false;
    const begin = async () => {
      if (started) return;
      started = true;
      await Promise.race([document.fonts?.ready, delay(1500)]);
      const wait = MIN_LOADER_MS - performance.now();
      if (wait > 0) await delay(wait);
      const id = decodeURIComponent(window.location.hash.slice(1));
      const target = id ? document.getElementById(id) : null;
      ScrollTrigger.refresh();
      scrollToY(target ? anchorY(target) : window.scrollY, true);
      ScrollTrigger.update();
      html.removeAttribute("data-loading");
      lenis?.start();
      window.dispatchEvent(new Event(LOAD.start));
      revealHero();
    };
    if (html.hasAttribute("data-scene-ready")) begin();
    else window.addEventListener(LOAD.ready, begin, { once: true });
    const giveUp = window.setTimeout(begin, Math.max(0, MAX_LOADER_MS - performance.now()));

    return () => {
      window.removeEventListener(LOAD.ready, begin);
      window.clearTimeout(giveUp);
      document.removeEventListener("click", onAnchorClick);
      window.removeEventListener(HALT_SCROLL, halt);
      window.removeEventListener(SCROLL_TO, onScrollTo);
      ctx.revert();
      gsap.ticker.remove(raf);
      lenis?.destroy();
    };
  }, [wheel, lerp]);

  return null;
}
