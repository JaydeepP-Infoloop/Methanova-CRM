/**
 * A single pulsing placeholder bar or block. Sized entirely through
 * `className` (height/width/shape) so one component covers a table cell, a
 * chart's plot area, a stat card's number, or a donut ring — whatever shape
 * the real content underneath it has. `aria-hidden` because it carries no
 * information of its own; the loading state itself is announced separately
 * by whatever `aria-live`/`aria-busy` region wraps the panel, not by this.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-slate-200 motion-reduce:animate-none ${className}`}
    />
  );
}

/**
 * The "row is the editor" card shape shared by the reference-data admin
 * screens (Lead Sources, Feedstock Types, Qualification Criteria — see
 * DESIGN_SYSTEM.md §5) — a header line plus a small grid of labelled fields,
 * repeated. Pulled out once because three pages render the identical shape
 * rather than three slightly-different hand-rolled placeholders.
 */
export function SkeletonEditorRows({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-4 w-4" />
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, fieldIndex) => (
              <div key={fieldIndex}>
                <Skeleton className="h-3 w-16" />
                <Skeleton className="mt-1.5 h-9 w-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** A bar-chart-shaped placeholder — varying heights so it reads as a chart silhouette, not a row of identical blocks. */
export function SkeletonBars({ count = 6 }: { count?: number }) {
  const heights = ["h-16", "h-24", "h-10", "h-20", "h-28", "h-14"];
  return (
    <div className="flex h-40 items-end gap-3 px-2">
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} className={`w-full rounded-t-md rounded-b-none ${heights[index % heights.length]}`} />
      ))}
    </div>
  );
}
