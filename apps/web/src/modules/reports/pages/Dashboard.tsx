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
import { formatPaise, formatPaiseAsCrore } from "../../../lib/formatters";
import { useLeadSummary } from "../../crm/api/leads.api";
import { useMyDay } from "../../crm/api/my-day.api";
import { useDashboard } from "../api/dashboard.api";

/**
 * Billing, compliance and projects stay empty until those modules exist.
 * Invented revenue on this page is worse than a blank panel. The CRM strip,
 * Sales Pipeline and Recent Activity are the exception: they read endpoints
 * that already exist (leads summary, My Day overdue, and the dashboard
 * aggregation below), gated so a role without `crm:READ` never sees a fake 0.
 */
const DASHBOARD_SUMMARY_FILTERS = { page: 1, pageSize: 1 };

/** Below this many leads a bar chart is decoration, not information — see DESIGN_SYSTEM.md. */
const PIPELINE_CHART_MIN_LEADS = 5;

interface ActiveProjectRow extends Record<string, unknown> {
  _id: string;
  code: string;
  client: string;
  workPackage: string;
  plannedEnd: string;
  valuePaise: number;
  status: string;
}

const activeProjectColumns: ResourceColumn<ActiveProjectRow>[] = [
  { key: "code", label: "Project", sortable: true },
  { key: "client", label: "Client", sortable: true },
  { key: "workPackage", label: "Current work package" },
  { key: "plannedEnd", label: "Planned end", sortable: true },
  {
    key: "valuePaise",
    label: "Value",
    align: "right",
    sortable: true,
    render: (row) => formatPaise(row.valuePaise),
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

export function Dashboard() {
  const { user } = useAuth();
  const canReadCrm = Boolean(user && canAccess(user.role, AppModule.crm, AccessLevel.READ));
  const canSeeTeamQueue = Boolean(user && canAccess(user.role, AppModule.crm, AccessLevel.FULL));

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

  return (
    <div className="space-y-4">
      <PageHeader
        title="Dashboard"
        subtitle="Sales figures come from the live lead inbox. Billing, compliance and projects appear once those modules exist."
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
        <Card title="Billing & collections" className="lg:col-span-2">
          <BarChart
            categories={[]}
            series={[
              { label: "Invoiced", colorClass: "fill-methanova-green", values: [] },
              { label: "Collected", colorClass: "fill-methanova-gold", values: [] },
            ]}
            formatValue={formatPaise}
            emptyHint="Invoiced vs collected by month appears once invoices exist."
          />
        </Card>

        <Card title="Compliance health">
          <DonutMeter value={0} total={0} caption="Licences granted across active projects" />
          <ul className="mt-4 space-y-2">
            {["Pre-CTE", "CTE", "CTO"].map((bundle) => (
              <li key={bundle} className="flex items-center justify-between text-sm">
                <span className="text-slate-600">{bundle}</span>
                <span className="tabular-nums text-slate-400">—</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="Active projects" bodyPadding={false}>
        <ResourceTable
          rows={[] as ActiveProjectRow[]}
          columns={activeProjectColumns}
          emptyHint="Projects appear here once an MOU is signed."
        />
      </Card>
    </div>
  );
}
