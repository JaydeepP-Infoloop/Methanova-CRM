import type { ActivityListItemDto } from "./activities.js";
import type { AgeingBucket } from "./derived.js";
import type {
  LeadStage,
  LicenceBundle,
  LicenceStatus,
  MouStatus,
  ProjectPortfolioStatus,
  ProjectStatus,
  WorkPackageDelayReason,
} from "./lifecycles.js";
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

/** One row per open project that has at least one licence. */
export interface DashboardComplianceProjectDto {
  projectId: string;
  code: string;
  client: string;
  totalCount: number;
  grantedCount: number;
  inProgressCount: number;
  notStartedCount: number;
  overdueCount: number;
  expiringSoonCount: number;
}

/**
 * Scoped to open projects' licences (`OPEN_PROJECT_STATUSES`). `overdueCount`
 * applies `licenceOverdue()`'s rule and `expiringSoonCount`
 * `licenceExpiringSoon()`'s, both as Mongo filters — see licences.service.ts.
 */
export interface DashboardComplianceDto {
  grantedCount: number;
  totalCount: number;
  /** Every `LicenceStatus`, always present even at 0. */
  byStatus: { status: LicenceStatus; count: number }[];
  byBundle: DashboardComplianceBundleDto[];
  overdueCount: number;
  expiringSoonCount: number;
  /** The default window used where a licence has no `renewalLeadDays` of its own. */
  expiringWindowDays: number;
  byProject: DashboardComplianceProjectDto[];
}

export const ProjectRiskKind = {
  DELAYED_WORK_PACKAGE: "DELAYED_WORK_PACKAGE",
  OVERDUE_LICENCE: "OVERDUE_LICENCE",
  OVERDUE_INVOICE: "OVERDUE_INVOICE",
} as const;
export type ProjectRiskKind = (typeof ProjectRiskKind)[keyof typeof ProjectRiskKind];

/**
 * One explainable reason a project is at risk — never a score. Grouped per
 * kind: `count` offending records, plus the single worst one (most days late)
 * named, so the reason reads as a sentence and links to its record.
 */
export interface ProjectRiskReasonDto {
  kind: ProjectRiskKind;
  count: number;
  worstId: string;
  worstLabel: string;
  worstDays: number;
  /** OVERDUE_INVOICE only: total still outstanding across this project's overdue invoices. */
  outstandingPaise?: Paise;
}

/** Counts per SoW portfolio status. `count` is null for TERMINATED — no lifecycle state maps to it yet, so nothing was counted. */
export interface DashboardPortfolioDto {
  byStatus: { status: ProjectPortfolioStatus; count: number | null }[];
  /** Summed `contractValuePaise` over Active-portfolio projects (ACTIVE + COMMISSIONING). */
  activeContractValuePaise: Paise;
  /** Active projects with no recorded contract value — counted, so the total never silently understates. */
  activeWithoutValueCount: number;
  openCount: number;
  atRiskCount: number;
  onTrackCount: number;
}

export interface DashboardProjectHealthRowDto {
  id: string;
  code: string;
  client: string;
  projectManagerName: string | null;
  lifecycleStatus: ProjectStatus;
  portfolioStatus: ProjectPortfolioStatus;
  /** `weightedProgressPct()` — null when the project has no work packages yet. */
  progressPct: number | null;
  /**
   * Earliest-`plannedStart` package not yet COMPLETED/HANDED_OVER and under
   * 100%. Null either because there is no schedule yet (`progressPct` is then
   * null too) or because every package is done — the UI tells the two apart.
   */
  currentWorkPackage: {
    id: string;
    name: string;
    status: string;
    plannedStart: string | null;
    plannedEnd: string | null;
    percentComplete: number;
  } | null;
  targetCommissioningDate: string | null;
  revisedTargetDate: string | null;
  reasons: ProjectRiskReasonDto[];
}

