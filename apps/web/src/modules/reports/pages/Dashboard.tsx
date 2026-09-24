import {
  AccessLevel,
  AppModule,
  canAccess,
  MouStatus,
  type ActivityListItemDto,
  type DashboardPipelineStageDto,
} from "@methanova/shared-types";
import { AlertTriangle, MailQuestion, PauseCircle, UserX, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../../app/providers";
import { ActivityRail, type ActivityRailItem } from "../../../components/ActivityRail";
import { BarChart } from "../../../components/BarChart";
import { Card } from "../../../components/Card";
import { DonutMeter } from "../../../components/DonutMeter";
import { PageHeader } from "../../../components/PagePrimitives";
import { ResourceTable, type ResourceColumn } from "../../../components/ResourceTable";
import { Skeleton } from "../../../components/Skeleton";
import { StatCard } from "../../../components/StatCard";
import { StatusPill } from "../../../components/StatusPill";
import { formatDate, formatPaise, formatPaiseAsCrore } from "../../../lib/formatters";
import { useLeadSummary } from "../../crm/api/leads.api";
import { useMyDay } from "../../crm/api/my-day.api";
import { useDashboard } from "../api/dashboard.api";

/**
 * Every panel on this page now reads a real endpoint — leads summary, My
 * Day, and the single `GET /api/crm/dashboard` aggregation the rest reuse.
 * Billing, Compliance and Active Projects are each gated on their own
 * module permission (`billing:READ`/`compliance:READ`/`projects:READ`), not
 * `crm:READ` — a Sales Head/BDE holds the latter without any of the former.
 * Invented numbers are still never the fallback: every panel without
 * permission simply does not render, and every real query that returns
 * nothing says so in a plain sentence rather than drawing a fake shape.
 */
const DASHBOARD_SUMMARY_FILTERS = { page: 1, pageSize: 1 };

/** Below this many leads a bar chart is decoration, not information — see DESIGN_SYSTEM.md. */
const PIPELINE_CHART_MIN_LEADS = 5;

interface ActiveProjectRow extends Record<string, unknown> {
  _id: string;
  code: string;
  client: string;
  workPackage: string | null;
  plannedEnd: string | null;
  valuePaise: number;
  status: string;
}

const activeProjectColumns: ResourceColumn<ActiveProjectRow>[] = [
  { key: "code", label: "Project", sortable: true },
  { key: "client", label: "Client", sortable: true },
  {
    key: "workPackage",
    label: "Current work package",
    render: (row) => row.workPackage ?? "—",
  },
  {
    key: "plannedEnd",
    label: "Planned end",
    sortable: true,
    render: (row) => (row.plannedEnd ? formatDate(row.plannedEnd) : "—"),
  },
  {
    key: "valuePaise",
    label: "Value",
    align: "right",
    sortable: true,
    render: (row) => formatPaise(row.valuePaise),
  },
  {
    key: "status",
    label: "Status",
    sortable: true,
    render: (row) => <StatusPill value={row.status} />,
  },
];

interface PipelineRow extends Record<string, unknown> {
  _id: string;
  stage: string;
  count: number;
  indicativeValueTotalPaise: number;
}

const pipelineColumns: ResourceColumn<PipelineRow>[] = [
  { key: "stage", label: "Stage", render: (row) => row.stage.replace(/_/g, " ") },
  { key: "count", label: "Leads", align: "right" },
  {
    key: "indicativeValueTotalPaise",
    label: "Value",
    align: "right",
    render: (row) => formatPaise(row.indicativeValueTotalPaise),
  },
];

/** `ActivityListItemDto` and `ActivityRailItem` line up field-for-field except `parentId` → `leadId`. */
function toActivityRailItems(rows: ActivityListItemDto[]): ActivityRailItem[] {
  return rows.map((row) => ({ ...row, leadId: row.parentId }));
}

/** "2026-01" (the aggregation's own UTC grouping key) → "Jan 2026". */
function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function Dashboard() {
  const { user } = useAuth();
  const canReadCrm = Boolean(user && canAccess(user.role, AppModule.crm, AccessLevel.READ));
  const canSeeTeamQueue = Boolean(user && canAccess(user.role, AppModule.crm, AccessLevel.FULL));
  const canReadBilling = Boolean(user && canAccess(user.role, AppModule.billing, AccessLevel.READ));
  const canReadCompliance = Boolean(user && canAccess(user.role, AppModule.compliance, AccessLevel.READ));
  const canReadProjects = Boolean(user && canAccess(user.role, AppModule.projects, AccessLevel.READ));

  const summary = useLeadSummary(DASHBOARD_SUMMARY_FILTERS, { enabled: canReadCrm });
  const myDay = useMyDay(canSeeTeamQueue ? "team" : "mine", { enabled: canReadCrm });
  const dashboard = useDashboard({ enabled: canReadCrm });

  const stat = (value: number | undefined) => (value === undefined ? "—" : String(value));

  const pipeline: DashboardPipelineStageDto[] = dashboard.data?.pipeline ?? [];
  const pipelineTotalLeads = pipeline.reduce((sum, row) => sum + row.count, 0);
  const pipelineRows: PipelineRow[] = pipeline.map((row) => ({ ...row, _id: row.stage }));

  const mou = dashboard.data?.mou ?? [];
  const signedMou = mou.find((row) => row.status === MouStatus.SIGNED);
  const inProgressMouCount = mou
    .filter((row) => row.status === MouStatus.DRAFT || row.status === MouStatus.SENT)
    .reduce((sum, row) => sum + row.count, 0);
  const quotations = dashboard.data?.quotations;

  const recentActivity = toActivityRailItems(dashboard.data?.recentActivity ?? []);

  const billing = dashboard.data?.billing ?? [];
  const billingHasAnyData = billing.some((row) => row.invoicedPaise > 0 || row.collectedPaise > 0);

  const compliance = dashboard.data?.compliance;
  const complianceBundles = compliance?.byBundle ?? [];

  const activeProjectRows: ActiveProjectRow[] = (dashboard.data?.activeProjects ?? []).map((row) => ({
    _id: row.id,
    code: row.code,
    client: row.client,
    workPackage: row.workPackageName,
    plannedEnd: row.plannedEnd,
    valuePaise: row.valuePaise,
    status: row.status,
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Dashboard"
        subtitle="Sales, billing, compliance and project figures come from the live data behind each module."
      />

      {canReadCrm && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5" aria-busy={summary.isLoading || myDay.isLoading}>
          <StatCard
            icon={Users}
            label={
              summary.data
                ? `Open leads · ${formatPaiseAsCrore(summary.data.openIndicativeValueTotalPaise)}`
                : "Open leads"
            }
            value={stat(summary.data?.open)}
            isLoading={summary.isLoading}
            to="/app/crm/leads"
          />
          <StatCard
            icon={UserX}
            label="Unassigned"
            value={stat(summary.data?.unassigned)}
            isLoading={summary.isLoading}
            to="/app/crm/leads"
          />
          <StatCard
            icon={MailQuestion}
            label="Awaiting first response"
            value={stat(summary.data?.noFirstResponse)}
            isLoading={summary.isLoading}
            to="/app/crm/leads"
          />
          <StatCard
            icon={AlertTriangle}
            label="Overdue commitments"
            value={stat(myDay.data?.overdue.count)}
            isLoading={myDay.isLoading}
            to="/app/my-day"
          />
          <StatCard
            icon={PauseCircle}
            label="Parked due for revisit"
            value={stat(summary.data?.parkedDueForRevisit)}
            isLoading={summary.isLoading}
            to="/app/crm/leads"
          />
        </div>
      )}

      {canReadCrm && (
        <Card
          title="Sales Pipeline"
          action={
            <Link to="/app/crm/leads" className="text-xs font-medium text-methanova-green hover:underline">
              View leads
            </Link>
          }
        >
          {dashboard.isLoading ? (
            <Skeleton className="h-56 w-full" />
          ) : (
            <>
              {pipelineTotalLeads === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">No leads recorded yet.</p>
              ) : pipelineTotalLeads < PIPELINE_CHART_MIN_LEADS ? (
                <p className="text-sm text-slate-500">
                  Only {pipelineTotalLeads} lead{pipelineTotalLeads === 1 ? "" : "s"} recorded so far — the chart
                  fills in once there are enough to show a meaningful shape.
                </p>
              ) : (
                <BarChart
                  categories={pipeline.map((row) => row.stage.replace(/_/g, " "))}
                  series={[
                    { label: "Leads", colorClass: "fill-methanova-green", values: pipeline.map((row) => row.count) },
                  ]}
                />
              )}

              {pipelineTotalLeads > 0 && (
                <div className="mt-4">
                  <ResourceTable rows={pipelineRows} columns={pipelineColumns} />
                </div>
              )}

              <div className="mt-5 grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-3">
                <Link
                  to="/app/crm/mou"
                  className="rounded-lg p-2 transition-colors duration-150 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold motion-reduce:transition-none"
                >
                  <p className="text-xs text-slate-500">Signed MOUs</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
                    {signedMou?.count ?? 0}
                    <span className="ml-1.5 text-sm font-normal text-slate-500">
                      · {formatPaiseAsCrore(signedMou?.contractValuePaise ?? 0)}
                    </span>
                  </p>
                </Link>
                <Link
                  to="/app/crm/mou"
                  className="rounded-lg p-2 transition-colors duration-150 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold motion-reduce:transition-none"
                >
                  <p className="text-xs text-slate-500">MOUs in progress</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{inProgressMouCount}</p>
                </Link>
                <Link
                  to="/app/crm/quotations"
                  className="rounded-lg p-2 transition-colors duration-150 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold motion-reduce:transition-none"
                >
                  <p className="text-xs text-slate-500">Open quotations</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
                    {quotations?.openCount ?? 0}
                    <span className="ml-1.5 text-sm font-normal text-slate-500">
                      · {formatPaiseAsCrore(quotations?.openValueTotalPaise ?? 0)}
                    </span>
                  </p>
                </Link>
              </div>
            </>
          )}
        </Card>
      )}

      {canReadCrm && (
        <Card
          title="Recent Activity"
          bodyPadding={false}
          action={
            <Link to="/app/crm/activities" className="text-xs font-medium text-methanova-green hover:underline">
              View all
            </Link>
          }
        >
          <ActivityRail
            items={recentActivity}
            showLead
            isLoading={dashboard.isLoading}
            emptyState={
              <div className="px-5 py-10 text-center">
                <p className="text-sm font-medium text-slate-900">No activity logged yet</p>
                <p className="mt-1 text-sm text-slate-500">Calls, visits and emails across every lead show up here.</p>
              </div>
            }
          />
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {canReadBilling && (
          <Card title="Billing & collections" className="lg:col-span-2">
            {dashboard.isLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : billingHasAnyData ? (
              <BarChart
                categories={billing.map((row) => monthLabel(row.month))}
                series={[
                  {
                    label: "Invoiced",
                    colorClass: "fill-methanova-green",
                    values: billing.map((row) => row.invoicedPaise),
                  },
                  {
                    label: "Collected",
                    colorClass: "fill-methanova-gold",
                    values: billing.map((row) => row.collectedPaise),
                  },
                ]}
                formatValue={formatPaise}
              />
            ) : (
              <p className="py-6 text-center text-sm text-slate-500">
                Invoiced vs collected by month appears once invoices exist.
              </p>
            )}
          </Card>
        )}

        {canReadCompliance && (
          <Card title="Compliance health">
            {dashboard.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <>
                <DonutMeter
                  value={compliance?.grantedCount ?? 0}
                  total={compliance?.totalCount ?? 0}
                  caption="Licences granted across active projects"
                />
                <ul className="mt-4 space-y-2">
                  {complianceBundles.map((row) => (
                    <li key={row.bundle} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">{row.bundle.replace(/_/g, " ")}</span>
                      <span className="tabular-nums text-slate-500">
                        {row.totalCount === 0 ? "—" : `${row.grantedCount} of ${row.totalCount}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>
        )}
      </div>

      {canReadProjects && (
        <Card title="Active projects" bodyPadding={false}>
          <ResourceTable
            rows={activeProjectRows}
            columns={activeProjectColumns}
            isLoading={dashboard.isLoading}
            emptyHint="Projects appear here once an MOU is signed."
          />
        </Card>
      )}
    </div>
  );
}
