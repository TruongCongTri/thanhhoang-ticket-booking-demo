"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import HandoffIndicator, { paintIndicator } from "./HandoffIndicator";
import { markSeamless, storyBus } from "./bus";
import type { StoryPageId } from "@/lib/pages";

/** Seconds the full ring pulses before the route changes. */
const COMPLETE_HOLD = 0.45;
/** Pull distance (share of the viewport) that fills the ring once the screen is fully down. */
const HOLD_SHARE = 0.8;
/** Touch drags cover less distance than wheel scrolling, so each pixel of drag counts this much more. */
const TOUCH_FACTOR = 2.5;
/** Seconds of wheel silence required before the pull arms (swallows momentum after arriving). */
const ARM_DELAY = 0.6;
/** A wheel event after this many ms of silence starts a new gesture. */
const GESTURE_GAP_MS = 200;
/** Easing of the page toward the pulled distance. */
const FOLLOW = { duration: 0.6, ease: "power3.out" };

/**
 * The mirror of NextHandoff. The previous page's last screen — its closing
 * line and footer, under the particle logo — waits just above this page.
 * Scrolling up while already at the top moves this page down (as if
 * scrolling up into it) and the particles morph back into the logo; once
 * that screen fills the viewport, further pulling fills the ring. At 100% the
 * route changes to the previous page's end, invisibly. Scrolling down backs out.
 */
export default function PrevHandoff({
  page,
  prev,
  href,
  label,
  children,
}: {
  page: StoryPageId;
  prev: StoryPageId;
  /** The previous page, at its last chapter. */
  href: string;
  label: string;
  /** The previous page's last screen (its footer, with its closing line), drawn still. */
  children: React.ReactNode;
}) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const washRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    router.prefetch(href);
  }, [router, href]);

  useEffect(() => {
    const panel = panelRef.current!;
    const bar = barRef.current!;
    // Everything of this page that scrolls: it moves down as the pull reveals the panel.
    const content = () => document.querySelector<HTMLElement>("[data-page]");
    /** This page's moving parts that are still in the document (the page may already be gone). */
    const movers = () => [content(), panel].filter((el): el is HTMLElement => !!el && el.isConnected);
    let target = 0;
    const state = { shown: 0 };
    let navigated = false;
    let armed = false;
    let lastWheel = 0;
    let gestureFromTop = false;
    let touchStartY = 0;
    let touchStartTarget = 0;

    const reveal = () => panel.offsetHeight;
    const total = () => reveal() * (1 + HOLD_SHARE);
    const atTop = () => window.scrollY <= 0;

    const render = () => {
      const shown = state.shown;
      const y = Math.min(shown, reveal());
      if (shown < 0.5) {
        gsap.set(movers(), { clearProps: "transform" });
        gsap.set(bar, { autoAlpha: 0 });
      } else {
        gsap.set(movers(), { y });
        gsap.set(bar, { autoAlpha: Math.min(1, shown / 140) });
      }
      // The particles follow the reveal; the ring and the light, the pull beyond it.
      storyBus.setOverride(
        shown < 0.5 ? null : { from: { page, index: 0 }, to: { page: prev, index: "last" }, t: Math.min(1, y / reveal()) },
      );
      const progress = gsap.utils.clamp(0, 1, (shown - reveal()) / (total() - reveal()));
      paintIndicator(ringRef.current, progress);
      gsap.set(washRef.current, { backgroundPosition: `50% ${progress * 100}%` });
      if (progress >= 0.995 && target >= total()) complete();
    };

    const follow = () => {
      gsap.to(state, { shown: target, ...FOLLOW, overwrite: true, onUpdate: () => !navigated && render() });
    };

    const complete = () => {
      navigated = true;
      gsap
        .timeline({
          onComplete: () => {
            markSeamless();
            router.push(href);
          },
        })
        .to(ringRef.current, { scale: 1.15, duration: COMPLETE_HOLD / 2, ease: "power2.out" })
        .to(bar, { autoAlpha: 0, duration: COMPLETE_HOLD / 2, ease: "power2.in" });
    };

    const arm = gsap.delayedCall(ARM_DELAY, () => (armed = true));

    const pullTo = (px: number) => {
      target = gsap.utils.clamp(0, total(), px);
      follow();
    };

    // Inside the booking dock, a dialog or anything else that scrolls on its own: not a pull.
    const ownScroll = (e: Event) => !!(e.target as Element | null)?.closest?.("[data-lenis-prevent], dialog, [role='dialog']");

    // Capture phase on window: runs before Lenis, so while the page is pulled
    // down the wheel moves this hand-off instead of scrolling the page.
    const onWheel = (e: WheelEvent) => {
      if (navigated) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (ownScroll(e)) return;
      const now = performance.now();
      // Momentum from a scroll that started lower down must not spill into a pull at the top.
      if (now - lastWheel > GESTURE_GAP_MS) gestureFromTop = atTop();
      lastWheel = now;
      if (!armed) {
        arm.restart(true);
        return;
      }
      const pulling = target > 0 || (atTop() && gestureFromTop && e.deltaY < 0);
      if (!pulling) return;
      e.preventDefault();
      e.stopPropagation();
      pullTo(target - e.deltaY * (e.deltaMode === 1 ? 40 : 1));
    };

    const onTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
      touchStartTarget = target;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!armed || navigated || ownScroll(e)) return;
      const delta = e.touches[0].clientY - touchStartY;
      if (!(touchStartTarget > 0 || (atTop() && delta > 0))) return;
      e.preventDefault(); // no native overscroll / pull-to-refresh while pulling
      pullTo(touchStartTarget + delta * TOUCH_FACTOR);
    };
    // Letting go short of the end springs back, like releasing a pull-to-refresh.
    const onTouchEnd = () => {
      if (!navigated && target > 0) pullTo(0);
    };

    window.addEventListener("wheel", onWheel, { passive: false, capture: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);

    return () => {
      arm.kill();
      gsap.killTweensOf(state);
      window.removeEventListener("wheel", onWheel, { capture: true });
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      if (!navigated) {
        const left = movers();
        if (left.length) gsap.set(left, { clearProps: "transform" });
        storyBus.setOverride(null);
      }
    };
  }, [page, prev, href, router]);

  return (
    <>
      <div ref={panelRef} className="handoff-prev" aria-hidden inert>
        <div ref={washRef} className="handoff-wash is-up" />
        <div className="relative mx-auto flex h-full w-full max-w-[1280px] items-end px-6 pb-44 md:px-10 md:pb-56">
          <div className="w-full">{children}</div>
        </div>
      </div>
      <div ref={barRef} className="handoff-bar is-fixed" aria-hidden>
        <HandoffIndicator ref={ringRef} direction="up" />
        <span className="t-nav text-ash">{label}</span>
      </div>
    </>
  );
}
