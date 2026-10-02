import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { notFound } from "next/navigation";
import { LOCALES, hasLocale } from "@/lib/i18n";
import { THEME_SCRIPT } from "@/lib/theme";
import { jsonLdScript, organizationJsonLd, pageMetadata } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";
import BootLogo from "@/components/BootLogo";
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
    // relative URLs below (canonical, hreflang, Open Graph) resolve against it
    metadataBase: new URL(SITE_URL),
    // the home page's; each company page sets its own (see pageMetadata)
    ...pageMetadata(locale, "home", meta),
    // Icons are files in app/ (favicon.ico, icon.png, apple-icon.png — the
    // logo's mark, squared), which Next links on every page by itself.
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
        {/* the business, for search engines (schema.org TravelAgency) */}
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(organizationJsonLd(locale, getDictionary(locale).footer.addressText))} />
        <noscript>
          <style>{"html[data-loading]{overflow:auto}html[data-loading] [data-hide-while-loading]{opacity:1}"}</style>
        </noscript>
        <BootLogo />
        {children}
      </body>
    </html>
  );
}
