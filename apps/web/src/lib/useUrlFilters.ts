import { useSearchParams } from "react-router-dom";
import type { ListParams } from "./apiResource";

/**
 * A list page's drill-down filters, read from its own query string — how a
 * dashboard count or row lands on an already-filtered list. The page passes
 * `filters` straight to its server-side list query; `clear` drops just these
 * keys and leaves any other query params alone.
 */
export function useUrlFilters<K extends string>(keys: readonly K[]) {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters: ListParams = {};
  for (const key of keys) {
    const value = searchParams.get(key);
    if (value) filters[key] = value;
  }
  const clear = () =>
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        for (const key of keys) next.delete(key);
        return next;
      },
      { replace: true },
    );
  return { filters: filters as Partial<Record<K, string>>, active: Object.keys(filters).length > 0, clear };
}
