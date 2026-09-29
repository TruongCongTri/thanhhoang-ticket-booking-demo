"use client";

import { useEffect, useRef, useState } from "react";
import { TOAST_CLEAR, TOAST_EVENT, type ToastDetail } from "@/lib/toast";

type Item = ToastDetail & { id: number; leaving?: boolean };
const DISMISS = "thanhhoang:toast-dismiss";

/** The stack of toasts, top right (full width on phones). */
export default function Toaster({ dismissLabel }: { dismissLabel: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const next = useRef(0);

  useEffect(() => {
    const timers = new Set<number>();
    const remove = (id: number) => {
      setItems((all) => all.map((i) => (i.id === id ? { ...i, leaving: true } : i)));
      timers.add(window.setTimeout(() => setItems((all) => all.filter((i) => i.id !== id)), 320));
    };
    const onToast = (e: Event) => {
      const id = ++next.current;
      const d = (e as CustomEvent<ToastDetail>).detail;
      setItems((all) => [...all.slice(-3), { ...d, id }]);
      timers.add(window.setTimeout(() => remove(id), d.duration ?? (d.tone === "warning" ? 8000 : 6000)));
    };
    const onDismiss = (e: Event) => remove((e as CustomEvent<number>).detail);
    const onClear = () => setItems([]);
    window.addEventListener(TOAST_EVENT, onToast);
    window.addEventListener(DISMISS, onDismiss);
    window.addEventListener(TOAST_CLEAR, onClear);
    return () => {
      window.removeEventListener(TOAST_EVENT, onToast);
      window.removeEventListener(DISMISS, onDismiss);
      window.removeEventListener(TOAST_CLEAR, onClear);
      timers.forEach(clearTimeout);
    };
  }, []);

  const dismiss = (id: number) => window.dispatchEvent(new CustomEvent(DISMISS, { detail: id }));

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-3 top-20 z-[60] flex flex-col items-stretch gap-2 md:inset-x-auto md:right-6 md:w-[380px]"
    >
      {items.map((i) => (
        <div
          key={i.id}
          role={i.tone === "warning" ? "alert" : "status"}
          className={`toast toast-${i.tone} pointer-events-auto ${i.leaving ? "toast-leaving" : ""}`}
        >
          <span className="toast-mark" aria-hidden>
            {i.tone === "success" ? "✓" : i.tone === "warning" ? "!" : "i"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] leading-snug text-white">{i.title}</span>
            {i.body && <span className="t-caption mt-0.5 block text-mist">{i.body}</span>}
          </span>
          <button onClick={() => dismiss(i.id)} aria-label={dismissLabel} className="-mr-1 px-1 text-ash transition-colors hover:text-saffron">
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
