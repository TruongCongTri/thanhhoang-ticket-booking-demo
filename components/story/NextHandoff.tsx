"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import HandoffIndicator, { paintIndicator } from "./HandoffIndicator";
import { haltScroll, markSeamless, storyBus } from "./bus";
import type { StoryPageId } from "@/lib/pages";

gsap.registerPlugin(ScrollTrigger);

/** Seconds the full ring pulses before the route changes. */
const COMPLETE_HOLD = 0.45;
/** Completions this soon after mount are ignored: the page may still be settling. */
const SETTLE_MS = 1200;
/** Scroll distance (share of the viewport) the pinned screen needs to fill the ring. */
const HOLD_DISTANCE = "+=80%";

/**
 * After the last chapter, the next page's first screen scrolls up into view
 * (its top third first: the hint of what comes next). Meanwhile the particle
 * logo morphs into the next page's first model, finishing as that screen
 * reaches the top — exactly where the next page's own hero sits. Then it
 * pins, and further scrolling fills the ring, a band of light sweeping down
 * with it. At 100% the route changes (flagged seamless: no entrance), with
 * nothing on screen changing.
 */
export default function NextHandoff({
  page,
  next,
  href,
  label,
  children,
}: {
  page: StoryPageId;
  next: StoryPageId;
  href: string;
  /** e.g. "Up next · Organization" */
  label: string;
  /** The next page's hero copy (PageHero), drawn still. */
  children: React.ReactNode;
}) {
  const router = useRouter();
  const ref = useRef<HTMLElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const washRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    router.prefetch(href);
  }, [router, href]);

  useEffect(() => {
    const section = ref.current!;
    const ring = ringRef.current;
    const wash = washRef.current;
    let navigated = false;
    // Only arm once the ring has been seen short of full: arriving with the
    // window still scrolled to the old page's end must not chain on.
    let armed = false;
    const mountedAt = performance.now();

    const ctx = gsap.context(() => {
      // The particles: from this page's logo into the next page's first model.
      ScrollTrigger.create({
        trigger: section,
        start: "top bottom",
        end: "top top",
        onUpdate: (self) => {
          if (navigated) return;
          storyBus.setOverride({ from: { page, index: "last" }, to: { page: next, index: 0 }, t: self.progress });
        },
        onLeaveBack: () => !navigated && storyBus.setOverride(null),
      });

      ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: HOLD_DISTANCE,
        pin: true,
        onUpdate: (self) => {
          if (navigated) return;
          const p = self.progress;
          paintIndicator(ring, p);
          gsap.set(wash, { backgroundPosition: `50% ${100 - p * 100}%` });
          if (p < 0.9) armed = true;
          if (armed && p >= 0.995 && performance.now() - mountedAt > SETTLE_MS) {
            navigated = true;
            haltScroll();
            // The real hero has no ring or bar: they go before the swap.
            gsap
              .timeline({
                onComplete: () => {
                  markSeamless();
                  router.push(href);
                },
              })
              .to(ring, { scale: 1.15, duration: COMPLETE_HOLD / 2, ease: "power2.out" })
              .to([ring, barRef.current], { scale: 1, autoAlpha: 0, duration: COMPLETE_HOLD / 2, ease: "power2.in" });
          }
        },
      });
    }, section);

    return () => {
      ctx.revert();
      if (!navigated) storyBus.setOverride(null);
    };
  }, [page, next, href, router]);

  return (
    <section ref={ref} aria-label={label} className="handoff relative z-10 flex h-[100svh] items-start pt-[46svh] md:pt-[18svh]">
      {/* A band of light that sweeps down the screen as the ring fills, gone by the end */}
      <div ref={washRef} className="handoff-wash" aria-hidden />
      <div ref={barRef} className="handoff-bar">
        <HandoffIndicator ref={ringRef} direction="down" />
        <span className="t-nav text-ash">{label}</span>
      </div>
      <div className="relative mx-auto w-full max-w-[1280px] px-6 md:px-10" inert>
        <div className="lg:w-1/2 lg:pr-8">{children}</div>
      </div>
    </section>
  );
}
