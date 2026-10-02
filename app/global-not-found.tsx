import type { Metadata } from "next";
import { Inter } from "next/font/google";
import ErrorScreen from "@/components/errors/ErrorScreen";
import { BRAND } from "@/lib/brand";
import { THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin", "vietnamese"], weight: ["400", "600"] });

export const metadata: Metadata = {
  title: `404 | ${BRAND.name}`,
  description: "Không tìm thấy trang · Page not found",
};

/**
 * 404 for addresses no route matches at all (/vi/a/b/c…). The root layout
 * sits under the dynamic [locale] segment, so this page brings its own
 * document, styles, font and theme.
 */
export default function GlobalNotFound() {
  return (
    <html lang="vi" data-theme="dark" className={`${inter.variable} antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <ErrorScreen kind="notFound" />
      </body>
    </html>
  );
}
