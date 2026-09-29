import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, LOCALES, LOCALE_COOKIE, hasLocale, type Locale } from "@/lib/i18n";

/** The language picked with the switcher, else the browser's best match, else Vietnamese. */
function pickLocale(request: NextRequest): Locale {
  const saved = request.cookies.get(LOCALE_COOKIE)?.value;
  if (saved && hasLocale(saved)) return saved;
  const wanted = (request.headers.get("accept-language") ?? "")
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { lang: tag.split("-")[0].toLowerCase(), q: q === undefined ? 1 : Number(q) || 0 };
    })
    .sort((a, b) => b.q - a.q);
  return wanted.map((w) => w.lang).find(hasLocale) ?? DEFAULT_LOCALE;
}

/** Every page lives under /[locale]; anything else is sent to the visitor's language. */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (LOCALES.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`))) return;
  request.nextUrl.pathname = `/${pickLocale(request)}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(request.nextUrl);
}

export const config = {
  // pages only: skip Next's internals and static files (anything with an extension)
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
