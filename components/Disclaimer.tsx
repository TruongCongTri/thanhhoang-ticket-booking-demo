"use client";

import { useRef } from "react";
import { AUTHOR } from "@/lib/brand";
import type { Dictionary } from "@/lib/i18n";

/** The footer's "Disclaimer" link and the pop-up it opens (a native modal dialog). */
export default function Disclaimer({ label, t }: { label: string; t: Dictionary["disclaimer"] }) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" onClick={() => ref.current?.showModal()} className="link-wave t-nav text-ash">
        {label}
      </button>
      <dialog
        ref={ref}
        aria-labelledby="disclaimer-title"
        className="disclaimer"
        data-lenis-prevent
        // a click on the backdrop (the dialog itself, outside its content) closes it
        onClick={(e) => e.target === ref.current && ref.current?.close()}
      >
        <div className="grid gap-4 p-6 md:p-8">
          <h2 id="disclaimer-title" className="t-heading-2xs text-white">
            {t.title}
          </h2>
          {t.body.map((p) => (
            <p key={p.slice(0, 24)} className="text-[15px] leading-relaxed text-mist">
              {p}
            </p>
          ))}
          <div className="mt-2 flex flex-wrap items-center justify-end gap-3">
            <button type="button" onClick={() => ref.current?.close()} className="btn-ghost">
              {t.close}
            </button>
            <a href={AUTHOR.url} target="_blank" rel="noopener noreferrer" className="btn-primary">
              {t.contact} ↗
            </a>
          </div>
        </div>
      </dialog>
    </>
  );
}
