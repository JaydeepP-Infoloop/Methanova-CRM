import type { ActivityListItemDto } from "./activities.js";
import type { LeadStage, LicenceBundle, MouStatus } from "./lifecycles.js";
import type { Paise } from "./money.js";

/** One row per `LEAD_STAGE_ORDER` entry, always present even at count 0 — a real zero from a real query, not an omitted row. */
export interface DashboardPipelineStageDto {
  stage: LeadStage;
  count: number;
  indicativeValueTotalPaise: Paise;
}

/** One row per `MOU_STATUS_ORDER` entry. `contractValuePaise`/`feePaise` are summed as recorded on each MOU regardless of status — the SIGNED row is where "total signed contract value" actually lives. */
export interface DashboardMouStatusDto {
  status: MouStatus;
  count: number;
  contractValuePaise: Paise;
  feePaise: Paise;
}

/** "Open" = every non-terminal QuotationStatus (excludes ACCEPTED/REJECTED/SUPERSEDED) — derived from the real status enum, not an invented proxy. */
export interface DashboardQuotationsSummaryDto {
  openCount: number;
  openValueTotalPaise: Paise;
}

/** One row per trailing month (oldest first), always present even at ₹0 — a real zero from a real query, not an omitted month. */
export interface DashboardBillingMonthDto {
  /** "YYYY-MM", UTC — matches the aggregation's own `$dateToString` grouping. */
  month: string;
  invoicedPaise: Paise;
  collectedPaise: Paise;
}

/** One row per `LicenceBundle` (Pre-CTE/CTE/CTO), always present even at 0 licences. */
export interface DashboardComplianceBundleDto {
  bundle: LicenceBundle;
  grantedCount: number;
  totalCount: number;
}

export interface DashboardComplianceDto {
  grantedCount: number;
  totalCount: number;
  byBundle: DashboardComplianceBundleDto[];
}

export interface DashboardDto {
  pipeline: DashboardPipelineStageDto[];
  mou: DashboardMouStatusDto[];
  quotations: DashboardQuotationsSummaryDto;
  /** Newest first, capped server-side — the same flat cross-lead query the Activity Log page uses, not a second implementation. */
  recentActivity: ActivityListItemDto[];
  billing: DashboardBillingMonthDto[];
  compliance: DashboardComplianceDto;
}
