import Disclaimer from "@/components/Disclaimer";
import Logo from "./Logo";
import { AUTHOR, BRAND, CONTACT } from "@/lib/brand";
import { fill, type Dictionary } from "@/lib/i18n";

/**
 * The ticket office and the credits, under the particle logo at the end of
 * every page. `tagline` replaces the usual one (a page's closing line);
 * `children` go under it (the home page's way on to the company pages).
 */
export default function Footer({
  t,
  disclaimer,
  tagline,
  children,
}: {
  t: Dictionary["footer"];
  disclaimer: Dictionary["disclaimer"];
  tagline?: string;
  children?: React.ReactNode;
}) {
  const brand = { brand: BRAND.name };
  return (
    <footer className="grid gap-8">
      <div className="grid gap-8 md:grid-cols-[1fr_1.3fr_auto] md:items-end md:gap-12">
        <div>
          {/* on phones the particle logo right above says it already */}
          <Logo className="hidden h-14 md:block" />
          <p className={`t-body max-w-[360px] md:mt-4 ${tagline ? "text-white" : "text-ash"}`}>{tagline ?? t.tagline}</p>
          {children}
        </div>
        <address className="grid gap-2 text-[15px] not-italic leading-relaxed text-mist">
          <span className="t-label">{t.contactTitle}</span>
          <span>
            <span className="text-ash">{t.phone}: </span>
            {CONTACT.phones.map((p, i) => (
              <span key={p.tel}>
                {i > 0 && <span className="text-ash"> – </span>}
                <a href={`tel:${p.tel}`} className="link-wave whitespace-nowrap text-white">
                  {p.text}
                </a>
              </span>
            ))}
          </span>
          <span>
            <span className="text-ash">{t.email}: </span>
            <a href={`mailto:${CONTACT.email}`} className="link-wave text-white">
              {CONTACT.email}
            </a>
          </span>
          <span>
            <span className="text-ash">{t.address}: </span>
            {t.addressText}
          </span>
        </address>
        <nav className="flex flex-wrap gap-x-8 gap-y-3 md:flex-col md:items-end">
          {t.links.map((l) => (
            <a key={l} href="#" className="link-wave t-nav text-ash">
              {l}
            </a>
          ))}
        </nav>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-t border-white/10 pt-5">
        <p className="t-caption text-ash">{fill(t.rights, brand)}</p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Disclaimer label={t.disclaimer} t={disclaimer} />
          <span className="t-caption text-ash">
            {t.designedBy} –{" "}
            <a href={AUTHOR.url} target="_blank" rel="noopener noreferrer" className="link-wave text-white">
              {AUTHOR.name}
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
