import { paiseToDisplay, type Paise } from "@methanova/shared-types";

export function formatPaise(paise: Paise): string {
  return paiseToDisplay(paise);
}

export function formatDate(value: string | Date): string {
  return new Date(value).toLocaleDateString("en-IN");
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 60 * 60 * 1000],
  ["month", 30 * 24 * 60 * 60 * 1000],
  ["day", 24 * 60 * 60 * 1000],
  ["hour", 60 * 60 * 1000],
  ["minute", 60 * 1000],
];
const relativeFormatter = new Intl.RelativeTimeFormat("en-IN", { numeric: "auto" });

/** "3 hours ago", "yesterday" — for the notification bell's timestamps, not precise enough a use to warrant a date-math dependency. */
export function formatRelativeTime(value: string | Date): string {
  const diffMs = new Date(value).getTime() - Date.now();
  for (const [unit, unitMs] of RELATIVE_UNITS) {
    if (Math.abs(diffMs) >= unitMs) {
      return relativeFormatter.format(Math.round(diffMs / unitMs), unit);
    }
  }
  return "just now";
}

/** 1 crore = 1,00,00,000 rupees = 1e9 paise. */
const PAISE_PER_CRORE = 1_000_000_000;

/**
 * EPC deal values here run to crores, and asking someone to type 75000000 for
 * ₹7.5 crore invites a misplaced zero. The form collects crore and converts
 * once, here, on the way out.
 *
 * `Math.round` is the right call at exactly this boundary and nowhere else:
 * a human-entered decimal has to become integer paise somewhere, and doing it
 * once on submit — the same thing `rupeesToPaise` does — is what keeps every
 * later calculation on whole paise. Returns null for blank input so "not
 * priced" survives as null rather than collapsing to ₹0.
 */
export function croreToPaise(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const crore = Number(trimmed);
  if (!Number.isFinite(crore)) return null;
  return Math.round(crore * PAISE_PER_CRORE);
}

/** The inverse, for seeding an edit form from a stored amount. */
export function paiseToCrore(paise: number): string {
  return String(paise / PAISE_PER_CRORE);
}

/**
 * Compact form for the stat row, where "₹12,50,00,000.00" is more precision
 * than a headline number needs and wide enough to wrap the card.
 */
export function formatPaiseAsCrore(paise: Paise): string {
  const crore = paise / PAISE_PER_CRORE;
  if (crore === 0) return "₹0";
  // Two decimals below 100 crore, none above — past that point the decimal is noise.
  return `₹${crore >= 100 ? Math.round(crore).toLocaleString("en-IN") : crore.toFixed(2)} Cr`;
}
