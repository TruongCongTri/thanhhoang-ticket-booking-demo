"use client";

import { useEffect, useState } from "react";
import { onPageStart } from "@/lib/loading";

/**
 * The loading screen itself is drawn by the 3D scene: the company logo
 * builds itself out of tetrahedron particles as the page loads (that's the
 * progress indicator). This only tells assistive technology what's going on.
 */
export default function Loader({ label }: { label: string }) {
  const [loading, setLoading] = useState(true);
  useEffect(() => onPageStart(() => setLoading(false)), []);
  return (
    <p role="status" aria-live="polite" className="sr-only">
      {loading ? label : ""}
    </p>
  );
}
