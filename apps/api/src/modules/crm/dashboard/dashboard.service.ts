import {
  AccessLevel,
  AppModule,
  canAccess,
  PROJECT_PORTFOLIO_STATUS_OF,
  ProjectRiskKind,
  type DashboardBillingMonthDto,
  type DashboardCriticalAlertDto,
  type DashboardDto,
  type DashboardProjectHealthRowDto,
  type ProjectRiskReasonDto,
  type WorkPackageDelayReason,
  type Role,
} from "@methanova/shared-types";
import { getMonthlyInvoicedTotals, getReceivablesSummary } from "../../billing/invoices/invoices.service.js";
import { getComplianceHealth, getLicenceExpiryWindowDays } from "../../compliance/licences/licences.service.js";
import { getPortfolioCounts, listOpenProjects } from "../../projects/project/project.service.js";
import { getMonthlyReceiptTotals } from "../../receivables/receipts/receipts.service.js";
import {
  getCurrentWorkPackages,
  getDelayedWorkPackagesSummary,
  getProgressByProject,
} from "../../schedule/work-packages/work-packages.service.js";
import { listActivities } from "../activities/activities.service.js";
import { getPipelineByStage } from "../leads/leads.service.js";
import { getMouSummaryByStatus, getSignedMousSince } from "../mou/mou.service.js";
import { getOpenQuotationsSummary } from "../quotations/quotations.service.js";

/** "The last 10-15 across all leads" from the brief — a compact card, not the full Activity Log experience. */
const RECENT_ACTIVITY_LIMIT = 12;

/** Trailing window for the Billing card — long enough to show a shape, short enough that one busy month doesn't flatten the rest. */
const BILLING_TRAILING_MONTHS = 6;

/** Row caps — each section links to its full, filtered list for the rest. */
const DELAYED_WORK_PACKAGE_LIMIT = 10;
const TOP_OUTSTANDING_LIMIT = 10;
const PROJECT_HEALTH_LIMIT = 50;
const CRITICAL_ALERT_LIMIT = 6;

/** "YYYY-MM" in UTC, matching both aggregations' own `$dateToString` grouping. */
function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** The trailing N months oldest-first, each a real UTC month boundary, and the earliest one's start (the aggregations' own `$gte`). */
function trailingMonths(count: number): { keys: string[]; since: Date } {
  const now = new Date();
  const keys: string[] = [];
  for (let offset = count - 1; offset >= 0; offset--) {
    keys.push(monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1))));
  }
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (count - 1), 1));
  return { keys, since };
}

/** IST is UTC+5:30 with no DST — the Indian financial year runs 1 April to 31 March in that zone, whatever the server's own TZ. */
const IST_OFFSET_MS = 330 * 60 * 1000;

/** The current Indian financial year: its start (1 April 00:00 IST, as a UTC instant) and a label like "FY 2026–27". */
function currentFinancialYear(now: Date): { start: Date; label: string } {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const startYear = ist.getUTCMonth() >= 3 ? ist.getUTCFullYear() : ist.getUTCFullYear() - 1;
  return {
    start: new Date(Date.UTC(startYear, 3, 1) - IST_OFFSET_MS),
    label: `FY ${startYear}–${String((startYear + 1) % 100).padStart(2, "0")}`,
  };
}

function access(role: Role) {
  const read = (module: AppModule) => canAccess(role, module, AccessLevel.READ);
  return {
    crm: read(AppModule.crm),
    projects: read(AppModule.projects),
    schedule: read(AppModule.schedule),
    compliance: read(AppModule.compliance),
    billing: read(AppModule.billing),
    receivables: read(AppModule.receivables),
  };
}

type Access = ReturnType<typeof access>;

/**
 * The three live-risk roll-ups over open projects, each fetched only when
 * the caller can read its module. This is the single computation behind
 * Project Health's reasons, the at-risk count, Critical Alerts and the
 * `?atRisk=1` project list — so none of them can disagree.
 */
