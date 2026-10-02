/** The progress rail: one dot per chapter of this page; hover (or focus) shows its name, click jumps there. */
export default function Rail({ label, stages }: { label: string; stages: readonly { id: string; label: string }[] }) {
  return (
    <nav
      data-rail
      data-hide-while-loading
      aria-label={label}
      className="fixed right-6 top-1/2 z-30 hidden -translate-y-1/2 flex-col items-center gap-1 lg:flex"
    >
      <span data-counter aria-hidden className="t-caption mb-2 w-4 text-center text-ash">
        01
      </span>
      {stages.map(({ id, label: name }, i) => (
        <a
          key={id}
          href={`#${id}`}
          data-dot
          data-active={i === 0 ? "" : undefined}
          aria-label={name}
          className="rail-link relative flex h-6 w-6 items-center justify-center"
        >
          {/* floats beside the dot: only the dot is the target */}
          <span className="rail-label t-nav whitespace-nowrap" aria-hidden>
            {name}
          </span>
          <span className="dot" />
        </a>
      ))}
    </nav>
  );
}
