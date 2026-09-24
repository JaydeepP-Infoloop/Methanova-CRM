import { Link } from "react-router-dom";
import { IdentityCell } from "./IdentityCell";

export interface RefCellProps {
  /** The raw foreign key. Shown as a fallback when the name could not be resolved. */
  id: string;
  /** Resolved display name. Absent means the parent was not in the loaded page. */
  name?: string;
  secondary?: string;
  /**
   * Detail route for this record. **Omit it when no such route exists yet** —
   * the cell then renders unlinked rather than sending someone to a 404. Most
   * modules in this app are still list-only.
   */
  to?: string;
}

/** Enough of a Mongo id to tell two rows apart without filling the column. */
function shortId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

/**
 * A foreign key rendered as the thing it points at.
 *
 * Several list pages carry ids to parent records — an activity's lead, a
 * payment schedule's project, a progress update's work package — and printing
 * a 24-character ObjectId tells the reader nothing. The page resolves the name
 * from a list it already fetches and passes it here.
 *
 * When the name is missing, this deliberately drops out of `IdentityCell` and
 * renders a plain short id instead. `IdentityCell` is for rows that have an
 * identity; an avatar bubble reading "6A" over a hex string is decoration
 * pretending to be information.
 */
export function RefCell({ id, name, secondary, to }: RefCellProps) {
  const body = name ? (
    <IdentityCell name={name} secondary={secondary} />
  ) : (
    <span className="font-mono text-xs text-slate-400" title={id}>
      {shortId(id)}
    </span>
  );

  if (!to) return body;

  return (
    <Link
      to={to}
      // The row itself may also be clickable; a nested link must not trigger both.
      onClick={(event) => event.stopPropagation()}
      className="inline-block rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold hover:underline"
    >
      {body}
    </Link>
  );
}
