import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { notFound } from "next/navigation";
import { BRAND } from "@/lib/brand";
import { LOCALES, fill, hasLocale } from "@/lib/i18n";
import { THEME_SCRIPT } from "@/lib/theme";
import { getDictionary } from "./dictionaries";
import "../globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "vietnamese"],
  weight: ["200", "400", "600", "700"],
});

/** Both languages are built ahead of time; any other /[locale] is a 404. */
export const dynamicParams = false;
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(locale)) return {};
  const { meta } = getDictionary(locale);
  return {
    title: fill(meta.title, { brand: BRAND.name }),
    description: fill(meta.description, { brand: BRAND.name }),
    icons: {
      // app/favicon.ico is linked automatically by Next; these add the PNG sizes.
      icon: [
        { url: '/brand/thanh-hoang-logo.png', sizes: '32x32', type: 'image/png' },
        { url: '/brand/thanh-hoang-logo.png', sizes: '192x192', type: 'image/png' },
        { url: '/brand/thanh-hoang-logo.png', sizes: '512x512', type: 'image/png' },
      ],
      apple: { url: '/brand/thanh-hoang-logo.png', sizes: '180x180' },
    },
    alternates: { languages: Object.fromEntries(LOCALES.map((l) => [l, `/${l}`])) },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
    { media: "(prefers-color-scheme: light)", color: "#f4f6fa" },
  ],
};

export default async function RootLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();
  return (
    // data-loading: the loading screen is up until the page starts (lib/loading.ts).
    // data-theme: dark by default; the script below applies the visitor's choice before first paint.
    <html lang={locale} data-loading="" data-theme="dark" className={`${inter.variable} antialiased`} suppressHydrationWarning>
      <head>
        {/* runs on the server-rendered page only; inert on the client, so React doesn't warn (Next's flash guide) */}
        <script
          type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }}
        />
      </head>
      <body>
        <noscript>
          <style>{"html[data-loading]{overflow:auto}html[data-loading] [data-hide-while-loading]{opacity:1}"}</style>
        </noscript>
        {children}
      </body>
    </html>
  );
}
