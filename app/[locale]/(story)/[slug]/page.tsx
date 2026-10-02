import type { Metadata } from "next";
import { notFound } from "next/navigation";
import StoryPage from "@/components/story/StoryPage";
import { AboutChapters, AchievementsChapters, OrganizationChapters, ServicesChapters } from "@/components/story/pages";
import { hasLocale } from "@/lib/i18n";
import { BUILT, SLUGS, pageFromSlug, pagePath, isBuilt } from "@/lib/pages";
import { breadcrumbJsonLd, jsonLdScript, pageMetadata } from "@/lib/seo";
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
  return pageMetadata(page.locale, page.id, getDictionary(page.locale)[page.id].meta);
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const page = resolve(await params);
  if (!page) notFound();
  const { locale, id } = page;
  const t = getDictionary(locale);

  const chapters =
    id === "achievements" ? (
      <AchievementsChapters t={t.achievements} locale={locale} home={pagePath(locale, "home")} />
    ) : id === "services" ? (
      <ServicesChapters t={t.services} />
    ) : id === "organization" ? (
      <OrganizationChapters t={t.organization} />
    ) : (
      <AboutChapters t={t.about} />
    );

  return (
    <>
      {/* home › this page, for search results */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(
          breadcrumbJsonLd(locale, [
            { name: t.pages.flights, page: "home" },
            { name: t.pages.names[id], page: id },
          ]),
        )}
      />
      <StoryPage id={id} t={t} locale={locale} rail={t[id].rail}>
        {chapters}
      </StoryPage>
    </>
  );
}
