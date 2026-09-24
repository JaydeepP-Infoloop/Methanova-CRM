import {
  AccessLevel,
  AppModule,
  canAccess,
  type DashboardBillingMonthDto,
  type DashboardComplianceDto,
  type DashboardDto,
  type Role,
} from "@methanova/shared-types";
import { getMonthlyInvoicedTotals } from "../../billing/invoices/invoices.service.js";
import { getComplianceSummary } from "../../compliance/licences/licences.service.js";
import { getActiveProjectsSummary } from "../../projects/project/project.service.js";
import { getMonthlyReceiptTotals } from "../../receivables/receipts/receipts.service.js";
import { listActivities } from "../activities/activities.service.js";
import { getPipelineByStage } from "../leads/leads.service.js";
import { getMouSummaryByStatus } from "../mou/mou.service.js";
import { getOpenQuotationsSummary } from "../quotations/quotations.service.js";

const EMPTY_COMPLIANCE: DashboardComplianceDto = { grantedCount: 0, totalCount: 0, byBundle: [] };

/** "The last 10-15 across all leads" from the brief — a compact card, not the full Activity Log experience. */
const RECENT_ACTIVITY_LIMIT = 12;

/** Trailing window for the Billing card — long enough to show a shape, short enough that one busy month doesn't flatten the rest. */
const BILLING_TRAILING_MONTHS = 6;

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

/**
 * The Dashboard's one aggregation call — consolidated into a single round
 * trip from the client rather than one request per panel, fanning out
 * server-side to the real aggregations each domain module already owns
 * (leads, MOU, quotations, invoices, receipts, licences, projects/work
 * packages) plus the same flat cross-lead activity query the Activity Log
 * page uses.
 *
 * The route itself only requires `crm:READ` (see `dashboard.routes.ts`), but
 * Billing, Compliance and Projects are their own permission-matrix modules —
 * a Sales Head/BDE holds `crm:FULL` and `billing:NONE`/`compliance:NONE`.
 * Those sections are therefore fetched (and returned) only when the
 * caller's own role actually holds the matching `:READ`, computed here from
 * the role on the verified token, never a client-supplied flag — the same
 * server-side re-derivation My Day's team/mine toggle already does.
 */
export async function getDashboard(actorRole: Role): Promise<DashboardDto> {
  const canReadBilling = canAccess(actorRole, AppModule.billing, AccessLevel.READ);
  const canReadCompliance = canAccess(actorRole, AppModule.compliance, AccessLevel.READ);
  const canReadProjects = canAccess(actorRole, AppModule.projects, AccessLevel.READ);
  const { keys: months, since } = trailingMonths(BILLING_TRAILING_MONTHS);

  const [pipeline, mou, quotations, activityPage, invoicedByMonth, collectedByMonth, compliance, activeProjects] =
    await Promise.all([
      getPipelineByStage(),
      getMouSummaryByStatus(),
      getOpenQuotationsSummary(),
      listActivities({ page: 1, pageSize: RECENT_ACTIVITY_LIMIT, hasFollowUp: false, overdueFollowUp: false }),
      canReadBilling ? getMonthlyInvoicedTotals(since) : Promise.resolve(new Map<string, number>()),
      canReadBilling ? getMonthlyReceiptTotals(since) : Promise.resolve(new Map<string, number>()),
      canReadCompliance ? getComplianceSummary() : Promise.resolve(EMPTY_COMPLIANCE),
      canReadProjects ? getActiveProjectsSummary() : Promise.resolve([]),
    ]);

  const billing: DashboardBillingMonthDto[] = canReadBilling
    ? months.map((month) => ({
        month,
        invoicedPaise: invoicedByMonth.get(month) ?? 0,
        collectedPaise: collectedByMonth.get(month) ?? 0,
      }))
    : [];

  return { pipeline, mou, quotations, recentActivity: activityPage.items, billing, compliance, activeProjects };
}
