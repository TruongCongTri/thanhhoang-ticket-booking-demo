import type { Metadata } from "next";
import { notFound } from "next/navigation";
import StoryPage from "@/components/story/StoryPage";
import { AboutChapters, OrganizationChapters } from "@/components/story/pages";
import { BRAND } from "@/lib/brand";
import { LOCALES, fill, hasLocale } from "@/lib/i18n";
import { BUILT, SLUGS, pageFromSlug, pagePath, isBuilt } from "@/lib/pages";
import { getDictionary } from "../../dictionaries";

type Params = { locale: string; slug: string };

/** Published pages only, each under its own slug per language; anything else is a 404. */
export const dynamicParams = false;
export function generateStaticParams({ params }: { params: { locale: string } }) {
  if (!hasLocale(params.locale)) return [];
  const locale = params.locale;
  return BUILT.map((id) => ({ slug: SLUGS[id][locale] }));
}

function resolve({ locale, slug }: Params) {
  if (!hasLocale(locale)) return null;
  const id = pageFromSlug(locale, slug);
  return id && isBuilt(id) ? { locale, id } : null;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const page = resolve(await params);
  if (!page) return {};
  const t = getDictionary(page.locale);
  const meta = page.id === "organization" ? t.organization.meta : t.about.meta;
  return {
    title: fill(meta.title, { brand: BRAND.name }),
    description: meta.description,
    alternates: { languages: Object.fromEntries(LOCALES.map((l) => [l, pagePath(l, page.id)])) },
  };
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const page = resolve(await params);
  if (!page) notFound();
  const { locale, id } = page;
  const t = getDictionary(locale);

  if (id === "organization") {
    return (
      <StoryPage id={id} t={t} locale={locale} rail={t.organization.rail}>
        <OrganizationChapters t={t.organization} />
      </StoryPage>
    );
  }
  return (
    <StoryPage id={id} t={t} locale={locale} rail={t.about.rail}>
      <AboutChapters t={t.about} />
    </StoryPage>
  );
}
