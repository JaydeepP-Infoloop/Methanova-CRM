import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import type { EmptyStateHint } from "../lib/emptyState";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";

export interface ResourceColumn<Row> {
  key: string;
  label: string;
  render?: (row: Row) => ReactNode;
  /** Money and counts read better right-aligned so digits line up down the column. */
  align?: "left" | "right";
  /** Opt in per column; sorting uses `sortValue` when given, else the raw field. */
  sortable?: boolean;
  sortValue?: (row: Row) => string | number;
}

/** How many placeholder rows a loading table shows — enough to read as "a table of results", not a fixed prediction of the real count. */
const SKELETON_ROW_COUNT = 5;

export interface ResourceTableProps<Row> {
  rows: Row[];
  columns: ResourceColumn<Row>[];
  isLoading?: boolean;
  error?: Error | null;
  /** A plain string for a simple message, or `{ message, action }` for an empty state that also offers something to do about it (e.g. "Add Lead"). */
  emptyHint?: string | EmptyStateHint;
  /** Enables the checkbox column. Selection is held here; the page reads it via onSelectionChange. */
  selectable?: boolean;
  onSelectionChange?: (selectedIds: string[]) => void;
  /** Makes rows navigable. Rows become keyboard-focusable when set, so this is not mouse-only. */
  onRowClick?: (row: Row) => void;
  /** Briefly tints a row — used to point at a record that was just created. */
  highlightRowId?: string | null;
  /**
   * Shown in a trailing column. Hidden until the row is hovered or contains
   * focus, so a table of 25 leads is not a wall of buttons. Keyboard users
   * still reach them via tab into the row (`group-focus-within`).
   */
  rowActions?: (row: Row) => ReactNode;
}

interface SortState {
  key: string;
  direction: "asc" | "desc";
}

function rowId(row: Record<string, unknown>, index: number): string {
  return (row._id as string) ?? String(index);
}

function compare(a: string | number, b: string | number): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true });
}

