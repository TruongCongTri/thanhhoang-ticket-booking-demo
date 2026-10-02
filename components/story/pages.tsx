import Stage, { stageColumn } from "@/components/site/Stage";
import HistoryCopy from "./HistoryCopy";
import OrgLabels from "./OrgLabels";
import OrgTooltip from "./OrgTooltip";
import PieLegend from "./PieLegend";
import { ORG, type OrgId } from "./org";
import ValuesList from "./ValuesList";
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
        <div className="pointer-events-none absolute inset-0 z-10">
          <div className="sticky top-[16svh] mx-auto w-full max-w-[1280px] px-6 md:px-10">
            <div data-fade className={`pointer-events-auto ${stageColumn("left", true)}`}>
              <HistoryCopy label={t.history.label} quote={t.history.quote} items={t.history.milestones} />
            </div>
          </div>
        </div>
        {ids.map((id) => (
          <section key={id} id={id} data-stage aria-hidden className="h-[150svh] -scroll-mt-[25svh]" />
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
