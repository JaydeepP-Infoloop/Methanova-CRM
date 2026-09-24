export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  /** Rendered as a trailing count badge. Omit while the number is still loading — never pass 0 as a placeholder. */
  count?: number;
}

export interface SegmentedFilterProps<T extends string> {
  /** Labels the group for screen readers, e.g. "Filter the inbox". */
  label: string;
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

/**
 * A one-of-N segmented control for the primary cut of a list.
 *
 * It exists because the inbox's headline filters are mutually exclusive by
 * nature — you are looking at everything, or the unassigned ones, or today's
 * arrivals — and a row of independently-toggling cards modelled them as
 * combinable when they are not. Radios, not checkboxes, both semantically
 * (`role="radiogroup"`) and visually.
 *
 * Secondary, genuinely combinable filters (stage, temperature) stay in
 * `FilterBar` beside the search box; this bar is only ever the primary cut.
 */
export function SegmentedFilter<T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedFilterProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200/70"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold ${
              selected
                ? "bg-methanova-greenTint text-methanova-green"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {option.label}
            {option.count !== undefined && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-xs tabular-nums ${
                  selected ? "bg-methanova-green/10 text-methanova-green" : "bg-slate-100 text-slate-500"
                }`}
              >
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