export interface DashboardProjectHealthDto {
  portfolio: DashboardPortfolioDto;
  /** Open projects, at-risk first, capped server-side. */
  rows: DashboardProjectHealthRowDto[];
  /**
   * Which reason kinds were evaluated for this caller. A kind is evaluated
   * only when the caller can read its module (schedule / compliance /
   * receivables), so a role without, say, receivables access sees risk on the
   * reasons it is allowed to see — and the UI says so.
   */
  evaluatedKinds: ProjectRiskKind[];
}

export interface DashboardDelayedWorkPackageDto {
  id: string;
  projectId: string;
  projectCode: string;
  client: string;
  name: string;
  plannedEnd: string;
  percentComplete: number;
  daysDelayed: number;
  responsibleUserName: string | null;
  delayReason: WorkPackageDelayReason | null;
}

export interface DashboardDelayedWorkPackagesDto {
  totalCount: number;
  /** Most days late first, capped server-side; `totalCount` is the uncapped figure. */
  rows: DashboardDelayedWorkPackageDto[];
}

export interface DashboardReceivableBucketDto {
  bucket: AgeingBucket;
  count: number;
  outstandingPaise: Paise;
}

export interface DashboardOutstandingInvoiceDto {
  invoiceId: string;
  number: string;
  clientName: string | null;
  projectId: string | null;
  projectCode: string | null;
  invoiceDate: string;
  dueDate: string | null;
  outstandingPaise: Paise;
  ageingBucket: AgeingBucket | null;
}

/**
 * Open receivables only. Outstanding = the collectible part of each invoice
 * (total less retention) less its live receipts, where still above zero.
 * Retention is never in `totalOutstandingPaise`, the buckets or overdue — it
 * is reported apart in `retentionHeld`, per the SoW.
 */
export interface DashboardReceivablesDto {
  /** Retention still withheld across open receivables (reduced only by receipts beyond the collectible part). */
  retentionHeld: { count: number; paise: Paise };
  /** Every `AgeingBucket`, always present even at 0. */
  buckets: DashboardReceivableBucketDto[];
  /** Outstanding but with no `dueDate` — can't be aged, so counted apart rather than called CURRENT. */
  noDueDate: { count: number; outstandingPaise: Paise };
  openCount: number;
  totalOutstandingPaise: Paise;
  /** Largest outstanding first, capped server-side. */
  top: DashboardOutstandingInvoiceDto[];
}

/** One of the most severe live items across the three risk kinds — the same records the project reasons are built from. */
export interface DashboardCriticalAlertDto {
  kind: ProjectRiskKind;
  id: string;
  projectId: string;
  projectCode: string;
  client: string;
  label: string;
  days: number;
  outstandingPaise?: Paise;
}

/** SIGNED MOUs by `signedAt` since the start of the current Indian financial year (1 April, IST). */
export interface DashboardSignedMousDto {
  /** e.g. "FY 2026–27". */
  periodLabel: string;
  /** ISO instant of 1 April 00:00 IST — also the `?signedFrom=` the KPI links with. */
  periodStart: string;
  count: number;
  contractValuePaise: Paise;
}

/**
 * Every section is computed server-side only for a caller whose role can
 * read its module; otherwise it comes back `null` (or `[]`), never faked.
 */
export interface DashboardDto {
  pipeline: DashboardPipelineStageDto[];
  mou: DashboardMouStatusDto[];
  signedMous: DashboardSignedMousDto | null;
  quotations: DashboardQuotationsSummaryDto | null;
  /** Newest first, capped server-side — the same flat cross-lead query the Activity Log page uses, not a second implementation. */
  recentActivity: ActivityListItemDto[];
  billing: DashboardBillingMonthDto[];
  compliance: DashboardComplianceDto | null;
  projectHealth: DashboardProjectHealthDto | null;
  delayedWorkPackages: DashboardDelayedWorkPackagesDto | null;
  receivables: DashboardReceivablesDto | null;
  criticalAlerts: DashboardCriticalAlertDto[];
}
