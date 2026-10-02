import type { Metadata } from "next";
import { AUTHOR, BRAND, CONTACT } from "@/lib/brand";
import { LOCALES, fill, type Locale } from "@/lib/i18n";
import { pagePath, type StoryPageId } from "@/lib/pages";
import { OG_LOCALE, SITE_URL, X_DEFAULT } from "@/lib/site";

type PageId = StoryPageId | "home";

/**
 * Everything a page tells search engines and social apps: its title and
 * description, its canonical address and the same page in the other
 * language (hreflang, with x-default), the Open Graph / Twitter card and
 * robots. The share image is app/[locale]/opengraph-image.tsx: the home
 * page gets it from the file convention; a page below it that sets its own
 * openGraph would lose it, so those name it explicitly.
 */
export function pageMetadata(locale: Locale, page: PageId, meta: { title: string; description: string }): Metadata {
  const title = fill(meta.title, { brand: BRAND.name });
  const description = fill(meta.description, { brand: BRAND.name });
  const path = pagePath(locale, page);
  const images = page === "home" ? undefined : [{ url: `/${locale}/opengraph-image`, width: 1200, height: 630, alt: BRAND.name }];
  return {
    title: { absolute: title },
    description,
    applicationName: BRAND.name,
    authors: [{ name: AUTHOR.name, url: AUTHOR.url }],
    category: "travel",
    alternates: {
      canonical: path,
      languages: {
        ...Object.fromEntries(LOCALES.map((l) => [l, pagePath(l, page)])),
        "x-default": pagePath(X_DEFAULT, page),
      },
    },
    openGraph: {
      type: "website",
      siteName: BRAND.name,
      url: path,
      title,
      description,
      locale: OG_LOCALE[locale],
      alternateLocale: LOCALES.filter((l) => l !== locale).map((l) => OG_LOCALE[l]),
      images,
    },
    twitter: { card: "summary_large_image", title, description, images },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large" } },
    formatDetection: { telephone: true, email: true, address: false },
  };
}

/** The business, as schema.org structured data (on every page). */
export function organizationJsonLd(locale: Locale, addressText: string) {
  return {
    "@context": "https://schema.org",
    "@type": "TravelAgency",
    "@id": `${SITE_URL}/#organization`,
    name: BRAND.name,
    alternateName: "Du lịch Thành Hoàng",
    legalName: "Công ty TNHH Thương Mại Và Phát Triển Du Lịch Thành Hoàng",
    taxID: "0312171360",
    foundingDate: "2013",
    url: `${SITE_URL}/${locale}`,
    logo: `${SITE_URL}${BRAND.logo.src}`,
    image: `${SITE_URL}${BRAND.logo.src}`,
    email: CONTACT.email,
    telephone: CONTACT.phones.map((p) => p.tel),
    address: {
      "@type": "PostalAddress",
      streetAddress: addressText,
      addressLocality: "Hồ Chí Minh",
      addressCountry: "VN",
    },
    areaServed: "VN",
    sameAs: [CONTACT.zalo],
    contactPoint: CONTACT.phones.map((p) => ({
      "@type": "ContactPoint",
      telephone: p.tel,
      contactType: "customer service",
      availableLanguage: ["vi", "en"],
    })),
  };
}

/** Where a company page sits: home › page (schema.org BreadcrumbList). */
export function breadcrumbJsonLd(locale: Locale, items: { name: string; page: PageId }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: `${SITE_URL}${pagePath(locale, it.page)}`,
    })),
  };
}

/** Structured data as a <script> body: JSON, with "<" escaped so it can't close the tag. */
export const jsonLdScript = (data: unknown) => ({ __html: JSON.stringify(data).replace(/</g, "\\u003c") });
