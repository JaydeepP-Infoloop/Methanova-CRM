import type { LeadTemperature } from "./leads.js";
import type { LeadStage } from "./lifecycles.js";
import type { Paise } from "./money.js";

/**
 * Where a My Day row's due date came from. A lead can owe a follow-up for one
 * of three genuinely different reasons, and the row says which: a normal
 * committed next action, a parked lead whose revisit date has arrived, or a
 * lost lead whose re-engagement date is due. All three render through the
 * same row shape because the action is always the same — log a follow-up, or
 * open the lead — but the commitment text is worded differently per source.
 */
export const MyDaySource = {
  NEXT_ACTION: "NEXT_ACTION",
  PARKED_REVISIT: "PARKED_REVISIT",
  REENGAGE: "REENGAGE",
} as const;
export type MyDaySource = (typeof MyDaySource)[keyof typeof MyDaySource];

export interface MyDayProvenanceDto {
  /** The activity that made this commitment — "follow-up 3" in the UI. */
  sequenceNo: number;
  /** When that activity happened, i.e. when the promise was made — not when it was logged. */
  promisedAt: string;
  promisedByUserId: string | null;
  promisedByUserName: string | null;
}

export interface MyDayRowDto {
  leadId: string;
  leadCode: string;
  companyName: string;
  temperature: LeadTemperature;
  stage: LeadStage;
  isParked: boolean;
  /** So the row can say "follow-up 4" the same way the lead detail page does. */
  followUpsDoneCount: number;
  indicativeValuePaise: Paise | null;
  dueDate: string;
  /** Positive means overdue by this many days; 0 means due today or later. */
  daysLate: number;
  source: MyDaySource;
  commitmentText: string;
  provenance: MyDayProvenanceDto | null;
}

export interface MyDayBucketDto {
  count: number;
  /** Sum of `indicativeValuePaise` across the bucket's rows; nulls contribute nothing. */
  valueTotalPaise: Paise;
  items: MyDayRowDto[];
}

export interface MyDaySummaryDto {
  overdueFollowUps: number;
  dueToday: number;
  restOfWeek: number;
  /** Leads assigned to this scope that have never had a first response — a different kind of "owed", tracked separately from committed follow-ups. */
  inboxNeedingAction: number;
  /** Activities logged today by this scope — the credit side of the ledger the other four numbers are the debit side of. */
  completedToday: number;
}

export interface MyDayResponseDto {
  scope: "mine" | "team";
  summary: MyDaySummaryDto;
  overdue: MyDayBucketDto;
  today: MyDayBucketDto;
  thisWeek: MyDayBucketDto;
}
