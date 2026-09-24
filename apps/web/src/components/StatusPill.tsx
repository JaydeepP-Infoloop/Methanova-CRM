/**
 * Colour encodes meaning, so a value always reads the same way wherever it
 * appears: GRANTED is green on the licence board and in a project summary,
 * OVERDUE is red on an invoice row and in the receivables strip. Compliance
 * and Accounts staff scan these columns for exceptions, so an arbitrary
 * (e.g. hashed) colour would actively mislead.
 */
export type StatusTone =
  | "positive"
  | "inflight"
  | "waiting"
  | "problem"
  | "neutral"
  | "brand"
  | "accessNone"
  | "accessRead"
  | "accessWrite"
  | "accessFull";

const TONE_CLASSES: Record<StatusTone, string> = {
  positive: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  inflight: "bg-sky-50 text-sky-700 ring-sky-600/20",
  waiting: "bg-amber-50 text-amber-700 ring-amber-600/20",
  problem: "bg-rose-50 text-rose-700 ring-rose-600/20",
  neutral: "bg-slate-100 text-slate-600 ring-slate-500/20",
  brand: "bg-methanova-greenTint text-methanova-green ring-methanova-green/20",
  /**
   * `AccessLevel` (packages/shared-types/src/permissions.ts) is an ordinal
   * ramp, not a lifecycle state, so it gets its own hue (indigo) rather than
   * borrowing one of the six above. Reusing `inflight` for WRITE or `problem`
   * for FULL would read as "in progress" or "urgent" on the permission
   * matrix, when the actual meaning is just "more access than the last
   * column" — indigo appears nowhere else in the app, so it can't collide.
   * NONE is deliberately the most muted step, not merely absent from the map,
   * because the matrix still needs it to *not* draw the eye if it is ever
   * rendered as a pill rather than the bare "—" the grid itself prefers.
   */
  accessNone: "bg-slate-50 text-slate-400 ring-slate-300/40",
  accessRead: "bg-indigo-50 text-indigo-600 ring-indigo-600/20",
  accessWrite: "bg-indigo-100 text-indigo-700 ring-indigo-600/30",
  accessFull: "bg-indigo-600 text-white ring-indigo-600/40",
};

/**
 * Lifecycle values from packages/shared-types/src/lifecycles.ts, plus the
 * receivables ageing buckets. Values that are metadata rather than state —
 * licence bundles, document kinds, roles, place of supply — deliberately
 * fall through to neutral: they are not statuses and should not compete for
 * attention with the ones that are.
 */
const TONE_BY_VALUE: Record<string, StatusTone> = {
  // Lead stage
  ENQUIRY: "neutral",
  QUALIFICATION: "inflight",
  SITE_VISIT: "inflight",
  QUOTATION: "inflight",
  NEGOTIATION: "inflight",
  MOU: "brand",
  WON: "brand",
  LOST: "problem",

  // Licence status
  NOT_STARTED: "neutral",
  SUBMITTED: "inflight",
  QUERY_PENDING: "waiting",
  AUTHORITY_VISIT: "waiting",
  GRANTED: "positive",
  REJECTED: "problem",
  EXPIRED: "problem",

  // Invoice status
  DRAFT: "neutral",
  PROFORMA_ISSUED: "inflight",
  TAX_INVOICE_ISSUED: "inflight",
  PARTIALLY_PAID: "waiting",
  PAID: "positive",
  OVERDUE: "problem",
  CANCELLED: "problem",
  CREDITED: "problem",

  // Work package status
  PLANNED: "neutral",
  READY: "inflight",
  IN_PROGRESS: "inflight",
  ON_HOLD: "waiting",
  COMPLETED: "positive",
  HANDED_OVER: "positive",

  // MOU status
  SENT: "inflight",
  SIGNED: "positive",

  // Project status
  ACTIVE: "inflight",
  COMMISSIONING: "brand",
  OM: "positive",

  // Lead temperature. HOT gets brand emphasis rather than the "problem" red:
  // a hot lead is good news, and red here would read as an alert.
  COLD: "neutral",
  WARM: "waiting",
  HOT: "brand",

  // Receivables ageing buckets
  CURRENT: "positive",
  "0-30": "inflight",
  "31-60": "waiting",
  "61-90": "waiting",
  "90+": "problem",

  // Permission access levels — the permission-matrix grid is the one place
  // these render as pills; see the tone-class comment above for why they get
  // their own ramp instead of joining one of the tones above.
  NONE: "accessNone",
  READ: "accessRead",
  WRITE: "accessWrite",
  FULL: "accessFull",
};

export function statusTone(value: string): StatusTone {
  return TONE_BY_VALUE[value] ?? "neutral";
}

export interface StatusPillProps {
  value: string;
  /** Override when the caller knows the meaning better than the shared map. */
  tone?: StatusTone;
}

export function StatusPill({ value, tone }: StatusPillProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
        TONE_CLASSES[tone ?? statusTone(value)]
      }`}
    >
      {value.replace(/_/g, " ")}
    </span>
  );
}
