import type { DashboardDto } from "@methanova/shared-types";
import { listActivities } from "../activities/activities.service.js";
import { getPipelineByStage } from "../leads/leads.service.js";
import { getMouSummaryByStatus } from "../mou/mou.service.js";
import { getOpenQuotationsSummary } from "../quotations/quotations.service.js";

/** "The last 10-15 across all leads" from the brief — a compact card, not the full Activity Log experience. */
const RECENT_ACTIVITY_LIMIT = 12;

/**
 * The Dashboard's one aggregation call — consolidated into a single round
 * trip from the client rather than one request per panel, fanning out
 * server-side to the real aggregations each domain module already owns
 * (leads, MOU, quotations) plus the same flat cross-lead activity query the
 * Activity Log page uses. Billing, compliance and active-projects figures
 * are deliberately not part of this: the schemas those panels would need
 * (WorkPackage percentComplete/actualEnd, Invoice dueDate, Licence
 * validUntil, Project PM/target dates) don't exist yet — see MODULE_MAP.md.
 */
export async function getDashboard(): Promise<DashboardDto> {
  const [pipeline, mou, quotations, activityPage] = await Promise.all([
    getPipelineByStage(),
    getMouSummaryByStatus(),
    getOpenQuotationsSummary(),
    listActivities({ page: 1, pageSize: RECENT_ACTIVITY_LIMIT, hasFollowUp: false, overdueFollowUp: false }),
  ]);

  return { pipeline, mou, quotations, recentActivity: activityPage.items };
}
