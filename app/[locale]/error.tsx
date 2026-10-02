"use client"; // error boundaries must be Client Components

import { useEffect } from "react";
import ErrorScreen from "@/components/errors/ErrorScreen";

/**
 * Anything that throws while rendering a page (the home page, a company
 * page): shown in its place, inside the site's layout. "Try again" re-fetches
 * and re-renders the page; the reference (digest) matches the server's log.
 */
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return <ErrorScreen kind="error" digest={error.digest} onRetry={retry} />;
}