async function loadRisk(can: Access, now: Date) {
  const openProjects = await listOpenProjects();
  const openIds = openProjects.map((project) => project._id);
  const windowDays = can.compliance ? await getLicenceExpiryWindowDays() : 0;
  const [delayed, compliance, receivables] = await Promise.all([
    can.schedule ? getDelayedWorkPackagesSummary(openIds, now, DELAYED_WORK_PACKAGE_LIMIT) : null,
    can.compliance ? getComplianceHealth(openIds, now, windowDays, CRITICAL_ALERT_LIMIT) : null,
    can.receivables ? getReceivablesSummary(now, TOP_OUTSTANDING_LIMIT, CRITICAL_ALERT_LIMIT) : null,
  ]);

  const reasons = new Map<string, ProjectRiskReasonDto[]>();
  const add = (projectId: unknown, reason: ProjectRiskReasonDto) => {
    const key = String(projectId);
    reasons.set(key, [...(reasons.get(key) ?? []), reason]);
  };
  for (const row of delayed?.byProject ?? []) {
    add(row._id, {
      kind: ProjectRiskKind.DELAYED_WORK_PACKAGE,
      count: row.count,
      worstId: String(row.worstId),
      worstLabel: row.worstLabel,
      worstDays: row.worstDays,
    });
  }
  for (const row of compliance?.overdueByProject ?? []) {
    add(row._id, {
      kind: ProjectRiskKind.OVERDUE_LICENCE,
      count: row.count,
      worstId: String(row.worstId),
      worstLabel: row.worstLabel,
      worstDays: row.worstDays,
    });
  }
  const openIdSet = new Set(openIds.map(String));
  for (const row of receivables?.overdueByProject ?? []) {
    // Receivables span every project, closed ones included (money is still
    // owed after handover), but project risk is about open projects.
    if (!openIdSet.has(String(row._id))) continue;
    add(row._id, {
      kind: ProjectRiskKind.OVERDUE_INVOICE,
      count: row.count,
      worstId: String(row.worstId),
      worstLabel: row.worstLabel,
      worstDays: row.worstDays,
      outstandingPaise: row.outstandingPaise,
    });
  }

  const evaluatedKinds = [
    ...(can.schedule ? [ProjectRiskKind.DELAYED_WORK_PACKAGE] : []),
    ...(can.compliance ? [ProjectRiskKind.OVERDUE_LICENCE] : []),
    ...(can.receivables ? [ProjectRiskKind.OVERDUE_INVOICE] : []),
  ];
  return { openProjects, delayed, compliance, receivables, reasons, evaluatedKinds };
}

/** The ids behind the dashboard's at-risk count, for the `?atRisk=1` project list — the same computation, the same caller permissions. */
export async function getAtRiskProjectIds(actorRole: Role): Promise<string[]> {
  const risk = await loadRisk(access(actorRole), new Date());
  return [...risk.reasons.keys()];
}

/** Most days late first; ties go to the larger amount owed. */
function criticalAlerts(risk: Awaited<ReturnType<typeof loadRisk>>): DashboardCriticalAlertDto[] {
  const alerts: DashboardCriticalAlertDto[] = [
    ...(risk.delayed?.rows ?? []).map((row) => ({
      kind: ProjectRiskKind.DELAYED_WORK_PACKAGE,
      id: String(row._id),
      projectId: String(row.projectId),
      projectCode: row.projectCode ?? "—",
      client: row.client ?? "—",
      label: row.name,
      days: row.daysDelayed,
    })),
    ...(risk.compliance?.overdueTop ?? []).map((row) => ({
      kind: ProjectRiskKind.OVERDUE_LICENCE,
      id: String(row._id),
      projectId: String(row.projectId),
      projectCode: row.projectCode ?? "—",
      client: row.client ?? "—",
      label: row.label,
      days: row.daysOverdue,
    })),
    ...(risk.receivables?.overdueTop ?? []).map((row) => ({
      kind: ProjectRiskKind.OVERDUE_INVOICE,
      id: String(row._id),
      projectId: row.projectId ? String(row.projectId) : "",
      projectCode: row.projectCode ?? "—",
      client: row.client ?? "—",
      label: row.number,
      days: row.daysPastDue,
      outstandingPaise: row.outstandingPaise,
    })),
  ];
  return alerts
    .sort((a, b) => b.days - a.days || (b.outstandingPaise ?? 0) - (a.outstandingPaise ?? 0))
    .slice(0, CRITICAL_ALERT_LIMIT);
}

/**
 * The Dashboard's one aggregation call: a single round trip that fans out
 * server-side to the aggregation pipelines each domain module owns.
 *
 * The route requires only authentication; every section is gated here, on
 * the role from the verified token, by its own module's `:READ` — CRM
 * sections by `crm`, Project Health by `projects`, delayed work packages by
 * `schedule`, Compliance by `compliance`, the billing chart by `billing`,
 * receivables by `receivables`. A section the caller can't read is never
 * computed and comes back `null`/`[]`, never faked. That per-section gate is
 * what lets a Liaison Officer (compliance, no crm) see Compliance Health
 * without also being able to fetch lead data through this endpoint.
 */
