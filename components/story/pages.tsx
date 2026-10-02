import Stage, { stageColumn } from "@/components/site/Stage";
import HistoryCopy from "./HistoryCopy";
import OrgLabels from "./OrgLabels";
import OrgTooltip from "./OrgTooltip";
import PieLegend from "./PieLegend";
import { ORG, type OrgId } from "./org";
import ValuesList from "./ValuesList";
import FrameCopy from "./FrameCopy";
import StepCopy from "./StepCopy";
import AwardSteps from "./AwardSteps";
import PartnerGrid from "./PartnerGrid";
import { PARTNERS } from "./achievements-models";
import { CONTACT } from "@/lib/brand";
import { fill, intlLocale, type Locale } from "@/lib/i18n";
import ChartSteps from "./ChartSteps";
import { screensOf } from "./scripts";
import type { Dictionary } from "@/lib/i18n";

/** The chapters between a page's hero and its finale. */

/** Giới thiệu: four milestones, vision, mission, core values. */
export function AboutChapters({ t }: { t: Dictionary["about"] }) {
  const ids = ["y2013", "y2016", "y2019", "y2022"] as const;
  return (
    <>
      {/* The four milestones: one chapter each for the rail and the 3D, under
          one copy that holds still and follows the year the model is on. */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 bottom-[10svh] z-10">
          <div className="sticky top-[16svh] mx-auto w-full max-w-[1280px] px-6 md:px-10">
            <div data-fade className={`pointer-events-auto ${stageColumn("left", true)}`}>
              <HistoryCopy label={t.history.label} quote={t.history.quote} items={t.history.milestones} ids={ids} />
            </div>
          </div>
        </div>
        {ids.map((id) => (
          <section key={id} id={id} data-stage aria-hidden className="h-[calc(var(--stage,1.5)*100svh)] scroll-mt-[calc((1-var(--stage,1.5))*50svh)]" />
        ))}
      </div>

      <Stage id="vision" side="right">
        <p data-fade className="t-label mb-6">
          {t.vision.label}
        </p>
        <h2 data-split className="t-heading-lg">
          {t.vision.title}
        </h2>
        <p data-fade className="t-body mt-8 max-w-[480px] text-mist">
          {t.vision.body}
        </p>
      </Stage>

      <Stage id="mission" side="right">
        <p data-fade className="t-label mb-6">
          {t.mission.label}
        </p>
        <h2 data-split className="t-heading-lg">
          {t.mission.title}
        </h2>
        <p data-fade className="t-body mt-8 max-w-[480px] text-mist">
          {t.mission.body}
        </p>
      </Stage>

      <Stage id="values" side="left" narrow pin screens={screensOf("about", "values")}>
        <p data-fade className="t-label mb-6">
          {t.values.label}
        </p>
        <h2 data-split className="t-heading">
          {t.values.title}
        </h2>
        <div data-fade>
          <ValuesList items={t.values.items} />
        </div>
      </Stage>
    </>
  );
}

/** Tổ chức: our people as a pie, then the org chart, level by level. */
export function OrganizationChapters({ t }: { t: Dictionary["organization"] }) {
  const levels = [t.chart.levels.board, t.chart.levels.heads, t.chart.levels.teams];
  return (
    <>
      <Stage id="people" side="right" pin screens={screensOf("organization", "people")}>
        <p className="t-label mb-6">{t.people.label}</p>
        <h2 data-split className="t-heading">
          {t.people.title}
        </h2>
        <PieLegend title={t.people.legendTitle} items={t.people.legend} />
        <ul data-fade className="mt-7 grid max-w-[480px] gap-4">
          {t.people.points.map((p) => (
            <li key={p.title} className="border-l border-azure/50 pl-5">
              <span className="block text-[18px] leading-snug">{p.title}</span>
              <span className="mt-1.5 block text-[15px] font-light leading-relaxed text-mist">{p.body}</span>
            </li>
          ))}
        </ul>
      </Stage>

      {/* The chart: its copy holds still, level by level, while the positions gather in beside it */}
      <Stage id="chart" side="left" narrow pin screens={screensOf("organization", "chart")}>
        <ChartSteps levels={levels} hint={t.chart.hint} />
      </Stage>

      {/* The chart for screen readers: the particles and their names are drawn only */}
      <OrgOutline nodes={t.chart.nodes} />
      <OrgLabels nodes={t.chart.nodes} />
      <OrgTooltip nodes={t.chart.nodes} />
    </>
  );
}

/** The org chart as nested lists, who reports to whom (screen readers only). */
function OrgOutline({ nodes }: { nodes: Dictionary["organization"]["chart"]["nodes"] }) {
  const under = (parent: OrgId | null): React.ReactNode => {
    const kids = ORG.filter((n) => ("parent" in n ? n.parent : null) === parent);
    if (!kids.length) return null;
    return (
      <ul>
        {kids.map((n) => (
          <li key={n.id}>
            {nodes[n.id].title} — {nodes[n.id].role}
            {under(n.id)}
          </li>
        ))}
      </ul>
    );
  };
  return <div className="sr-only">{under(null)}</div>;
}

/**
 * Dịch vụ & Vận hành: the five featured services (one model each, under one
 * held copy), then the stepped chapters — what customers choose, the
 * principles, the process, the strengths.
 */
export function ServicesChapters({ t }: { t: Dictionary["services"] }) {
  const featured = ["ticket", "group", "visa", "tour", "corporate"] as const;
  const stepped = [
    { id: "share", side: "right", copy: t.share, model: "share" },
    { id: "principles", side: "left", copy: t.principles, model: "pillars" },
    { id: "process", side: "right", copy: t.process, model: "process" },
    { id: "strengths", side: "left", copy: t.strengths, model: "radar" },
  ] as const;
  return (
    <>
      {/* The featured services: one chapter each for the rail and the 3D, under
          one copy that holds still and follows the service the model is on. */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 bottom-[10svh] z-10">
          <div className="sticky top-[16svh] mx-auto w-full max-w-[1280px] px-6 md:px-10">
            <div data-fade className={`pointer-events-auto ${stageColumn("left", true)}`}>
              <FrameCopy page="services" first={1} label={t.featured.label} items={t.featured.items} ids={featured} />
            </div>
          </div>
        </div>
        {featured.map((id) => (
          <section key={id} id={id} data-stage aria-hidden className="h-[calc(var(--stage,1.5)*100svh)] scroll-mt-[calc((1-var(--stage,1.5))*50svh)]" />
        ))}
      </div>

      {stepped.map(({ id, side, copy, model }) => (
        <Stage key={id} id={id} side={side} narrow={side === "left"} pin screens={screensOf("services", id)}>
          <p className="t-label mb-6 max-md:mb-3">{copy.label}</p>
          <h2 data-split className="t-heading max-md:text-[30px]">
            {copy.title}
          </h2>
          {"quote" in copy && <p className="t-body mt-3 italic text-ash max-md:hidden">“{copy.quote}”</p>}
          {"note" in copy && <p className="t-caption mt-3 text-ash max-md:hidden">{copy.note}</p>}
          <StepCopy model={model} items={copy.items} target={{ page: "services", stage: id }} />
        </Stage>
      ))}
    </>
  );
}

/** Founding year: the "years with you" counter counts from it. */
const FOUNDED = 2013;

/**
 * Thành tựu & Đối tác: the awards (a trophy whose stars light along the
 * timeline, with counters), the partner airlines at home and abroad, and the
 * closing word with its calls to action.
 */
export function AchievementsChapters({ t, locale, home }: { t: Dictionary["achievements"]; locale: Locale; home: string }) {
  const awards = t.awards.timeline.reduce((n, p) => n + p.items.length, 0);
  const airlines = PARTNERS.domestic.length + PARTNERS.international.length;
  const counters = [
    [new Date().getFullYear() - FOUNDED, "", t.awards.counters.years],
    [awards, "", t.awards.counters.awards],
    [airlines, "", t.awards.counters.airlines],
    [1000000, "+", t.awards.counters.customers],
  ] as const;
  const hotline = CONTACT.phones[0];
  return (
    <>
      <Stage id="awards" side="left" narrow pin screens={screensOf("achievements", "awards")}>
        <p className="t-label mb-5 max-md:mb-3">{t.awards.label}</p>
        <h2 data-split className="t-heading max-md:text-[30px]">
          {t.awards.title}
        </h2>
        <dl className="mt-6 grid max-w-[480px] grid-cols-2 gap-x-6 gap-y-3 max-md:mt-4">
          {counters.map(([n, suffix, label]) => (
            <div key={label} className="flex flex-col">
              <dt className="t-caption order-2 uppercase tracking-[0.05em] text-ash">{label}</dt>
              <dd data-count={n} data-suffix={suffix} className="t-heading-2xs -order-1 tabular-nums md:text-[30px]">
                {n.toLocaleString(intlLocale(locale))}
                {suffix}
              </dd>
            </div>
          ))}
        </dl>
        <AwardSteps periods={t.awards.timeline} />
      </Stage>

      {(
        [
          ["partners-dom", t.partners.domestic, PARTNERS.domestic],
          ["partners-intl", t.partners.international, PARTNERS.international],
        ] as const
      ).map(([id, copy, names]) => (
        <Stage key={id} id={id} side="right" pin screens={screensOf("achievements", id)}>
          <p className="t-label mb-6 max-md:mb-3">{t.partners.label}</p>
          <h2 data-split className="t-heading max-md:text-[30px]">
            {copy.title}
          </h2>
          <p className="t-body mt-5 max-w-[460px] text-mist max-md:text-[15px]">{copy.body}</p>
          <PartnerGrid model={id} partners={names} />
        </Stage>
      ))}

      <Stage id="closing" side="left">
        <p data-fade className="t-label mb-6">
          {t.closing.label}
        </p>
        <h2 data-split className="t-heading">
          {t.closing.title}
        </h2>
        <p data-fade className="t-body mt-6 max-w-[480px] text-mist max-md:text-[15px]">
          {t.closing.body}
        </p>
        <p data-fade className="t-heading-2xs mt-4 text-saffron">
          {t.closing.thanks}
        </p>
        <div data-fade className="mt-6 flex flex-wrap items-center gap-3">
          <a href={home} className="btn-primary">
            {t.closing.book}
          </a>
          <a href={`tel:${hotline.tel}`} className="btn-ghost">
            {fill(t.closing.call, { phone: hotline.text })}
          </a>
          <a href={CONTACT.zalo} target="_blank" rel="noopener noreferrer" className="btn-ghost">
            {t.closing.zalo}
          </a>
        </div>
      </Stage>
    </>
  );
}
