import { Search, SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./Button";

export interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  placeholder?: string;
  /** Second row — view toggles, selects, date ranges. */
  children?: ReactNode;
  /** Rendered only when the page actually has filters to offer. */
  onOpenFilters?: () => void;
}

export function FilterBar({
  search,
  onSearchChange,
  placeholder = "Search…",
  children,
  onOpenFilters,
}: FilterBarProps) {
  return (
    <div className="mb-4 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[16rem] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold"
          />
        </div>
        {onOpenFilters && (
          <Button variant="secondary" icon={<SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />} onClick={onOpenFilters}>
            Filter
          </Button>
        )}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

/** Case-insensitive match across the given fields — the filtering every list page needs before it needs anything cleverer. */
export function filterRows<Row extends Record<string, unknown>>(
  rows: Row[],
  search: string,
  fields: string[],
): Row[] {
  const term = search.trim().toLowerCase();
  if (!term) return rows;
  return rows.filter((row) =>
    fields.some((field) => String(row[field] ?? "").toLowerCase().includes(term)),
  );
}