export async function getDashboard(actorRole: Role): Promise<DashboardDto> {
  const can = access(actorRole);
  const now = new Date();
  const { keys: months, since } = trailingMonths(BILLING_TRAILING_MONTHS);

  const fy = currentFinancialYear(now);

  const [pipeline, mou, signed, quotations, activityPage, invoicedByMonth, collectedByMonth, risk, portfolio] =
    await Promise.all([
      can.crm ? getPipelineByStage() : Promise.resolve([]),
      can.crm ? getMouSummaryByStatus() : Promise.resolve([]),
      can.crm ? getSignedMousSince(fy.start) : Promise.resolve(null),
      can.crm ? getOpenQuotationsSummary() : Promise.resolve(null),
      can.crm
        ? listActivities({ page: 1, pageSize: RECENT_ACTIVITY_LIMIT, hasFollowUp: false, overdueFollowUp: false })
        : Promise.resolve({ items: [] }),
      can.billing ? getMonthlyInvoicedTotals(since) : Promise.resolve(new Map<string, number>()),
      can.billing ? getMonthlyReceiptTotals(since) : Promise.resolve(new Map<string, number>()),
      loadRisk(can, now),
      can.projects ? getPortfolioCounts() : Promise.resolve(null),
    ]);

  const billing: DashboardBillingMonthDto[] = can.billing
    ? months.map((month) => ({
        month,
        invoicedPaise: invoicedByMonth.get(month) ?? 0,
        collectedPaise: collectedByMonth.get(month) ?? 0,
      }))
    : [];

  let projectHealth: DashboardDto["projectHealth"] = null;
  if (can.projects && portfolio) {
    const openIds = risk.openProjects.map((project) => project._id);
    const [progress, currentWorkPackages] = await Promise.all([
      getProgressByProject(openIds),
      getCurrentWorkPackages(openIds),
    ]);
    const rows: DashboardProjectHealthRowDto[] = risk.openProjects.map((project) => {
      const current = currentWorkPackages.get(String(project._id));
      return {
      id: String(project._id),
      code: project.code,
      client: project.name,
      projectManagerName: project.projectManagerName,
      lifecycleStatus: project.status,
      portfolioStatus: PROJECT_PORTFOLIO_STATUS_OF[project.status],
      progressPct: progress.get(String(project._id)) ?? null,
      currentWorkPackage: current
        ? {
            id: current.id,
            name: current.name,
            status: current.status,
            plannedStart: current.plannedStart ? new Date(current.plannedStart).toISOString() : null,
            plannedEnd: current.plannedEnd ? new Date(current.plannedEnd).toISOString() : null,
            percentComplete: current.percentComplete,
          }
        : null,
      targetCommissioningDate: project.targetCommissioningDate ? project.targetCommissioningDate.toISOString() : null,
      revisedTargetDate: project.revisedTargetDate ? project.revisedTargetDate.toISOString() : null,
      reasons: risk.reasons.get(String(project._id)) ?? [],
      };
    });
    const atRiskCount = rows.filter((row) => row.reasons.length > 0).length;
    projectHealth = {
      portfolio: { ...portfolio, atRiskCount, onTrackCount: portfolio.openCount - atRiskCount },
      rows: rows
        .sort((a, b) => b.reasons.length - a.reasons.length || a.code.localeCompare(b.code))
        .slice(0, PROJECT_HEALTH_LIMIT),
      evaluatedKinds: risk.evaluatedKinds,
    };
  }

  return {
    pipeline,
    mou,
    signedMous: signed
      ? { periodLabel: fy.label, periodStart: fy.start.toISOString(), count: signed.count, contractValuePaise: signed.contractValuePaise }
      : null,
    quotations,
    recentActivity: activityPage.items,
    billing,
    compliance: risk.compliance?.summary ?? null,
    projectHealth,
    delayedWorkPackages: risk.delayed
      ? {
          totalCount: risk.delayed.totalCount,
          rows: risk.delayed.rows.map((row) => ({
            id: String(row._id),
            projectId: String(row.projectId),
            projectCode: row.projectCode ?? "—",
            client: row.client ?? "—",
            name: row.name,
            plannedEnd: new Date(row.plannedEnd).toISOString(),
            percentComplete: row.percentComplete ?? 0,
            daysDelayed: row.daysDelayed,
            responsibleUserName: row.responsibleUserName ?? null,
            delayReason: (row.delayReason as WorkPackageDelayReason | null) ?? null,
          })),
        }
      : null,
    receivables: risk.receivables?.summary ?? null,
    criticalAlerts: criticalAlerts(risk),
  };
}
