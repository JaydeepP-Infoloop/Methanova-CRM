export interface DonutMeterProps {
  value: number;
  total: number;
  /** Shown under the percentage, e.g. "Licences granted". */
  caption?: string;
  size?: number;
}

const STROKE = 12;

/** Single-value completion ring — compliance progress, work-package completion. */
export function DonutMeter({ value, total, caption, size = 160 }: DonutMeterProps) {
  const safeTotal = Math.max(total, 0);
  const ratio = safeTotal === 0 ? 0 : Math.min(Math.max(value / safeTotal, 0), 1);
  const percent = Math.round(ratio * 100);
  const radius = (size - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="flex flex-col items-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={safeTotal === 0 ? "No data yet" : `${percent}% — ${value} of ${safeTotal}`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={STROKE}
          className="stroke-slate-100"
        />
        {safeTotal > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${ratio * circumference} ${circumference}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            className="stroke-methanova-green transition-[stroke-dasharray] duration-500"
          />
        )}
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-slate-900 text-2xl font-semibold tabular-nums"
        >
          {safeTotal === 0 ? "—" : `${percent}%`}
        </text>
      </svg>
      {caption && (
        <p className="mt-2 text-center text-xs text-slate-500">
          {safeTotal === 0 ? caption : `${caption} · ${value} of ${safeTotal}`}
        </p>
      )}
    </div>
  );
}
