import Link from "next/link";
import AboutMenu from "./AboutMenu";
import Logo from "./Logo";
import LocaleSwitch from "@/components/LocaleSwitch";
import MyTripsLink from "@/components/MyTripsLink";
import ThemeToggle from "@/components/ThemeToggle";
import { BRAND } from "@/lib/brand";
import { fill, type Dictionary, type Locale } from "@/lib/i18n";

/**
 * The fixed header on every page: the logo (home), the page's own links, the
 * "Giới thiệu" menu, then language, theme and my trips.
 */
export default function Header({
  t,
  pages,
  locale,
  links = [],
  home,
}: {
  t: Dictionary["nav"];
  pages: Dictionary["pages"];
  locale: Locale;
  /** Links in the middle (the home page's sections). */
  links?: { href: string; label: string }[];
  /** Where the logo goes: the top of this page on the home page, else the home page. */
  home: string;
}) {
  const logo = <Logo className="h-11 md:h-12" />;
  return (
    <header data-nav data-hide-while-loading className="fixed inset-x-0 top-0 z-40">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-5 md:px-10">
        {home.startsWith("#") ? (
          <a href={home} aria-label={fill(t.home, { brand: BRAND.name })}>
            {logo}
          </a>
        ) : (
          <Link href={home} aria-label={fill(t.home, { brand: BRAND.name })}>
            {logo}
          </Link>
        )}
        <nav className="hidden items-center gap-9 lg:flex" aria-label={t.primary}>
          {links.map(({ href, label }) =>
            href.startsWith("#") ? (
              <a key={href} href={href} className="link-wave t-nav text-ash">
                {label}
              </a>
            ) : (
              <Link key={href} href={href} className="link-wave t-nav text-ash">
                {label}
              </Link>
            ),
          )}
          <AboutMenu t={pages} locale={locale} />
        </nav>
        <div className="flex items-center gap-6">
          <span className="lg:hidden">
            <AboutMenu t={pages} locale={locale} />
          </span>
          <LocaleSwitch locale={locale} label={t.language} />
          <ThemeToggle toLight={t.toLight} toDark={t.toDark} />
          <MyTripsLink label={t.myTrips} />
        </div>
      </div>
    </header>
  );
}
