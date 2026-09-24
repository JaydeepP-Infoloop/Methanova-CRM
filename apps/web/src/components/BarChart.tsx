export interface BarChartSeries {
  label: string;
  /** Tailwind fill class, e.g. "fill-methanova-green". */
  colorClass: string;
  values: number[];
}

export interface BarChartProps {
  categories: string[];
  series: BarChartSeries[];
  /** Turns a raw value into axis/tooltip text — pass the paise formatter for money. */
  formatValue?: (value: number) => string;
  emptyHint?: string;
  height?: number;
}

const CHART_WIDTH = 640;

/**
 * Deliberately hand-rolled rather than pulling a charting library: the app
 * needs exactly two shapes (this and DonutMeter), and a dependency doesn't
 * earn its weight for that. Revisit if chart types multiply.
 */
export function BarChart({
  categories,
  series,
  formatValue = (value) => String(value),
  emptyHint = "No data yet.",
  height = 220,
}: BarChartProps) {
  const hasData = categories.length > 0 && series.some((s) => s.values.some((v) => v > 0));

  if (!hasData) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-500"
        style={{ height }}
      >
        {emptyHint}
      </div>
    );
  }

  const max = Math.max(...series.flatMap((s) => s.values), 1);
  const plotHeight = height - 28;
  const groupWidth = CHART_WIDTH / categories.length;
  const barWidth = Math.max(2, (groupWidth * 0.62) / series.length);

  return (
    <figure>
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Bar chart: ${series.map((s) => s.label).join(" and ")} across ${categories.length} periods`}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
          <line
            key={tick}
            x1={0}
            x2={CHART_WIDTH}
            y1={plotHeight - tick * plotHeight}
            y2={plotHeight - tick * plotHeight}
            className="stroke-slate-100"
            strokeWidth={1}
          />
        ))}

        {categories.map((category, categoryIndex) => (
          <g key={category}>
            {series.map((s, seriesIndex) => {
              const value = s.values[categoryIndex] ?? 0;
              const barHeight = (value / max) * plotHeight;
              const x =
                categoryIndex * groupWidth +
                (groupWidth - barWidth * series.length) / 2 +
                seriesIndex * barWidth;
              return (
                <rect
                  key={s.label}
                  x={x}
                  y={plotHeight - barHeight}
                  width={barWidth - 1}
                  height={barHeight}
                  rx={2}
                  className={s.colorClass}
                >
                  <title>{`${category} · ${s.label}: ${formatValue(value)}`}</title>
                </rect>
              );
            })}
            <text
              x={categoryIndex * groupWidth + groupWidth / 2}
              y={height - 8}
              textAnchor="middle"
              className="fill-slate-400 text-[10px]"
            >
              {category}
            </text>
          </g>
        ))}
      </svg>

      <figcaption className="mt-3 flex flex-wrap items-center gap-4">
        {series.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5 text-xs text-slate-600">
            <svg className="h-2.5 w-2.5" viewBox="0 0 10 10" aria-hidden="true">
              <rect width="10" height="10" rx="2" className={s.colorClass} />
            </svg>
            {s.label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
