import { LeadStage } from "./lifecycles.js";
import type { Paise } from "./money.js";

/** Where a brand-new lead starts. Referenced instead of hardcoding "ENQUIRY" at call sites. */
export const NEW_LEAD_STAGE: LeadStage = LeadStage.ENQUIRY;

export const EntityType = {
  PROPRIETORSHIP: "PROPRIETORSHIP",
  PARTNERSHIP: "PARTNERSHIP",
  LLP: "LLP",
  PRIVATE_LIMITED: "PRIVATE_LIMITED",
  PUBLIC_LIMITED: "PUBLIC_LIMITED",
  COOPERATIVE: "COOPERATIVE",
  TRUST_SOCIETY: "TRUST_SOCIETY",
  GOVERNMENT: "GOVERNMENT",
  OTHER: "OTHER",
} as const;
export type EntityType = (typeof EntityType)[keyof typeof EntityType];

export const LeadTemperature = {
  COLD: "COLD",
  WARM: "WARM",
  HOT: "HOT",
} as const;
export type LeadTemperature = (typeof LeadTemperature)[keyof typeof LeadTemperature];

/** Temperature a lead is created at — it has to start somewhere, and "unproven" is the honest default. */
export const DEFAULT_LEAD_TEMPERATURE: LeadTemperature = LeadTemperature.COLD;

export const FeedstockTieupStatus = {
  NOT_STARTED: "NOT_STARTED",
  IN_DISCUSSION: "IN_DISCUSSION",
  VERBAL_COMMITMENT: "VERBAL_COMMITMENT",
  AGREEMENT_SIGNED: "AGREEMENT_SIGNED",
} as const;
export type FeedstockTieupStatus = (typeof FeedstockTieupStatus)[keyof typeof FeedstockTieupStatus];

/**
 * Whether a source needs `sourceDetail` is the `detailRequired` flag on its
 * master row — it is admin-editable and has no hardcoded counterpart here.
 * A constant list used to exist alongside it and silently won any
 * disagreement, which made the admin screen's toggle a lie.
 */

/**
 * Format rules for Indian statutory identifiers. They live here so the intake
 * form and the API validate identically — a field the client accepts but the
 * server rejects is a wasted round trip and a confusing error.
 */
export const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;
export const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const CIN_PATTERN = /^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/;
/** Exactly ten digits, per the intake spec — deliberately not narrowed to the 6-9 leading digit. */
export const MOBILE_PATTERN = /^[0-9]{10}$/;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface LeadContactDto {
  name: string;
  designation?: string;
  mobile: string;
  email?: string;
  isPrimary: boolean;
  isDecisionMaker: boolean;
}

export interface GeographyRefDto {
  id: string;
  name: string;
}

export interface LeadListItemDto {
  id: string;
  leadCode: string;
  companyName: string;
  stage: LeadStage;
  temperature: LeadTemperature;
  districtName?: string;
  stateName?: string;
  sourceName?: string;
  feedstockQtyTpd: number;
  expectedCbgTpd: number;
  /** Integer paise, or null when nobody has put a number on the deal yet. Never 0 for "unknown". */
  indicativeValuePaise: Paise | null;
  ownerUserId: string | null;
  ownerName?: string | null;
  firstResponseAt: string | null;
  nextAction: string;
  nextActionDate: string;
  createdAt: string;
  /** Whole days since creation — computed server-side so every client agrees on "waiting". */
  daysWaiting: number;
  /** Whole days since the last legal stage move — ageing on the board, distinct from total wait. */
  daysInStage: number;
  /** Orthogonal to `stage`; the board paints a parked pill rather than a fake stage. */
  isParked: boolean;
  slaBreached: boolean;
}

/**
 * Two different scopes on purpose. Whole-collection figures (`unassigned`,
 * `noFirstResponse`, `arrivedToday`, `open`, `openIndicativeValueTotalPaise`,
 * `parkedDueForRevisit`) are filter *targets* or company-pulse numbers — narrowing
 * them to the active inbox filter would make "Unassigned" describe its own subset.
 * The last two are computed over the **active filter**, because they describe the
 * result set currently on screen.
 */
export interface LeadInboxSummaryDto {
  /** Derived at query time from ownerUserId being null — never a stored counter. */
  unassigned: number;
  /** Derived at query time from firstResponseAt being null. */
  noFirstResponse: number;
  /** Created since midnight. Counted server-side: with oldest-first paging these sit on the last page. */
  arrivedToday: number;
  /**
   * Whole-collection open pipeline (not WON/LOST). Dashboard reads these rather
   * than inventing an `/api/reports` roll-up; they ignore the inbox's active filter
   * the same way `unassigned` does, because they are company-pulse figures.
   */
  open: number;
  openIndicativeValueTotalPaise: Paise;
  /** Parked leads whose revisit date is today or earlier — due back, not merely shelved. */
  parkedDueForRevisit: number;
  /** Sum over the filtered set. Unpriced leads contribute nothing rather than being treated as zero-value. */
  indicativeValueTotalPaise: Paise;
  /** Days the longest-waiting lead in the filtered set has been waiting; 0 when the set is empty. */
  slowestDaysWaiting: number;
}
