"use client";

import dynamic from "next/dynamic";

/** The company pages' particle scene, in its own chunk (see scene/LazyScene.tsx). */
// Start downloading as soon as this module runs (with the page's own code),
// not when React gets round to mounting it: the two downloads overlap.
const load = () => import("./StoryScene");
if (typeof window !== "undefined") load();

const StoryScene = dynamic(load, { ssr: false });

export default StoryScene;
