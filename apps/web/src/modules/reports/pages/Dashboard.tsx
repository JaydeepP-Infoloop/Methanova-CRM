import {
  AccessLevel,
  AppModule,
  AgeingBucket,
  canAccess,
  LeadStage,
  LicenceStatus,
  MouStatus,
  ProjectPortfolioStatus,
  ProjectRiskKind,
  Role,
  WORK_PACKAGE_DELAY_REASON_LABELS,
  type ActivityListItemDto,
  type DashboardComplianceProjectDto,
  type DashboardCriticalAlertDto,
  type DashboardDelayedWorkPackageDto,
  type DashboardOutstandingInvoiceDto,
  type DashboardPipelineStageDto,
  type DashboardProjectHealthRowDto,
  type ProjectRiskReasonDto,
} from "@methanova/shared-types";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  CalendarClock,
  CircleDollarSign,
  FolderKanban,
  Hourglass,
  MailQuestion,
  PauseCircle,
  ShieldAlert,
  UserX,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../../app/providers";
import { ActivityRail, type ActivityRailItem } from "../../../components/ActivityRail";
import { BarChart } from "../../../components/BarChart";
import { Button } from "../../../components/Button";
import { Card } from "../../../components/Card";
import { DonutMeter } from "../../../components/DonutMeter";
import { PageHeader } from "../../../components/PagePrimitives";
import { ResourceTable, type ResourceColumn } from "../../../components/ResourceTable";
import { Skeleton } from "../../../components/Skeleton";
import { StatCard } from "../../../components/StatCard";
import { StatusPill } from "../../../components/StatusPill";
import { formatDate, formatPaise, formatPaiseAsCrore } from "../../../lib/formatters";
import { queryKeys, RESOURCE } from "../../../lib/queryKeys";
import { useLeadSummary } from "../../crm/api/leads.api";
import { useMyDay } from "../../crm/api/my-day.api";
import { AddLeadWizard } from "../../crm/components/AddLeadWizard";
import { CreateMouModal } from "../../crm/components/CreateMouModal";
import { CreateQuotationModal } from "../../crm/components/CreateQuotationModal";
import { LogActivityModal } from "../../crm/components/LogActivityModal";
import { LogProgressModal } from "../../schedule/components/LogProgressModal";
import { useDashboard } from "../api/dashboard.api";

/**
 * Every figure here comes from `GET /api/crm/dashboard` (plus the lead
 * summary and My Day), and every section is gated twice with the same
 * `canAccess` rule: the server computes a section only for a role that can
 * read its module, and this page only renders it for that role. Nothing is a
 * hardcoded literal — an empty panel is a real query that returned nothing.
 * Every count and row links to its source list, pre-filtered through that
 * list's own query string.
 */
const DASHBOARD_SUMMARY_FILTERS = { page: 1, pageSize: 1 };

/** Below this many leads a bar chart is decoration, not information — see DESIGN_SYSTEM.md. */
const PIPELINE_CHART_MIN_LEADS = 5;

/** The billing chart needs this many months with any invoicing or collection before a shape means anything. */
const BILLING_CHART_MIN_MONTHS = 3;

const NOT_AVAILABLE = "Not available";

const LINK_CLASS =
  "rounded-lg p-2 transition-colors duration-150 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold motion-reduce:transition-none";

const PORTFOLIO_LABELS: Record<ProjectPortfolioStatus, string> = {
  ACTIVE: "Active",
  ON_HOLD: "On hold",
  COMPLETED: "Completed",
  TERMINATED: "Terminated",
};

const PORTFOLIO_ICONS = {
  ACTIVE: FolderKanban,
  ON_HOLD: PauseCircle,
  COMPLETED: BadgeCheck,
  TERMINATED: Ban,
} as const;

const BUCKET_LABELS: Record<AgeingBucket, string> = {
  CURRENT: "Not yet due",
  "0-30": "1–30 days",
  "31-60": "31–60 days",
  "61-90": "61–90 days",
  "90+": "90+ days",
};

const RISK_KIND_LABELS: Record<ProjectRiskKind, string> = {
  DELAYED_WORK_PACKAGE: "Delayed work package",
  OVERDUE_LICENCE: "Licence past target",
  OVERDUE_INVOICE: "Invoice overdue",
};

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/** Where each risk kind's records live — one record by id, or one project's offending set. */
function riskHref(kind: ProjectRiskKind, target: { id?: string; projectId?: string }): string {
  const params = new URLSearchParams();
  if (target.id) params.set("id", target.id);
  if (target.projectId) params.set("projectId", target.projectId);
  if (kind === ProjectRiskKind.DELAYED_WORK_PACKAGE) {
    if (!target.id) params.set("delayed", "1");
    return `/app/schedule/work-packages?${params}`;
  }
  if (kind === ProjectRiskKind.OVERDUE_LICENCE) {
    if (!target.id) params.set("overdue", "1");
    return `/app/compliance/licences?${params}`;
  }
  if (!target.id) params.set("overdue", "1");
  return `/app/billing/invoices?${params}`;
}

/** A reason as a sentence: how many, and the single worst one by name. */
function reasonText(reason: ProjectRiskReasonDto): string {
  if (reason.kind === ProjectRiskKind.DELAYED_WORK_PACKAGE) {
    return `${plural(reason.count, "delayed work package")} — worst: ${reason.worstLabel}, ${plural(reason.worstDays, "day")} late`;
  }
  if (reason.kind === ProjectRiskKind.OVERDUE_LICENCE) {
    return `${plural(reason.count, "licence")} past target, not cleared — worst: ${reason.worstLabel}, ${plural(reason.worstDays, "day")} over`;
  }
  return `${plural(reason.count, "invoice")} past due, ${formatPaise(reason.outstandingPaise ?? 0)} outstanding — worst: ${reason.worstLabel}, ${plural(reason.worstDays, "day")}`;
}

