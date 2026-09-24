export interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

/** The shape `ResourceTable`'s `emptyHint` prop accepts beyond a plain string. */
export interface EmptyStateHint {
  message: string;
  action?: EmptyStateAction;
}

export interface EmptyStateOptions {
  /** Plural, lowercase — "leads", "invoices", "work packages". Appears in every branch of the message. */
  entityLabel: string;
  /** A free-text search box has a term in it. */
  hasSearch?: boolean;
  /** A structured filter (stage, status, date range, …) is active, independent of search. */
  hasFilters?: boolean;
  /**
   * Offered only in the true empty-collection branch. A search or filter
   * returning nothing should invite clearing the search or filter, not
   * dangle the same "create one" action a genuinely empty list gets —
   * the two are different problems with different fixes.
   */
  action?: EmptyStateAction;
}

/**
 * One consistent answer to "why is this list empty", instead of every page
 * writing its own slightly-different wording (or, as `ActivityPage.tsx` did
 * before this, writing two branches that happened to render the same
 * sentence). "No data yet" and "no results for this search/filter" are
 * different situations — the first is normal for a young list, the second
 * usually means the search or filter is too narrow — and the message should
 * say which one this is.
 */
export function emptyStateMessage({
  entityLabel,
  hasSearch,
  hasFilters,
  action,
}: EmptyStateOptions): EmptyStateHint {
  if (hasSearch && hasFilters) {
    return { message: `No ${entityLabel} match your search and filters.` };
  }
  if (hasSearch) {
    return { message: `No ${entityLabel} match your search.` };
  }
  if (hasFilters) {
    return { message: `No ${entityLabel} match these filters.` };
  }
  return { message: `No ${entityLabel} yet.`, action };
}
