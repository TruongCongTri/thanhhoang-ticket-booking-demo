"use client";

import Image from "next/image";
import { useSyncExternalStore } from "react";
import { jumpToStep, storyBus } from "./bus";

type Partner = { name: string; logo: string };

/**
 * The partner airlines beside their particle cards: each logo on a white
 * tile, as in the brochure, its name under it. The airline the model has lit
 * (storyBus.lit for `model`) is highlighted here too.
 */
export default function PartnerGrid({ model, partners }: { model: string; partners: readonly Partner[] }) {
  const lit = useSyncExternalStore(
    storyBus.onLit,
    () => storyBus.litOf(model),
    () => 0,
  );
  return (
    <ul className="mt-7 grid max-w-[460px] grid-cols-2 gap-3 max-md:mt-4 max-md:gap-2">
      {partners.map(({ name, logo }, i) => {
        const on = lit === i + 1;
        return (
          <li key={name}>
            <button
              type="button"
              aria-current={on ? "true" : undefined}
              onClick={() => jumpToStep("achievements", model, i)}
              className={`partner-tile block w-full cursor-pointer ${on ? "partner-tile-on" : ""} ${lit && !on ? "opacity-55 hover:opacity-90" : ""}`}
            >
            <span className="flex h-12 items-center justify-center rounded-[10px] bg-[#fff] px-3 max-md:h-10">
              <Image src={logo} alt={name} width={180} height={40} className="h-auto max-h-8 w-auto max-w-full object-contain max-md:max-h-6" />
            </span>
              <span className="t-caption mt-1.5 block text-center text-ash">{name}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