function alertText(alert: DashboardCriticalAlertDto): string {
  if (alert.kind === ProjectRiskKind.DELAYED_WORK_PACKAGE) return `${alert.label} — ${plural(alert.days, "day")} past planned end`;
  if (alert.kind === ProjectRiskKind.OVERDUE_LICENCE) return `${alert.label} — ${plural(alert.days, "day")} past target date`;
  return `${alert.label} — ${formatPaise(alert.outstandingPaise ?? 0)} outstanding, ${plural(alert.days, "day")} past due`;
}

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

interface HealthRow extends DashboardProjectHealthRowDto, Record<string, unknown> {
  _id: string;
  /** False when the viewer's role can see none of the three risk kinds (`evaluatedKinds` is empty). */
  assessed: boolean;
}
interface DelayedRow extends DashboardDelayedWorkPackageDto, Record<string, unknown> {
  _id: string;
}
interface ComplianceProjectRow extends DashboardComplianceProjectDto, Record<string, unknown> {
  _id: string;
}
interface OutstandingRow extends DashboardOutstandingInvoiceDto, Record<string, unknown> {
  _id: string;
}

const healthColumns: ResourceColumn<HealthRow>[] = [
  { key: "code", label: "Project", sortable: true },
  { key: "client", label: "Client", sortable: true },
  { key: "projectManagerName", label: "Project Manager", render: (row) => row.projectManagerName ?? NOT_AVAILABLE },
  { key: "lifecycleStatus", label: "Stage", render: (row) => <StatusPill value={row.lifecycleStatus} /> },
  {
    key: "progressPct",
    label: "Progress",
    align: "right",
    sortable: true,
    sortValue: (row) => row.progressPct ?? -1,
    render: (row) => (row.progressPct === null ? NOT_AVAILABLE : `${row.progressPct}%`),
  },
  {
    key: "currentWorkPackage",
    label: "Current work package",
    render: (row) =>
      row.currentWorkPackage ? (
        <div onClick={(event) => event.stopPropagation()}>
          <Link
            to={`/app/schedule/work-packages?id=${row.currentWorkPackage.id}`}
            className="text-sm text-slate-800 hover:underline"
          >
            {row.currentWorkPackage.name}
          </Link>
          <p className="text-xs tabular-nums text-slate-500">
            {row.currentWorkPackage.percentComplete}% ·{" "}
            {row.currentWorkPackage.plannedEnd ? `due ${formatDate(row.currentWorkPackage.plannedEnd)}` : "no planned end"}
          </p>
        </div>
      ) : row.progressPct === null ? (
        "No schedule yet"
      ) : (
        "All complete"
      ),
  },
  {
    key: "targetCommissioningDate",
    label: "Target commissioning",
    sortable: true,
    render: (row) => (row.targetCommissioningDate ? formatDate(row.targetCommissioningDate) : NOT_AVAILABLE),
  },
  {
    key: "revisedTargetDate",
    label: "Revised target",
    render: (row) => (row.revisedTargetDate ? formatDate(row.revisedTargetDate) : "Not revised"),
  },
  { key: "portfolioStatus", label: "Status", render: (row) => <StatusPill value={row.portfolioStatus} /> },
  {
    key: "reasons",
    label: "Health",
    sortValue: (row) => row.reasons.length,
    sortable: true,
    // At risk / On track comes only from the server's reasons — never
    // recomputed here — and the pill is never shown without the reasons that
    // earned it. "Not assessed" when the viewer can't see any of the three
    // risk kinds: "On track" would claim checks that never ran for them.
    render: (row) =>
      !row.assessed ? (
        <StatusPill value="Not assessed" tone="neutral" />
      ) : row.reasons.length === 0 ? (
        <StatusPill value="On track" tone="positive" />
      ) : (
        <div className="space-y-1.5" onClick={(event) => event.stopPropagation()}>
          <StatusPill value="At risk" tone="problem" />
          <ul className="space-y-1">
            {row.reasons.map((reason) => (
              <li key={reason.kind}>
                <Link
                  to={riskHref(reason.kind, { projectId: row.id })}
                  className="text-xs text-rose-700 hover:underline"
                >
                  {reasonText(reason)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ),
  },
];

const delayedColumns: ResourceColumn<DelayedRow>[] = [
  { key: "projectCode", label: "Project", render: (row) => `${row.projectCode} · ${row.client}` },
  { key: "name", label: "Work package" },
  { key: "plannedEnd", label: "Planned end", render: (row) => formatDate(row.plannedEnd) },
  { key: "percentComplete", label: "Complete", align: "right", render: (row) => `${row.percentComplete}%` },
  {
    key: "daysDelayed",
    label: "Delay",
    align: "right",
    render: (row) => <StatusPill value={`${plural(row.daysDelayed, "day")} late`} tone="problem" />,
  },
  { key: "responsibleUserName", label: "Responsible", render: (row) => row.responsibleUserName ?? "Not assigned" },
  {
    key: "delayReason",
    label: "Reason",
    render: (row) => (row.delayReason ? WORK_PACKAGE_DELAY_REASON_LABELS[row.delayReason] : "Not recorded"),
  },
];

const complianceProjectColumns: ResourceColumn<ComplianceProjectRow>[] = [
  { key: "code", label: "Project", sortable: true, render: (row) => `${row.code} · ${row.client}` },
  { key: "totalCount", label: "Licences", align: "right", sortable: true },
  { key: "grantedCount", label: "Granted", align: "right", sortable: true },
  { key: "inProgressCount", label: "In progress", align: "right", sortable: true },
  { key: "notStartedCount", label: "Not started", align: "right", sortable: true },
  {
    key: "overdueCount",
    label: "Past target",
    align: "right",
    sortable: true,
    render: (row) => (row.overdueCount > 0 ? <StatusPill value={String(row.overdueCount)} tone="problem" /> : "0"),
  },
  {
    key: "expiringSoonCount",
    label: "Expiring soon",
    align: "right",
    sortable: true,
    render: (row) =>
      row.expiringSoonCount > 0 ? <StatusPill value={String(row.expiringSoonCount)} tone="waiting" /> : "0",
  },
];

const outstandingColumns: ResourceColumn<OutstandingRow>[] = [
  { key: "clientName", label: "Client", render: (row) => row.clientName ?? NOT_AVAILABLE },
  { key: "projectCode", label: "Project", render: (row) => row.projectCode ?? NOT_AVAILABLE },
  { key: "number", label: "Invoice" },
  { key: "invoiceDate", label: "Invoice date", render: (row) => formatDate(row.invoiceDate) },
  { key: "dueDate", label: "Due date", render: (row) => (row.dueDate ? formatDate(row.dueDate) : NOT_AVAILABLE) },
  { key: "outstandingPaise", label: "Outstanding", align: "right", render: (row) => formatPaise(row.outstandingPaise) },
  {
    key: "ageingBucket",
    label: "Ageing",
    render: (row) => (row.ageingBucket ? <StatusPill value={row.ageingBucket} /> : "No due date"),
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

type QuickAction = "lead" | "activity" | "quotation" | "mou" | "progress" | null;

/** Everything a KPI card may read. Each card picks its own figure; none is computed in the row itself. */
interface KpiContext {
  summary: ReturnType<typeof useLeadSummary>;
  myDay: ReturnType<typeof useMyDay>;
  dashboard: ReturnType<typeof useDashboard>;
}

/** One KPI card, declared as data. `module` gates it with the same `canAccess(role, module, READ)` as the rest of the page. */
interface KpiCardDef {
  key: string;
  module: AppModule;
  icon: LucideIcon;
  label: (ctx: KpiContext) => string;
  value: (ctx: KpiContext) => string;
  isLoading: (ctx: KpiContext) => boolean;
  to: (ctx: KpiContext) => string | undefined;
}

interface KpiRowDef {
  gridClass: string;
  busy: (ctx: KpiContext) => boolean;
  cards: KpiCardDef[];
}

const stat = (value: number | undefined) => (value === undefined ? "—" : String(value));

/** The original lead-inbox strip, unchanged — Sales Head/BDE's row, and the default until a role gets its own. */
const LEAD_KPI_ROW: KpiRowDef = {
  gridClass: "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5",
  busy: ({ summary, myDay }) => summary.isLoading || myDay.isLoading,
  cards: [
    {
      key: "openLeads",
      module: AppModule.crm,
      icon: Users,
      label: ({ summary }) =>
        summary.data ? `Open leads · ${formatPaiseAsCrore(summary.data.openIndicativeValueTotalPaise)}` : "Open leads",
      value: ({ summary }) => stat(summary.data?.open),
      isLoading: ({ summary }) => summary.isLoading,
      to: () => "/app/crm/leads",
    },
    {
      key: "unassigned",
      module: AppModule.crm,
      icon: UserX,
      label: () => "Unassigned",
      value: ({ summary }) => stat(summary.data?.unassigned),
      isLoading: ({ summary }) => summary.isLoading,
      to: () => "/app/crm/leads?segment=unassigned",
    },
    {
      key: "noFirstResponse",
      module: AppModule.crm,
      icon: MailQuestion,
      label: () => "Awaiting first response",
      value: ({ summary }) => stat(summary.data?.noFirstResponse),
      isLoading: ({ summary }) => summary.isLoading,
      to: () => "/app/crm/leads?segment=noFirstResponse",
    },
    {
      key: "overdueCommitments",
      module: AppModule.crm,
      icon: AlertTriangle,
      label: () => "Overdue commitments",
      value: ({ myDay }) => stat(myDay.data?.overdue.count),
      isLoading: ({ myDay }) => myDay.isLoading,
      to: () => "/app/my-day",
    },
    {
      key: "parkedDue",
      module: AppModule.crm,
      icon: PauseCircle,
      label: () => "Parked due for revisit",
      value: ({ summary }) => stat(summary.data?.parkedDueForRevisit),
      isLoading: ({ summary }) => summary.isLoading,
      to: () => "/app/crm/leads?segment=parkedDue",
    },
  ],
};

const OPEN_LEAD_STAGES = new Set<string>([LeadStage.ENQUIRY, LeadStage.QUALIFICATION, LeadStage.SITE_VISIT, LeadStage.QUOTATION, LeadStage.NEGOTIATION, LeadStage.MOU]);

/** Director/Management: the business in four numbers — delivery, pipeline, cash, and new commitments this financial year. */
const DIRECTOR_KPI_ROW: KpiRowDef = {
  gridClass: "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4",
  busy: ({ dashboard }) => dashboard.isLoading,
  cards: [
    {
      key: "activeProjects",
      module: AppModule.projects,
      icon: FolderKanban,
      label: ({ dashboard }) => {
        const portfolio = dashboard.data?.projectHealth?.portfolio;
        if (!portfolio) return "Active projects";
        const unvalued = portfolio.activeWithoutValueCount > 0 ? ` (${portfolio.activeWithoutValueCount} without a value)` : "";
        return `Active projects · ${formatPaiseAsCrore(portfolio.activeContractValuePaise)}${unvalued}`;
      },
      value: ({ dashboard }) =>
        stat(dashboard.data?.projectHealth?.portfolio.byStatus.find((row) => row.status === ProjectPortfolioStatus.ACTIVE)?.count ?? undefined),
      isLoading: ({ dashboard }) => dashboard.isLoading,
      to: () => `/app/projects?portfolio=${ProjectPortfolioStatus.ACTIVE}`,
    },
    {
      key: "openPipeline",
      module: AppModule.crm,
      icon: Users,
      label: ({ dashboard }) => {
        const open = (dashboard.data?.pipeline ?? []).filter((row) => OPEN_LEAD_STAGES.has(row.stage));
        return dashboard.data ? `Open pipeline · ${plural(open.reduce((sum, row) => sum + row.count, 0), "lead")}` : "Open pipeline";
      },
      value: ({ dashboard }) =>
        dashboard.data
          ? formatPaiseAsCrore(
              dashboard.data.pipeline
                .filter((row) => OPEN_LEAD_STAGES.has(row.stage))
                .reduce((sum, row) => sum + row.indicativeValueTotalPaise, 0),
            )
          : "—",
      isLoading: ({ dashboard }) => dashboard.isLoading,
      to: () => "/app/crm/leads",
    },
    {
      key: "outstandingReceivables",
      module: AppModule.receivables,
      icon: CircleDollarSign,
      label: ({ dashboard }) => {
        const receivables = dashboard.data?.receivables;
        if (!receivables) return "Outstanding receivables";
        const retention =
          // Exact rupees, not crore: retention is often well under ₹1 Cr and would round to "₹0.00 Cr".
          receivables.retentionHeld.paise > 0 ? ` · ${formatPaise(receivables.retentionHeld.paise)} retention held apart` : "";
        return `Outstanding receivables · ${plural(receivables.openCount, "invoice")}${retention}`;
      },
      value: ({ dashboard }) =>
        dashboard.data?.receivables ? formatPaiseAsCrore(dashboard.data.receivables.totalOutstandingPaise) : "—",
      isLoading: ({ dashboard }) => dashboard.isLoading,
      to: () => "/app/billing/invoices?receivable=1",
    },
    {
      key: "signedMous",
      module: AppModule.crm,
      icon: BadgeCheck,
      label: ({ dashboard }) => {
        const signed = dashboard.data?.signedMous;
        return signed
          ? `Signed MOUs · ${signed.periodLabel} · ${formatPaiseAsCrore(signed.contractValuePaise)}`
          : "Signed MOUs this financial year";
      },
      value: ({ dashboard }) => stat(dashboard.data?.signedMous?.count),
      isLoading: ({ dashboard }) => dashboard.isLoading,
      to: ({ dashboard }) => {
        const signed = dashboard.data?.signedMous;
        return signed
          ? `/app/crm/mou?status=${MouStatus.SIGNED}&signedFrom=${encodeURIComponent(signed.periodStart)}`
          : `/app/crm/mou?status=${MouStatus.SIGNED}`;
      },
    },
  ],
};

/**
 * Project Manager: the projects assigned to them (PM, site engineer, liaison
 * or member — the app's "Assigned to me"). Every figure comes from the
 * server's `myProjects`, resolved from the verified token. "Milestones ready
 * to raise" is deliberately absent: `PaymentSchedule.lines` carries no stored
 * or derivable readiness state, so there is no real number to show.
 */
const PROJECT_MANAGER_KPI_ROW: KpiRowDef = {
  gridClass: "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4",
  busy: ({ dashboard }) => dashboard.isLoading,
  cards: [
    {
      key: "myActiveProjects",
      module: AppModule.projects,
      icon: FolderKanban,
      label: ({ dashboard }) => {
        const mine = dashboard.data?.myProjects;
        return mine ? `My active projects · ${mine.openCount} open incl. on hold` : "My active projects";
      },
      value: ({ dashboard }) => stat(dashboard.data?.myProjects?.activeCount),
      isLoading: ({ dashboard }) => dashboard.isLoading,
      to: () => `/app/projects?portfolio=${ProjectPortfolioStatus.ACTIVE}&mine=true`,
    },
    {
      key: "dueThisWeek",
      module: AppModule.schedule,
      icon: CalendarClock,
      label: () => "Work packages due in the next 7 days",
      value: ({ dashboard }) => stat(dashboard.data?.myProjects?.dueThisWeekCount),
      isLoading: ({ dashboard }) => dashboard.isLoading,
      to: () => "/app/schedule/work-packages?dueThisWeek=1&mine=1",
    },
    {
      key: "myDelayed",
      module: AppModule.schedule,
      icon: AlertTriangle,
      label: () => "Delayed work packages",
      value: ({ dashboard }) => stat(dashboard.data?.myProjects?.delayedCount),
      isLoading: ({ dashboard }) => dashboard.isLoading,
      to: () => "/app/schedule/work-packages?delayed=1&mine=1",
    },
    {
      key: "overallProgress",
      module: AppModule.schedule,
      icon: BadgeCheck,
      label: () => "Overall progress · my open projects",
      value: ({ dashboard }) => {
        const mine = dashboard.data?.myProjects;
        if (!mine) return "—";
        return mine.progressPct === null ? NOT_AVAILABLE : `${mine.progressPct}%`;
      },
      isLoading: ({ dashboard }) => dashboard.isLoading,
      to: () => "/app/projects?mine=true",
    },
  ],
};

/** Accounts: cash owed, cash late, cash in, cash withheld — exact rupees, because Accounts reconciles to the paisa. */
const ACCOUNTS_KPI_ROW: KpiRowDef = {
  gridClass: "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4",
  busy: ({ dashboard }) => dashboard.isLoading,
  cards: [
    {
      key: "outstanding",
      module: AppModule.receivables,
      icon: CircleDollarSign,
      label: ({ dashboard }) => {
        const receivables = dashboard.data?.receivables;
        return receivables ? `Outstanding · ${plural(receivables.openCount, "invoice")}` : "Outstanding";
      },
      value: ({ dashboard }) =>
        dashboard.data?.receivables ? formatPaise(dashboard.data.receivables.totalOutstandingPaise) : "—",
      isLoading: ({ dashboard }) => dashboard.isLoading,
      to: () => "/app/billing/invoices?receivable=1",
    },
    {
      key: "invoicesOverdue",
      module: AppModule.receivables,
      icon: AlertTriangle,
      label: ({ dashboard }) => {
        const overdue = dashboard.data?.receivables?.overdue;
        return overdue ? `Invoices overdue · ${formatPaise(overdue.outstandingPaise)}` : "Invoices overdue";
      },
      value: ({ dashboard }) => stat(dashboard.data?.receivables?.overdue.count),
      isLoading: ({ dashboard }) => dashboard.isLoading,
      to: () => "/app/billing/invoices?overdue=1",
    },
    {
      key: "collectedThisMonth",
      module: AppModule.billing,
      icon: Hourglass,
      label: ({ dashboard }) => {
        const month = dashboard.data?.billing.at(-1);
        return month ? `Collected · ${monthLabel(month.month)}` : "Collected this month";
      },
      value: ({ dashboard }) => {
        const month = dashboard.data?.billing.at(-1);
        return month ? formatPaise(month.collectedPaise) : "—";
      },
      isLoading: ({ dashboard }) => dashboard.isLoading,
      to: ({ dashboard }) => {
        const month = dashboard.data?.billing.at(-1);
        return month ? `/app/receivables/receipts?month=${month.month}` : "/app/receivables/receipts";
      },
    },
    {
      key: "retentionHeld",
      module: AppModule.receivables,
      icon: PauseCircle,
      label: ({ dashboard }) => {
        const retention = dashboard.data?.receivables?.retentionHeld;
        return retention ? `Retention held · ${plural(retention.count, "invoice")} · not aged` : "Retention held";
      },
      value: ({ dashboard }) =>
        dashboard.data?.receivables ? formatPaise(dashboard.data.receivables.retentionHeld.paise) : "—",
      isLoading: ({ dashboard }) => dashboard.isLoading,
      to: () => "/app/billing/invoices?retention=1",
    },
  ],
};

/**
 * Liaison & Compliance Officer. "Queries awaiting response" and "Upcoming
 * authority visits" are deliberately absent: `Licence.queries[]`/`visits[]`
 * exist but nothing can write to them yet (the visit/query logs are unbuilt),
 * so both would read a permanent, meaningless zero. Each becomes one entry
 * here once those logs exist.
 */
const LIAISON_KPI_ROW: KpiRowDef = {
  gridClass: "grid grid-cols-1 gap-4 sm:grid-cols-2",
  busy: ({ dashboard }) => dashboard.isLoading,
  cards: [
    {
      key: "licencesOverdue",
      module: AppModule.compliance,
      icon: ShieldAlert,
      label: () => "Licences past target, not cleared",
      value: ({ dashboard }) => stat(dashboard.data?.compliance?.overdueCount),
      isLoading: ({ dashboard }) => dashboard.isLoading,
      to: () => "/app/compliance/licences?overdue=1&openProjects=1",
    },
    {
      key: "appliedThisWeek",
      module: AppModule.compliance,
      icon: BadgeCheck,
      label: () => "Applied in the last 7 days",
      value: ({ dashboard }) => stat(dashboard.data?.compliance?.appliedThisWeekCount),
      isLoading: ({ dashboard }) => dashboard.isLoading,
      to: () => "/app/compliance/licences?appliedThisWeek=1&openProjects=1",
    },
  ],
};

/**
 * The KPI row per role — one entry per role, nothing else changes. A role
 * without an entry gets the lead strip, filtered like every card by its own
 * module.
 */
const KPI_ROW_BY_ROLE: Partial<Record<Role, KpiRowDef>> = {
  [Role.DIRECTOR]: DIRECTOR_KPI_ROW,
  [Role.SALES_HEAD_BDE]: LEAD_KPI_ROW,
  [Role.PROJECT_MANAGER]: PROJECT_MANAGER_KPI_ROW,
  [Role.ACCOUNTS]: ACCOUNTS_KPI_ROW,
  [Role.LIAISON_COMPLIANCE_OFFICER]: LIAISON_KPI_ROW,
};

export function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const can = (module: AppModule, level: AccessLevel = AccessLevel.READ) =>
    Boolean(user && canAccess(user.role, module, level));
  const canReadCrm = can(AppModule.crm);
  const canSeeTeamQueue = can(AppModule.crm, AccessLevel.FULL);
  const canReadBilling = can(AppModule.billing);
  const canReadCompliance = can(AppModule.compliance);
  const canReadProjects = can(AppModule.projects);
  const canReadSchedule = can(AppModule.schedule);
  const canReadReceivables = can(AppModule.receivables);
  const canWriteCrm = can(AppModule.crm, AccessLevel.WRITE);
  const canWriteSchedule = can(AppModule.schedule, AccessLevel.WRITE);
  // Mirrors dashboard.routes.ts: client accounts never reach the endpoint.
  const dashboardEnabled =
    user?.role !== Role.CLIENT &&
    (canReadCrm || canReadBilling || canReadCompliance || canReadProjects || canReadSchedule || canReadReceivables);

  const summary = useLeadSummary(DASHBOARD_SUMMARY_FILTERS, { enabled: canReadCrm });
  const myDay = useMyDay(canSeeTeamQueue ? "team" : "mine", { enabled: canReadCrm });
  // The widget is always the viewer's own day. For roles whose KPI already
  // reads "mine" this is the very same cached query; a team-view role (Sales
  // Head, Director) gets one more call to the same endpoint.
  const myDayMine = useMyDay("mine", { enabled: canReadCrm });
  const dashboard = useDashboard({ enabled: dashboardEnabled });
  const [quickAction, setQuickAction] = useState<QuickAction>(null);

  const closeQuickAction = () => {
    setQuickAction(null);
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource(RESOURCE.dashboard) });
  };

  const kpiContext: KpiContext = { summary, myDay, dashboard };
  const kpiRow = (user && KPI_ROW_BY_ROLE[user.role]) ?? LEAD_KPI_ROW;
  const kpiCards = kpiRow.cards.filter((card) => can(card.module));
  const data = dashboard.data;
  const loading = dashboard.isLoading;

  const pipeline: DashboardPipelineStageDto[] = data?.pipeline ?? [];
  const pipelineTotalLeads = pipeline.reduce((sum, row) => sum + row.count, 0);
  const pipelineRows: PipelineRow[] = pipeline.map((row) => ({ ...row, _id: row.stage }));

  const mou = data?.mou ?? [];
  const signedMou = mou.find((row) => row.status === MouStatus.SIGNED);
  const inProgressMouCount = mou
    .filter((row) => row.status === MouStatus.DRAFT || row.status === MouStatus.SENT)
    .reduce((sum, row) => sum + row.count, 0);
  const quotations = data?.quotations;
  const recentActivity = toActivityRailItems(data?.recentActivity ?? []);

  const billing = data?.billing ?? [];
  const billingMonthsWithData = billing.filter((row) => row.invoicedPaise > 0 || row.collectedPaise > 0);

  const compliance = data?.compliance;
  const projectHealth = data?.projectHealth;
  const portfolio = projectHealth?.portfolio;
  const healthRows: HealthRow[] = (projectHealth?.rows ?? []).map((row) => ({
    ...row,
    _id: row.id,
    assessed: (projectHealth?.evaluatedKinds.length ?? 0) > 0,
  }));
  const unevaluatedKinds = projectHealth
    ? (Object.values(ProjectRiskKind) as ProjectRiskKind[]).filter((kind) => !projectHealth.evaluatedKinds.includes(kind))
    : [];
  const delayed = data?.delayedWorkPackages;
  const delayedRows: DelayedRow[] = (delayed?.rows ?? []).map((row) => ({ ...row, _id: row.id }));
  const complianceProjectRows: ComplianceProjectRow[] = (compliance?.byProject ?? []).map((row) => ({
    ...row,
    _id: row.projectId,
  }));
  const receivables = data?.receivables;
  const outstandingRows: OutstandingRow[] = (receivables?.top ?? []).map((row) => ({ ...row, _id: row.invoiceId }));
  const alerts = data?.criticalAlerts ?? [];
  const MY_DAY_WIDGET_LIMIT = 4;
  const myDayDueCount = (myDayMine.data?.overdue.count ?? 0) + (myDayMine.data?.today.count ?? 0);
  const myDayItems = [
    ...[...(myDayMine.data?.overdue.items ?? [])].sort((a, b) => b.daysLate - a.daysLate),
    ...(myDayMine.data?.today.items ?? []),
  ].slice(0, MY_DAY_WIDGET_LIMIT);
  const canSeeAnyRisk = canReadSchedule || canReadCompliance || canReadReceivables;

  const quickActions: { key: Exclude<QuickAction, null>; label: string; allowed: boolean }[] = [
    { key: "lead", label: "New lead", allowed: canWriteCrm },
    { key: "activity", label: "Log activity", allowed: canWriteCrm },
    { key: "quotation", label: "New quotation", allowed: canWriteCrm },
    { key: "mou", label: "New MOU", allowed: canWriteCrm },
    { key: "progress", label: "New progress update", allowed: canWriteSchedule },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Dashboard" subtitle="Every figure below is read live from the module it links to.">
        {quickActions
          .filter((action) => action.allowed)
          .map((action) => (
            <Button key={action.key} size="sm" variant="secondary" onClick={() => setQuickAction(action.key)}>
              {action.label}
            </Button>
          ))}
      </PageHeader>

      {canSeeAnyRisk && (
        <Card title="Critical alerts" bodyPadding={false}>
          {loading ? (
            <div className="p-5">
              <Skeleton className="h-24 w-full" />
            </div>
          ) : alerts.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-slate-500">
              No delayed work packages, licences past target or invoices past due right now.
            </p>
          ) : (
            <>
              {data?.criticalAlertsPriority && (
                <p className="border-b border-slate-100 px-5 py-2 text-xs text-slate-500">
                  {RISK_KIND_LABELS[data.criticalAlertsPriority]} items first, then the rest by days late —
                  weighted for your role.
                </p>
              )}
              <ul className="divide-y divide-slate-100">
                {alerts.map((alert) => (
                  <li key={`${alert.kind}-${alert.id}`}>
                    <Link
                      to={riskHref(alert.kind, { id: alert.id })}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 transition-colors duration-150 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-methanova-gold motion-reduce:transition-none"
                    >
                      <StatusPill value={RISK_KIND_LABELS[alert.kind]} tone="problem" />
                      <span className="text-sm font-medium text-slate-900">{alertText(alert)}</span>
                      <span className="text-xs text-slate-500">
                        {alert.projectCode} · {alert.client}
                        {alert.onMyProject && " · your project"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      )}

      {kpiCards.length > 0 && (
        <div className={kpiRow.gridClass} aria-busy={kpiRow.busy(kpiContext)}>
          {kpiCards.map((card) => (
            <StatCard
              key={card.key}
              icon={card.icon}
              label={card.label(kpiContext)}
              value={card.value(kpiContext)}
              isLoading={card.isLoading(kpiContext)}
              to={card.to(kpiContext)}
            />
          ))}
        </div>
      )}

      {canReadProjects && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {(portfolio?.byStatus ?? []).map((row) => (
            <StatCard
              key={row.status}
              icon={PORTFOLIO_ICONS[row.status]}
              label={`${PORTFOLIO_LABELS[row.status]} projects`}
              value={row.count === null ? NOT_AVAILABLE : String(row.count)}
              isLoading={loading}
              to={row.count === null ? undefined : `/app/projects?portfolio=${row.status}`}
            />
          ))}
          <StatCard
            icon={ShieldAlert}
            label={portfolio ? `At risk · of ${portfolio.openCount} open` : "At risk"}
            value={stat(portfolio?.atRiskCount)}
            isLoading={loading}
            to="/app/projects?atRisk=1"
          />
        </div>
      )}

      {canReadProjects && (
        <Card
          title="Project health"
          bodyPadding={false}
          action={
            <Link to="/app/projects" className="text-xs font-medium text-methanova-green hover:underline">
              View all
            </Link>
          }
        >
          <ResourceTable
            rows={healthRows}
            columns={healthColumns}
            isLoading={loading}
            onRowClick={(row) => navigate(`/app/projects/${row.id}`)}
            emptyHint="No open projects. Projects appear here once an MOU is signed."
          />
          {unevaluatedKinds.length > 0 && (
            <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
              Risk reasons shown are limited to the modules you can access — not checked for you:{" "}
              {unevaluatedKinds.map((kind) => RISK_KIND_LABELS[kind].toLowerCase()).join(", ")}.
            </p>
          )}
        </Card>
      )}

      {canReadSchedule && (
        <Card
          title={delayed ? `Delayed work packages · ${delayed.totalCount}` : "Delayed work packages"}
          bodyPadding={false}
          action={
            <Link
              to="/app/schedule/work-packages?delayed=1&openProjects=1"
              className="text-xs font-medium text-methanova-green hover:underline"
            >
              View all
            </Link>
          }
        >
          <ResourceTable
            rows={delayedRows}
            columns={delayedColumns}
            isLoading={loading}
            onRowClick={(row) => navigate(`/app/schedule/work-packages?id=${row.id}`)}
            emptyHint="No work package on an open project is past its planned end with work outstanding."
          />
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {canReadBilling && (
          <Card title="Billing & collections" className="lg:col-span-2">
            {loading ? (
              <Skeleton className="h-56 w-full" />
            ) : billingMonthsWithData.length >= BILLING_CHART_MIN_MONTHS ? (
              <BarChart
                categories={billing.map((row) => monthLabel(row.month))}
                series={[
                  { label: "Invoiced", colorClass: "fill-methanova-green", values: billing.map((row) => row.invoicedPaise) },
                  { label: "Collected", colorClass: "fill-methanova-gold", values: billing.map((row) => row.collectedPaise) },
                ]}
                formatValue={formatPaise}
              />
            ) : billingMonthsWithData.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">
                Invoiced vs collected by month appears once invoices exist.
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-500">
                  Only {plural(billingMonthsWithData.length, "month")} of billing history so far — the chart fills in
                  once there are at least {BILLING_CHART_MIN_MONTHS}.
                </p>
                <ul className="space-y-1 text-sm">
                  {billingMonthsWithData.map((row) => (
                    <li key={row.month} className="flex justify-between tabular-nums text-slate-700">
                      <span>{monthLabel(row.month)}</span>
                      <span>
                        {formatPaise(row.invoicedPaise)} invoiced · {formatPaise(row.collectedPaise)} collected
                      </span>
                    </li>
                  ))}
                </ul>
                <Link to="/app/billing/invoices" className="text-xs font-medium text-methanova-green hover:underline">
                  View invoices
                </Link>
              </div>
            )}
          </Card>
        )}

        {canReadCompliance && (
          <Card title="Compliance health">
            {loading || !compliance ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <>
                <DonutMeter
                  value={compliance.grantedCount}
                  total={compliance.totalCount}
                  caption="Licences granted across open projects"
                />
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Link to="/app/compliance/licences?overdue=1&openProjects=1" className={LINK_CLASS}>
                    <p className="text-xs text-slate-500">Past target, not cleared</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums text-rose-700">{compliance.overdueCount}</p>
                  </Link>
                  <Link to="/app/compliance/licences?expiringSoon=1&openProjects=1" className={LINK_CLASS}>
                    <p className="text-xs text-slate-500">Expiring within {compliance.expiringWindowDays} days</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums text-amber-700">{compliance.expiringSoonCount}</p>
                  </Link>
                </div>
                <ul className="mt-3 space-y-1">
                  {compliance.byStatus.map((row) => (
                    <li key={row.status}>
                      <Link
                        to={`/app/compliance/licences?status=${row.status}&openProjects=1`}
                        className="flex items-center justify-between rounded px-2 py-1 text-sm hover:bg-slate-50"
                      >
                        <StatusPill value={row.status} tone={row.status === LicenceStatus.REJECTED ? "problem" : undefined} />
                        <span className="tabular-nums text-slate-600">{row.count}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>
        )}
      </div>

      {canReadCompliance && (
        <Card title="Compliance by project" bodyPadding={false}>
          <ResourceTable
            rows={complianceProjectRows}
            columns={complianceProjectColumns}
            isLoading={loading}
            onRowClick={(row) => navigate(`/app/compliance/licences?projectId=${row.projectId}`)}
            emptyHint="No open project has a licence checklist yet."
          />
        </Card>
      )}

      {canReadReceivables && (
        <Card
          title={
            receivables
              ? `Receivables ageing · ${formatPaise(receivables.totalOutstandingPaise)} outstanding`
              : "Receivables ageing"
          }
        >
          {loading || !receivables ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {receivables.buckets.map((row) => (
                <StatCard
                  key={row.bucket}
                  icon={row.bucket === AgeingBucket.CURRENT ? CalendarClock : Hourglass}
                  label={`${BUCKET_LABELS[row.bucket]} · ${formatPaise(row.outstandingPaise)}`}
                  value={String(row.count)}
                  to={`/app/billing/invoices?bucket=${encodeURIComponent(row.bucket)}`}
                />
              ))}
              <StatCard
                icon={CircleDollarSign}
                label={`No due date · ${formatPaise(receivables.noDueDate.outstandingPaise)}`}
                value={String(receivables.noDueDate.count)}
                to="/app/billing/invoices?bucket=none"
              />
              <StatCard
                icon={Hourglass}
                label={`Retention held · ${formatPaise(receivables.retentionHeld.paise)} · not aged`}
                value={String(receivables.retentionHeld.count)}
                to="/app/billing/invoices?retention=1"
              />
            </div>
          )}
        </Card>
      )}

      {canReadReceivables && (
        <Card
          title="Top outstanding receivables"
          bodyPadding={false}
          action={
            <Link to="/app/billing/invoices?receivable=1" className="text-xs font-medium text-methanova-green hover:underline">
              View all
            </Link>
          }
        >
          <ResourceTable
            rows={outstandingRows}
            columns={outstandingColumns}
            isLoading={loading}
            onRowClick={(row) => navigate(`/app/billing/invoices?id=${row.invoiceId}`)}
            emptyHint="Nothing outstanding — every issued invoice is settled by its receipts."
          />
        </Card>
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
          {loading ? (
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
                  <ResourceTable
                    rows={pipelineRows}
                    columns={pipelineColumns}
                    onRowClick={(row) => navigate(`/app/crm/leads?stage=${row.stage}`)}
                  />
                </div>
              )}

              <div className="mt-5 grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-3">
                <Link to={`/app/crm/mou?status=${MouStatus.SIGNED}`} className={LINK_CLASS}>
                  <p className="text-xs text-slate-500">Signed MOUs</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
                    {signedMou?.count ?? 0}
                    <span className="ml-1.5 text-sm font-normal text-slate-500">
                      · {formatPaiseAsCrore(signedMou?.contractValuePaise ?? 0)}
                    </span>
                  </p>
                </Link>
                <Link to={`/app/crm/mou?status=${MouStatus.DRAFT},${MouStatus.SENT}`} className={LINK_CLASS}>
                  <p className="text-xs text-slate-500">MOUs in progress</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{inProgressMouCount}</p>
                </Link>
                <Link to="/app/crm/quotations?open=1" className={LINK_CLASS}>
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
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
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
              isLoading={loading}
              emptyState={
                <div className="px-5 py-10 text-center">
                  <p className="text-sm font-medium text-slate-900">No activity logged yet</p>
                  <p className="mt-1 text-sm text-slate-500">Calls, visits and emails across every lead show up here.</p>
                </div>
              }
            />
          </Card>

          <Card
            title={myDayMine.data ? `My Day · ${myDayDueCount} due` : "My Day"}
            bodyPadding={false}
            action={
              <Link to="/app/my-day" className="text-xs font-medium text-methanova-green hover:underline">
                Open My Day
              </Link>
            }
          >
            {myDayMine.isLoading ? (
              <div className="p-5">
                <Skeleton className="h-24 w-full" />
              </div>
            ) : myDayItems.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-sm font-medium text-slate-900">Nothing due today</p>
                <p className="mt-1 text-sm text-slate-500">
                  {myDayMine.data && myDayMine.data.thisWeek.count > 0
                    ? `${plural(myDayMine.data.thisWeek.count, "commitment")} due later this week.`
                    : "No overdue or due-today follow-ups on your leads."}
                </p>
              </div>
            ) : (
              <>
                <ul className="divide-y divide-slate-100">
                  {myDayItems.map((row) => (
                    <li key={`${row.source}-${row.leadId}`}>
                      <Link
                        to={`/app/crm/leads/${row.leadId}`}
                        className="flex items-start justify-between gap-3 px-5 py-3 transition-colors duration-150 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-methanova-gold motion-reduce:transition-none"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900">{row.commitmentText || "Follow up"}</p>
                          <p className="mt-0.5 truncate text-xs text-slate-500">
                            {row.companyName} · {row.leadCode}
                          </p>
                        </div>
                        {row.daysLate > 0 ? (
                          <StatusPill value={`${plural(row.daysLate, "day")} overdue`} tone="problem" />
                        ) : (
                          <StatusPill value="Due today" tone="waiting" />
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
                {myDayDueCount > myDayItems.length && (
                  <p className="border-t border-slate-100 px-5 py-2.5 text-xs text-slate-500">
                    +{myDayDueCount - myDayItems.length} more on{" "}
                    <Link to="/app/my-day" className="font-medium text-methanova-green hover:underline">
                      My Day
                    </Link>
                  </p>
                )}
              </>
            )}
          </Card>
        </div>
      )}

      {/* Every quick-action modal is mounted only while open: each loads its
          own reference data (leads, quotations, masters, work packages), which
          a role without that module's access would otherwise fetch — and 403
          on — every time the dashboard loads. */}
      {quickAction === "lead" && (
        <AddLeadWizard
          open
          onClose={closeQuickAction}
          onCreated={(lead) => {
            closeQuickAction();
            navigate(`/app/crm/leads/${lead._id}`);
          }}
        />
      )}
      {quickAction === "activity" && <LogActivityModal open onClose={closeQuickAction} />}
      {quickAction === "quotation" && <CreateQuotationModal open onClose={closeQuickAction} />}
      {quickAction === "mou" && <CreateMouModal open onClose={closeQuickAction} />}
      {quickAction === "progress" && <LogProgressModal open onClose={closeQuickAction} />}
    </div>
  );
}
