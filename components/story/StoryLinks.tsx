"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import gsap from "gsap";
import { haltScroll, storyBus } from "./bus";
import { isBuilt, pageFromPath } from "@/lib/pages";

/**
 * Page-to-page links between story pages (the "Giới thiệu" menu): the copy
 * fades away while the particles morph from whatever is on screen into the
 * destination's first model; then the route changes underneath and the new
 * page's copy makes its entrance over the model already in place.
 *
 * Same-site link clicks are intercepted in the capture phase (Next's <Link>
 * skips navigating when the click is already default-prevented).
 */
export default function StoryLinks() {
  const router = useRouter();

  useEffect(() => {
    let busy = false;
    const onClick = (e: MouseEvent) => {
      if (busy || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as Element | null)?.closest("a");
      if (!anchor?.href || (anchor.target && anchor.target !== "_self")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      const from = storyBus.page;
      const to = pageFromPath(url.pathname);
      if (!from || !to || !isBuilt(to)) return; // home and elsewhere: a plain navigation
      e.preventDefault();
      busy = true;
      haltScroll();
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const morph = { t: 0 };
      const go = () => {
        window.scrollTo(0, 0);
        router.push(url.pathname + url.hash);
        busy = false;
      };
      if (reduced) {
        storyBus.setOverride({ from: { page: from, index: "here" }, to: { page: to, index: 0 }, t: 1 });
        return go();
      }
      gsap.to("[data-page], [data-rail]", { autoAlpha: 0, duration: 0.5, ease: "power2.in" });
      // one override object throughout, so "here" is resolved once
      const override = { from: { page: from, index: "here" as const }, to: { page: to, index: 0 }, t: 0.001 };
      gsap.to(morph, {
        t: 1,
        duration: 1.5,
        ease: "power2.inOut",
        onUpdate: () => {
          override.t = Math.max(0.001, morph.t);
          storyBus.setOverride(override);
        },
        onComplete: go,
      });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [router]);

  return null;
}