/** Generic list table every module page renders its resource hook's data through. */
export function ResourceTable<Row extends Record<string, unknown>>({
  rows,
  columns,
  isLoading,
  error,
  emptyHint = "No records yet.",
  selectable = false,
  onSelectionChange,
  onRowClick,
  highlightRowId,
  rowActions,
}: ResourceTableProps<Row>) {
  const [sort, setSort] = useState<SortState | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((c) => c.key === sort.key);
    if (!column) return rows;
    const value = (row: Row) => column.sortValue?.(row) ?? (row[column.key] as string | number) ?? "";
    // Copy first: sorting the prop array in place would mutate the query cache.
    return [...rows].sort((a, b) => (sort.direction === "asc" ? 1 : -1) * compare(value(a), value(b)));
  }, [rows, columns, sort]);

  function toggleSort(key: string) {
    setSort((current) =>
      current?.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" },
    );
  }

  function updateSelection(next: string[]) {
    setSelected(next);
    onSelectionChange?.(next);
  }

  function toggleRow(id: string) {
    updateSelection(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  }

  const allIds = sortedRows.map((row, index) => rowId(row, index));
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.includes(id));
  const columnCount = columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0);

  const hint: EmptyStateHint = typeof emptyHint === "string" ? { message: emptyHint } : emptyHint;

  const messageRow = error ? (
    <td className="px-4 py-8 text-sm text-rose-600" colSpan={columnCount}>
      {error.message}
    </td>
  ) : !isLoading && sortedRows.length === 0 ? (
    <td className="px-4 py-10 text-center" colSpan={columnCount}>
      <p className="text-sm text-slate-500">{hint.message}</p>
      {hint.action && (
        <Button className="mt-4" onClick={hint.action.onClick}>
          {hint.action.label}
        </Button>
      )}
    </td>
  ) : null;

  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200/70">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/80">
            <tr>
              {selectable && (
                <th scope="col" className="w-10 px-4 py-2.5">
                  <input
                    type="checkbox"
                    aria-label={allSelected ? "Clear selection" : "Select all rows"}
                    checked={allSelected}
                    onChange={() => updateSelection(allSelected ? [] : allIds)}
                    className="h-4 w-4 rounded border-slate-300 text-methanova-green focus-visible:ring-methanova-gold"
                  />
                </th>
              )}
              {columns.map((column) => {
                const isSorted = sort?.key === column.key;
                const SortIcon = !isSorted ? ChevronsUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 ${
                      column.align === "right" ? "text-right" : ""
                    }`}
                  >
                    {column.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column.key)}
                        aria-label={`Sort by ${column.label}`}
                        // `uppercase` is repeated here on purpose: Preflight resets
                        // text-transform on buttons, so the th's uppercase does not
                        // reach it and sortable headers would render in title case
                        // while the rest of the row stayed uppercase.
                        className={`inline-flex items-center gap-1 rounded uppercase tracking-wide hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold ${
                          isSorted ? "text-slate-800" : ""
                        }`}
                      >
                        {column.label}
                        <SortIcon className="h-3 w-3" aria-hidden="true" />
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                );
              })}
              {rowActions && <th scope="col" className="px-4 py-2.5"><span className="sr-only">Actions</span></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              // Rows shaped like the real table, not one line of "Loading…"
              // text — the column count is known even before the data is,
              // so the placeholder can already look like this table.
              Array.from({ length: SKELETON_ROW_COUNT }).map((_, rowIndex) => (
                <tr key={`skeleton-${rowIndex}`}>
                  {selectable && (
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-4" />
                    </td>
                  )}
                  {columns.map((column, columnIndex) => (
                    <td key={column.key} className={`px-4 py-3 ${column.align === "right" ? "text-right" : ""}`}>
                      <Skeleton
                        className={`h-4 ${
                          column.align === "right"
                            ? "ml-auto w-12"
                            : columnIndex % 3 === 0
                              ? "w-3/4"
                              : columnIndex % 3 === 1
                                ? "w-1/2"
                                : "w-2/3"
                        }`}
                      />
                    </td>
                  ))}
                  {rowActions && (
                    <td className="px-4 py-3">
                      <Skeleton className="ml-auto h-4 w-16" />
                    </td>
                  )}
                </tr>
              ))
            ) : messageRow ? (
              <tr>{messageRow}</tr>
            ) : (
              sortedRows.map((row, index) => {
                const id = rowId(row, index);
                const isHighlighted = highlightRowId !== null && highlightRowId === id;
                return (
                  <tr
                    key={id}
                    // Rows are reachable by keyboard when clickable, so navigation
                    // is not limited to pointer users.
                    tabIndex={onRowClick ? 0 : undefined}
                    role={onRowClick ? "link" : undefined}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    onKeyDown={
                      onRowClick
                        ? (event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              onRowClick(row);
                            }
                          }
                        : undefined
                    }
                    className={`group ${onRowClick ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-methanova-gold" : ""} ${
                      isHighlighted ? "bg-methanova-goldTint" : "hover:bg-slate-50/70"
                    }`}
                  >
                    {selectable && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          aria-label={`Select row ${index + 1}`}
                          checked={selected.includes(id)}
                          onChange={() => toggleRow(id)}
                          className="h-4 w-4 rounded border-slate-300 text-methanova-green focus-visible:ring-methanova-gold"
                        />
                      </td>
                    )}
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={`px-4 py-3 text-slate-700 ${
                          column.align === "right" ? "text-right tabular-nums" : ""
                        }`}
                      >
                        {column.render ? column.render(row) : String(row[column.key] ?? "—")}
                      </td>
                    ))}
                    {rowActions && (
                      <td className="px-4 py-3 text-right">
                        <div
                          className="flex justify-end gap-1.5 opacity-0 transition-opacity duration-150 motion-reduce:transition-none group-hover:opacity-100 group-focus-within:opacity-100"
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          {rowActions(row)}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
