/**
 * Enum values use UPPER_SNAKE like every other lifecycle enum in this
 * codebase, for the same reason the Lead model uses camelCase fields: one
 * convention per codebase beats matching a specification's casing literally.
 */
export const ActivityType = {
  CALL: "CALL",
  EMAIL: "EMAIL",
  WHATSAPP: "WHATSAPP",
  MEETING: "MEETING",
  PRESENTATION: "PRESENTATION",
  PLANT_VISIT: "PLANT_VISIT",
  SITE_VISIT: "SITE_VISIT",
  NOTE: "NOTE",
} as const;
export type ActivityType = (typeof ActivityType)[keyof typeof ActivityType];

export const ACTIVITY_TYPE_ORDER: ActivityType[] = [
  ActivityType.CALL,
  ActivityType.EMAIL,
  ActivityType.WHATSAPP,
  ActivityType.MEETING,
  ActivityType.PRESENTATION,
  ActivityType.PLANT_VISIT,
  ActivityType.SITE_VISIT,
  ActivityType.NOTE,
];

/** Polymorphic parent. Only LEAD is reachable today; PROJECT follows in Module B. */
export const ActivityParentType = {
  LEAD: "LEAD",
  PROJECT: "PROJECT",
} as const;
export type ActivityParentType = (typeof ActivityParentType)[keyof typeof ActivityParentType];

/**
 * A guardrail on the outcome field, not a replacement for it. Free text alone
 * had already let an Excel date serial ("43244") and a bare "120" into
 * production rows — nothing stopped a pasted spreadsheet cell from landing
 * there. A short pick-list is now the primary answer; `outcome` remains for
 * genuine elaboration ("client wants a revised quote by Friday"), but the
 * validation layer requires a category before it accepts free text, so a
 * stray value can no longer arrive with nothing to anchor it.
 */
export const ActivityOutcomeCategory = {
  POSITIVE_MOVING_FORWARD: "POSITIVE_MOVING_FORWARD",
  NEUTRAL_AWAITING_DECISION: "NEUTRAL_AWAITING_DECISION",
  NEGATIVE_NOT_INTERESTED: "NEGATIVE_NOT_INTERESTED",
  NO_RESPONSE: "NO_RESPONSE",
  RESCHEDULED: "RESCHEDULED",
  OTHER: "OTHER",
} as const;
export type ActivityOutcomeCategory =
  (typeof ActivityOutcomeCategory)[keyof typeof ActivityOutcomeCategory];

export const ACTIVITY_OUTCOME_CATEGORY_ORDER: ActivityOutcomeCategory[] = [
  ActivityOutcomeCategory.POSITIVE_MOVING_FORWARD,
  ActivityOutcomeCategory.NEUTRAL_AWAITING_DECISION,
  ActivityOutcomeCategory.NEGATIVE_NOT_INTERESTED,
  ActivityOutcomeCategory.NO_RESPONSE,
  ActivityOutcomeCategory.RESCHEDULED,
  ActivityOutcomeCategory.OTHER,
];

export const ACTIVITY_OUTCOME_CATEGORY_LABELS: Record<ActivityOutcomeCategory, string> = {
  POSITIVE_MOVING_FORWARD: "Positive — moving forward",
  NEUTRAL_AWAITING_DECISION: "Neutral — awaiting decision",
  NEGATIVE_NOT_INTERESTED: "Negative — not interested",
  NO_RESPONSE: "No response",
  RESCHEDULED: "Rescheduled",
  OTHER: "Other",
};

/**
 * A NOTE is internal record-keeping, not contact with the client, so it must
 * never stamp firstResponseAt. Every other type represents an outward touch.
 * Shared so the server rule and any client-side explanation of it cannot drift.
 */
export function countsAsFirstResponse(type: string): boolean {
  return type !== ActivityType.NOTE;
}

export function requiresPlantVisitDetail(type: string): boolean {
  return type === ActivityType.PLANT_VISIT;
}

export function requiresSiteVisitDetail(type: string): boolean {
  return type === ActivityType.SITE_VISIT;
}

export interface ActivityParticipantDto {
  id: string;
  name: string;
}

export interface PlantVisitDetailDto {
  referencePlantId?: string | null;
  referencePlantName?: string | null;
  visitorCount?: number | null;
  visitorDesignations?: string | null;
  travelArrangedBy?: string | null;
  feedbackRating?: number | null;
  feedbackNotes?: string | null;
}

export interface SiteVisitDetailDto {
  gpsLat?: number | null;
  gpsLng?: number | null;
  observations?: string | null;
}

export interface ActivityDto {
  id: string;
  parentType: ActivityParentType;
  parentId: string;
  /** Per-parent running number, so "the third follow-up" means something. */
  sequenceNo: number;
  type: ActivityType;
  occurredAt: string;
  /** Who logged this activity — distinct from `internalParticipants`, who were on the call/visit itself. */
  loggedByUserId?: string | null;
  internalParticipants: ActivityParticipantDto[];
  externalContactNames: string[];
  summary: string;
  outcomeCategory?: ActivityOutcomeCategory | null;
  outcome?: string | null;
  nextFollowUpDate?: string | null;
  nextFollowUpAction?: string | null;
  plantVisit?: PlantVisitDetailDto | null;
  siteVisit?: SiteVisitDetailDto | null;
  createdAt: string;
}

/**
 * The flat, cross-lead Activity Log's own row shape. `companyName`/`leadCode`
 * are denormalised onto the row server-side (a one-time join against the
 * lead the moment the page is built) rather than resolved client-side the
 * way the old scaffold page did — see ActivityPage.tsx.
 */
export interface ActivityListItemDto {
  id: string;
  parentType: ActivityParentType;
  parentId: string;
  leadCode?: string | null;
  companyName?: string | null;
  sequenceNo: number;
  type: ActivityType;
  occurredAt: string;
  loggedByUserId?: string | null;
  loggedByUserName?: string | null;
  internalParticipants: ActivityParticipantDto[];
  externalContactNames: string[];
  summary: string;
  outcomeCategory?: ActivityOutcomeCategory | null;
  outcome?: string | null;
  nextFollowUpDate?: string | null;
  nextFollowUpAction?: string | null;
  /**
   * Whether this activity's own committed follow-up was answered by a later
   * activity on the same lead, and if so, whether that later activity landed
   * before or after the date promised here. `null` means no follow-up was
   * committed on this activity at all — there is nothing to have kept or broken.
   */
  followUpOutcome: "PENDING" | "KEPT" | "BROKEN" | null;
}

export interface ActivityListSummaryDto {
  /** Rolling 7 days, not a calendar week — see the service for why. */
  loggedThisWeek: number;
  calls: number;
  /** PLANT_VISIT and SITE_VISIT combined — both are "went and looked at something". */
  visits: number;
  emails: number;
  /** Activities with a `nextFollowUpDate` still in the future — work promised, not yet due. */
  followUpsCommitted: number;
  /** Activities with a `nextFollowUpDate` in the past — a promise that has come due. */
  promisesOverdue: number;
}

export interface ActivityListResponseDto {
  items: ActivityListItemDto[];
  total: number;
  page: number;
  pageSize: number;
  /** Always scoped to the same filters as `items` — see leads' inbox summary for the same rule. */
  summary: ActivityListSummaryDto;
}
