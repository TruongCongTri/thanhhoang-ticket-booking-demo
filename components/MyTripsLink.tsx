"use client";

import { TRIPS_EVENT } from "@/lib/trips";

/** "My trips" in the header: opens the lookup-by-phone panel in the booking dock. */
export default function MyTripsLink({ label }: { label: string }) {
  return (
    <button onClick={() => window.dispatchEvent(new Event(TRIPS_EVENT))} className="link-wave t-nav text-white">
      {label}
    </button>
  );
}
