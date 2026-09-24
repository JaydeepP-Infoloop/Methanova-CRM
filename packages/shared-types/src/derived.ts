import { InvoiceStatus, LicenceStatus, WorkPackageStatus } from "./lifecycles.js";

/**
 * Values computed at read time from stored fields — never stored themselves,
 * so they cannot go stale (the same reason a lead's `daysWaiting` is derived
 * rather than kept as a counter). Pure functions in shared-types so the API
 * and any later dashboard aggregation apply exactly one rule each.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function wholeDaysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS);
}

type DateLike = Date | string | null | undefined;

function toDate(value: DateLike): Date | null {
  return value ? new Date(value) : null;
}

const WORK_PACKAGE_DONE: string[] = [WorkPackageStatus.COMPLETED, WorkPackageStatus.HANDED_OVER];

/**
 * Past `plannedEnd` by at least a whole day with `percentComplete` under 100.
 * A COMPLETED/HANDED_OVER package is never delayed, whatever its stored
 * percentage — the terminal status is the stronger fact.
 */
export function workPackageDelay(
  workPackage: { status: string; plannedEnd?: DateLike; percentComplete?: number | null },
  now: Date = new Date(),
): { isDelayed: boolean; daysDelayed: number } {
  const plannedEnd = toDate(workPackage.plannedEnd);
  if (!plannedEnd || WORK_PACKAGE_DONE.includes(workPackage.status)) return { isDelayed: false, daysDelayed: 0 };
  const days = wholeDaysBetween(plannedEnd, now);
  const isDelayed = days >= 1 && (workPackage.percentComplete ?? 0) < 100;
  return { isDelayed, daysDelayed: isDelayed ? days : 0 };
}

/**
 * The SoW's weighted average of work-package completion, weighted by each
 * package's `amountPaise`. Null — not 0 — when a project has no work
 * packages yet: "no schedule built" is not "0% done". Falls back to a plain
 * average when every package is unpriced, rather than dividing by zero.
 */
export function weightedProgressPct(
  workPackages: { status: string; percentComplete?: number | null; amountPaise?: number | null }[],
): number | null {
  if (workPackages.length === 0) return null;
  const pct = (workPackage: (typeof workPackages)[number]) =>
    WORK_PACKAGE_DONE.includes(workPackage.status)
      ? 100
      : Math.min(Math.max(workPackage.percentComplete ?? 0, 0), 100);
  const totalWeight = workPackages.reduce((sum, workPackage) => sum + (workPackage.amountPaise ?? 0), 0);
  if (totalWeight > 0) {
    const weighted = workPackages.reduce((sum, workPackage) => sum + pct(workPackage) * (workPackage.amountPaise ?? 0), 0);
    return Math.round(weighted / totalWeight);
  }
  return Math.round(workPackages.reduce((sum, workPackage) => sum + pct(workPackage), 0) / workPackages.length);
}

const LICENCE_CLEARED: string[] = [LicenceStatus.GRANTED, LicenceStatus.EXPIRED];

/**
 * Target date passed without a `clearedDate`. GRANTED/EXPIRED also count as
 * cleared so a licence granted before `clearedDate` existed does not read as
 * overdue. A REJECTED licence past its target *is* overdue — it still has to
 * be re-applied for and is still blocking the project.
 */
export function licenceOverdue(
  licence: { status: string; targetDate?: DateLike; clearedDate?: DateLike },
  now: Date = new Date(),
): { isOverdue: boolean; daysOverdue: number } {
  const targetDate = toDate(licence.targetDate);
  if (!targetDate || licence.clearedDate || LICENCE_CLEARED.includes(licence.status)) {
    return { isOverdue: false, daysOverdue: 0 };
  }
  const days = wholeDaysBetween(targetDate, now);
  return days >= 1 ? { isOverdue: true, daysOverdue: days } : { isOverdue: false, daysOverdue: 0 };
}

/** The receivables ageing bands — the same boundaries `AgeingBadge` has always used, now defined once. */
export const AgeingBucket = {
  CURRENT: "CURRENT",
  DAYS_0_30: "0-30",
  DAYS_31_60: "31-60",
  DAYS_61_90: "61-90",
  DAYS_90_PLUS: "90+",
} as const;
export type AgeingBucket = (typeof AgeingBucket)[keyof typeof AgeingBucket];

export function ageingBucket(daysPastDue: number): AgeingBucket {
  if (daysPastDue <= 0) return AgeingBucket.CURRENT;
  if (daysPastDue <= 30) return AgeingBucket.DAYS_0_30;
  if (daysPastDue <= 60) return AgeingBucket.DAYS_31_60;
  if (daysPastDue <= 90) return AgeingBucket.DAYS_61_90;
  return AgeingBucket.DAYS_90_PLUS;
}

/** Statuses that are an open receivable — issued and not yet settled, cancelled or credited. */
const INVOICE_RECEIVABLE: string[] = [
  InvoiceStatus.PROFORMA_ISSUED,
  InvoiceStatus.TAX_INVOICE_ISSUED,
  InvoiceStatus.PARTIALLY_PAID,
  InvoiceStatus.OVERDUE,
];

/**
 * Ageing is measured from `dueDate`. An invoice that isn't an open
 * receivable (DRAFT, PAID, CANCELLED, CREDITED) or has no due date yet has
 * no bucket at all — `null`, not CURRENT, because "not owed" and "owed but
 * not yet due" are different answers.
 */
export function invoiceAgeing(
  invoice: { status: string; dueDate?: DateLike },
  now: Date = new Date(),
): { isOverdue: boolean; daysOverdue: number; ageingBucket: AgeingBucket | null } {
  const dueDate = toDate(invoice.dueDate);
  if (!dueDate || !INVOICE_RECEIVABLE.includes(invoice.status)) {
    return { isOverdue: false, daysOverdue: 0, ageingBucket: null };
  }
  const days = wholeDaysBetween(dueDate, now);
  return { isOverdue: days >= 1, daysOverdue: Math.max(days, 0), ageingBucket: ageingBucket(days) };
}
