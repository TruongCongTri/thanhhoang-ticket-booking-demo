import { notFound } from "next/navigation";
import BookingDock from "@/components/BookingDock";
import ContactButtons from "@/components/ContactButtons";
import Toaster from "@/components/Toaster";
import Header from "@/components/site/Header";
import StoryLinks from "@/components/story/StoryLinks";
import StoryScene from "@/components/story/StoryScene";
import { hasLocale } from "@/lib/i18n";
import { pagePath } from "@/lib/pages";
import { getDictionary } from "../dictionaries";

/**
 * Shared by the company pages (Giới thiệu, Tổ chức, …). Everything here
 * outlasts moving from one page to the next — above all the particle scene,
 * so each page's end morphs straight into the next one's start.
 */
export default async function StoryLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();
  const t = getDictionary(locale);
  return (
    <>
      <StoryScene />
      <StoryLinks />
      <Header
        t={t.nav}
        pages={t.pages}
        locale={locale}
        home={pagePath(locale, "home")}
        links={[{ href: pagePath(locale, "home"), label: t.pages.flights }]}
      />
      {children}
      <BookingDock strings={{ dock: t.dock, checkout: t.checkout, trips: t.trips, pass: t.pass }} locale={locale} />
      <Toaster dismissLabel={t.toast.dismiss} />
      <ContactButtons t={t.contact} />
    </>
  );
}
