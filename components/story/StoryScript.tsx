"use client";

import { useEffect } from "react";
import { storyBus } from "./bus";
import type { StoryPageId } from "@/lib/pages";

/** Tells the particle scene which page's script to play (see scripts.ts). */
export default function StoryScript({ page }: { page: StoryPageId }) {
  useEffect(() => {
    storyBus.setPage(page);
    return () => storyBus.setPage(null);
  }, [page]);
  return null;
}
