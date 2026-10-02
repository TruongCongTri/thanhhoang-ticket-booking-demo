"use client";

import dynamic from "next/dynamic";

/**
 * The home page's particle scene, loaded on its own: three.js and the
 * particle engine are over half of the page's JavaScript, so they arrive in a
 * separate chunk while the rest of the page (the booking dock, the header)
 * loads and becomes interactive. Client-only: there's nothing to
 * server-render. Until it's in, the boot logo (BootLogo) holds the screen.
 */
// Start downloading as soon as this module runs (with the page's own code),
// not when React gets round to mounting it: the two downloads overlap.
const load = () => import("./Scene");
if (typeof window !== "undefined") load();

const Scene = dynamic(load, { ssr: false });

export default Scene;
