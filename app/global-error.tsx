"use client"; // error boundaries must be Client Components

import { useEffect } from "react";
import ErrorScreen from "@/components/errors/ErrorScreen";
import { savedTheme } from "@/lib/theme";
import "./globals.css";

/**
 * The last resort: an error in the root layout itself, where error.tsx can't
 * reach. It replaces the whole document, so it brings its own <html>, the
 * site's styles and the visitor's theme.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
    const theme = savedTheme() ?? (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    document.documentElement.setAttribute("data-theme", theme);
  }, [error]);
  return (
    <html lang="vi" data-theme="dark">
      <body className="antialiased">
        <ErrorScreen kind="error" digest={error.digest} onRetry={retry} />
      </body>
    </html>
  );
}
