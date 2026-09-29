import { CONTACT } from "@/lib/brand";
import { fill, type Dictionary } from "@/lib/i18n";

/**
 * Quick contact, floating on the right: call the hotline, or chat on Zalo.
 * Above the booking dock on smaller screens, beside it on wide ones.
 */
export default function ContactButtons({ t }: { t: Dictionary["contact"] }) {
  const hotline = CONTACT.phones[0];
  return (
    <nav aria-label={t.label} data-hide-while-loading className="contact-float">
      <a href={`tel:${hotline.tel}`} aria-label={fill(t.callAria, { phone: hotline.text })} className="contact-btn contact-call">
        <span className="contact-label">
          {t.call} · {hotline.text}
        </span>
        <span className="contact-icon" aria-hidden>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 4h3.2l1.6 4-2 1.3a11 11 0 0 0 5 5l1.3-2 4 1.6V17a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2Z" />
          </svg>
        </span>
      </a>
      <a href={CONTACT.zalo} target="_blank" rel="noopener noreferrer" aria-label={t.zaloAria} className="contact-btn contact-zalo">
        <span className="contact-label">{t.zalo}</span>
        <span className="contact-icon" aria-hidden>
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
            <path d="M12 4c4.97 0 9 3.13 9 7s-4.03 7-9 7c-.9 0-1.77-.1-2.6-.3L5 20l1.1-3.6C4.18 15.1 3 13.16 3 11c0-3.87 4.03-7 9-7Z" />
            <text x="12" y="13.2" textAnchor="middle" fontSize="5.4" fontWeight="700" fill="currentColor" stroke="none" fontFamily="Inter, Arial, sans-serif">
              Zalo
            </text>
          </svg>
        </span>
      </a>
    </nav>
  );
}
