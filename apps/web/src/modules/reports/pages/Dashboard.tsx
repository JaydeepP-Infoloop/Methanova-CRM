import {
  AccessLevel,
  AppModule,
  canAccess,
} from "@methanova/shared-types";
import { AlertTriangle, MailQuestion, PauseCircle, UserX, Users } from "lucide-react";
import { useAuth } from "../../../app/providers";
import { BarChart } from "../../../components/BarChart";
import { Card } from "../../../components/Card";
import { DonutMeter } from "../../../components/DonutMeter";
import { PageHeader } from "../../../components/PagePrimitives";
import { ResourceTable, type ResourceColumn } from "../../../components/ResourceTable";
import { StatCard } from "../../../components/StatCard";
import { formatPaise, formatPaiseAsCrore } from "../../../lib/formatters";
import { useLeadSummary } from "../../crm/api/leads.api";
import { useMyDay } from "../../crm/api/my-day.api";

/**
 * Billing, compliance and projects stay empty until those modules exist.
 * Invented revenue on this page is worse than a blank panel. The CRM strip
 * is the exception: it reads endpoints that already exist (leads summary +
 * My Day overdue), gated so a role without `crm:READ` never sees a fake 0.
 */
const DASHBOARD_SUMMARY_FILTERS = { page: 1, pageSize: 1 };

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

export function Dashboard() {
  const { user } = useAuth();
  const canReadCrm = Boolean(user && canAccess(user.role, AppModule.crm, AccessLevel.READ));
  const canSeeTeamQueue = Boolean(user && canAccess(user.role, AppModule.crm, AccessLevel.FULL));

  const summary = useLeadSummary(DASHBOARD_SUMMARY_FILTERS, { enabled: canReadCrm });
  const myDay = useMyDay(canSeeTeamQueue ? "team" : "mine", { enabled: canReadCrm });

  const stat = (value: number | undefined) => (value === undefined ? "—" : String(value));

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
