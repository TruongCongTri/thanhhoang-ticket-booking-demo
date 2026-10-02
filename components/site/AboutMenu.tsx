"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { STORY_PAGES, isBuilt, pageFromPath, pagePath } from "@/lib/pages";
import type { Dictionary, Locale } from "@/lib/i18n";

/**
 * "Giới thiệu": the four company pages, in tour order. Pages not yet
 * published are listed as coming soon. Opens on click (and on hover with a
 * mouse); Escape or a click elsewhere closes it.
 */
export default function AboutMenu({ t, locale }: { t: Dictionary["pages"]; locale: Locale }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pointer = useRef("");
  const listId = useId();
  const current = pageFromPath(usePathname());

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={ref}
      className="relative"
      onPointerEnter={(e) => e.pointerType === "mouse" && setOpen(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setOpen(false)}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        // With a mouse, hovering already opened it: a click keeps it open
        // (leaving closes it). Touch and keyboard toggle.
        onPointerDown={(e) => (pointer.current = e.pointerType)}
        onClick={() => {
          const mouse = pointer.current === "mouse";
          pointer.current = "";
          setOpen((o) => (mouse ? true : !o));
        }}
        className={`t-nav inline-flex items-center gap-1.5 ${current ? "text-azure" : "text-ash"} transition-colors hover:text-saffron`}
      >
        {t.menu}
        <span aria-hidden className={`inline-block text-[10px] transition-transform ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>
      <div
        id={listId}
        hidden={!open}
        className="absolute right-0 top-full z-50 pt-3 lg:left-1/2 lg:right-auto lg:-translate-x-1/2"
      >
        <nav aria-label={t.menuLabel} className="about-menu">
          <ol className="grid gap-1">
            {STORY_PAGES.map((id, i) => {
              const n = String(i + 1).padStart(2, "0");
              const label = t.names[id];
              if (!isBuilt(id)) {
                return (
                  <li key={id} className="about-menu-item opacity-55">
                    <span className="t-caption text-ash">{n}</span>
                    <span className="grow">{label}</span>
                    <span className="t-caption text-ash">{t.soon}</span>
                  </li>
                );
              }
              return (
                <li key={id}>
                  <Link
                    href={pagePath(locale, id)}
                    aria-current={current === id ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className="about-menu-item about-menu-link"
                  >
                    <span className="t-caption text-saffron">{n}</span>
                    <span className="grow">{label}</span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </nav>
      </div>
    </div>
  );
}
