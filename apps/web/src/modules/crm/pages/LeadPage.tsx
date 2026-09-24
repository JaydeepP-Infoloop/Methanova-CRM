import { LEAD_STAGE_ORDER, LeadStage, LeadTemperature, type LeadListItemDto } from "@methanova/shared-types";
import { AlertTriangle, Hourglass, Inbox, MailQuestion, Plus, Sunrise, UserX } from "lucide-react";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart } from "../../../components/BarChart";
import { Button } from "../../../components/Button";
import { Field } from "../../../components/Field";
import { Card } from "../../../components/Card";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { FilterBar } from "../../../components/FilterBar";
import { IdentityCell } from "../../../components/IdentityCell";
import { KanbanBoard } from "../../../components/KanbanBoard";
import { PageHeader } from "../../../components/PagePrimitives";
import { ResourceTable, type ResourceColumn } from "../../../components/ResourceTable";
import { SegmentedFilter } from "../../../components/SegmentedFilter";
import { SkeletonBars } from "../../../components/Skeleton";
import { emptyStateMessage } from "../../../lib/emptyState";
import { StatCard } from "../../../components/StatCard";
import { StatusPill } from "../../../components/StatusPill";
import { useToast } from "../../../components/Toast";
import { ViewToggle, type ListView } from "../../../components/ViewToggle";
import { formatDate, formatPaise, formatPaiseAsCrore } from "../../../lib/formatters";
import { useAssignableUsers, useAssignLead } from "../api/activities.api";
import {
  useLeadList,
  useLeadSourceMix,
  useLeadSummary,
  useQualificationTally,
  type LeadListFilters,
} from "../api/leads.api";
import { useTransitionLead } from "../api/qualification.api";
import { AddLeadWizard } from "../components/AddLeadWizard";
import { LeadStageBadge } from "../components/LeadStageBadge";
import { LogActivityModal } from "../components/LogActivityModal";

const TABLE_PAGE_SIZE = 25;
/** Server list max is 100 — the board asks for that and names the remainder rather than pretending 25 rows are the pipeline. */
const KANBAN_PAGE_SIZE = 100;

/**
 * The inbox's primary cut. These are mutually exclusive by nature — you are
 * looking at everything, or at one slice — which is why they are a segmented
 * radio group rather than the independently-toggling cards that were here
 * before. Stage and temperature stay in FilterBar: those genuinely combine
 * with any of these.
 */
type Segment = "all" | "unassigned" | "noFirstResponse" | "arrivedToday";

/** Below this, a chart is noise rather than a signal — show the count instead. */
const MIN_LEADS_FOR_CHARTS = 5;

function isOverdue(dateValue: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dateValue) < today;
}

export function LeadPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const addButtonRef = useRef<HTMLButtonElement>(null);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [stage, setStage] = useState("");
  const [temperature, setTemperature] = useState("");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [segment, setSegment] = useState<Segment>("all");
  const [view, setView] = useState<ListView>("table");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  /** The lead whose "Log first response" was clicked — drives the shared modal. */
  const [logTarget, setLogTarget] = useState<LeadListItemDto | null>(null);
  /** Board drops onto LOST need a reason; the rest of the map can move immediately. */
  const [lostTarget, setLostTarget] = useState<LeadListItemDto | null>(null);
  const [lostReason, setLostReason] = useState("");
  const [lostError, setLostError] = useState<string | null>(null);

  const assign = useAssignLead();
  const users = useAssignableUsers();
  const transition = useTransitionLead();
  const pageSize = view === "kanban" ? KANBAN_PAGE_SIZE : TABLE_PAGE_SIZE;

  const filters: LeadListFilters = {
    page,
    pageSize,
    search: search.trim() || undefined,
    stage: stage || undefined,
    temperature: temperature || undefined,
    ownerUserId: segment === "unassigned" ? undefined : ownerUserId || undefined,
    unassigned: segment === "unassigned",
    noFirstResponse: segment === "noFirstResponse",
    arrivedToday: segment === "arrivedToday",
    sort: "oldest",
  };

  const list = useLeadList(filters);
  // Same filters as the list: two of the five figures describe the filtered
  // set, and a total computed over a different set than the rows beneath it
  // would be worse than no total at all.
  const summary = useLeadSummary(filters);
  const sourceMix = useLeadSourceMix();
  const criteriaTally = useQualificationTally();

  const columns: ResourceColumn<LeadListItemDto & Record<string, unknown>>[] = [
    { key: "leadCode", label: "Lead", sortable: true },
    {
      key: "companyName",
      label: "Company",
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <IdentityCell
            name={row.companyName}
            secondary={[row.districtName, row.stateName].filter(Boolean).join(", ") || undefined}
          />
          {row.slaBreached && (
            <span
              title="No first response past the SLA threshold"
              className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-600/20"
            >
              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
              SLA
            </span>
          )}
        </div>
      ),
    },
    { key: "sourceName", label: "Source", render: (row) => row.sourceName ?? "—" },
    {
      key: "feedstockQtyTpd",
      label: "Feedstock TPD",
      align: "right",
      sortable: true,
      render: (row) => String(row.feedstockQtyTpd ?? 0),
    },
    {
      key: "indicativeValuePaise",
      label: "Value",
      align: "right",
      sortable: true,
      // An unpriced lead shows an em dash, never ₹0.00 — the two mean
      // completely different things to whoever is reading this column.
      render: (row) =>
        row.indicativeValuePaise === null || row.indicativeValuePaise === undefined ? (
          <span className="text-slate-400">—</span>
        ) : (
          <span className="tabular-nums">{formatPaise(row.indicativeValuePaise)}</span>
        ),
    },
    { key: "stage", label: "Stage", render: (row) => <LeadStageBadge stage={row.stage} /> },
    { key: "temperature", label: "Temp", render: (row) => <StatusPill value={row.temperature} /> },
    {
      key: "ownerName",
      label: "Owner",
      render: (row) =>
        row.ownerName ? (
          <span className="text-sm text-slate-700">{row.ownerName}</span>
        ) : (
          <StatusPill value="Unassigned" tone="neutral" />
        ),
    },
    {
      key: "daysWaiting",
      label: "Days waiting",
      align: "right",
      sortable: true,
      render: (row) => <span className="tabular-nums">{row.daysWaiting}</span>,
    },
    {
      key: "nextAction",
      label: "Next action",
      render: (row) => (
        <div>
          <p className="text-sm text-slate-700">{row.nextAction}</p>
          <p className={`text-xs tabular-nums ${isOverdue(row.nextActionDate) ? "font-medium text-rose-600" : "text-slate-500"}`}>
            {formatDate(row.nextActionDate)}
            {isOverdue(row.nextActionDate) && " · overdue"}
          </p>
        </div>
      ),
    },
  ];

  async function handleAssignToMe(row: LeadListItemDto) {
    await assign.mutateAsync({ leadId: row.id });
    toast({ message: `${row.leadCode} assigned to you` });
  }

  async function moveLead(row: LeadListItemDto, to: string, reason?: string) {
    await transition.mutateAsync({ leadId: row.id, to, reason });
    toast({ message: `${row.leadCode} moved to ${to.replace(/_/g, " ")}` });
  }

  async function handleBoardMove(card: LeadListItemDto & { status: string }, to: string) {
    if (to === LeadStage.LOST) {
      setLostReason("");
      setLostError(null);
      setLostTarget(card);
      return;
    }
    await moveLead(card, to);
  }

  async function confirmLostMove() {
    if (!lostTarget) return;
    if (!lostReason.trim()) {
      setLostError("A reason is required when marking a lead lost");
      return;
    }
    setLostError(null);
    try {
      await moveLead(lostTarget, LeadStage.LOST, lostReason.trim());
      setLostTarget(null);
    } catch (caught) {
      setLostError(caught instanceof Error ? caught.message : "Could not move that lead.");
    }
  }

  const rows = (list.data?.items ?? []) as (LeadListItemDto & Record<string, unknown>)[];
  const total = list.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasSearch = Boolean(search);
  const hasFilters = Boolean(stage || temperature || ownerUserId || segment !== "all");
  const anyFilterActive = hasSearch || hasFilters;

  // The true-empty case keeps its own onboarding copy and an Add Lead
  // action — a search or filter miss should invite loosening the search or
  // filter instead, not dangle the same "create one" action a genuinely
  // empty inbox gets, so it goes through the shared helper instead.
  const emptyHint = anyFilterActive
    ? emptyStateMessage({ entityLabel: "leads", hasSearch, hasFilters })
    : {
        message: "No leads yet — every enquiry starts here. Add the first one and it will land unassigned, ready to be picked up.",
        action: { label: "Add Lead", onClick: () => setWizardOpen(true) },
      };

  /** An em dash until the number actually arrives — a placeholder 0 would read as a real count. */
  const stat = (value: number | undefined, format: (v: number) => string = String) =>
    value === undefined ? "—" : format(value);

  const sourceItems = sourceMix.data?.items ?? [];
  const tallyItems = criteriaTally.data?.items ?? [];
  const sourceTotal = sourceMix.data?.totalLeads ?? 0;
  const leadsScored = criteriaTally.data?.leadsScored ?? 0;

  return (
    <div>
      <PageHeader title="Lead Inbox" subtitle="Longest-waiting first — the top of this list is what needs attention.">
        <Button ref={addButtonRef} icon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={() => setWizardOpen(true)}>
          Add Lead
        </Button>
      </PageHeader>

      {/* Five read-only figures. Selecting a slice is the segmented bar's job
          below — a card that was both a number and a toggle did neither
          clearly, and modelled mutually exclusive slices as combinable. */}
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard icon={UserX} label="Unassigned" value={stat(summary.data?.unassigned)} />
        <StatCard icon={MailQuestion} label="No first response" value={stat(summary.data?.noFirstResponse)} />
        <StatCard
          icon={Inbox}
          label={
            summary.data
              ? `In the inbox · ${formatPaiseAsCrore(summary.data.indicativeValueTotalPaise)}`
              : "In the inbox"
          }
          value={list.data ? String(total) : "—"}
        />
        <StatCard
          icon={Hourglass}
          label="Slowest waiting"
          value={stat(summary.data?.slowestDaysWaiting, (v) => `${v}d`)}
        />
        <StatCard icon={Sunrise} label="Arrived today" value={stat(summary.data?.arrivedToday)} />
      </div>

      <div className="mb-4">
        <SegmentedFilter<Segment>
          label="Filter the inbox"
          value={segment}
          onChange={(value) => {
            setSegment(value);
            if (value === "unassigned") setOwnerUserId("");
            setPage(1);
          }}
          options={[
            { value: "all", label: "Everything in inbox" },
            { value: "unassigned", label: "Unassigned", count: summary.data?.unassigned },
            { value: "noFirstResponse", label: "Awaiting first response", count: summary.data?.noFirstResponse },
            { value: "arrivedToday", label: "Arrived today", count: summary.data?.arrivedToday },
          ]}
        />
      </div>

      <FilterBar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        placeholder="Search by company name or lead code…"
      >
        <select
          aria-label="Filter by stage"
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold"
          value={stage}
          onChange={(event) => {
            setStage(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All stages</option>
          {LEAD_STAGE_ORDER.map((value) => (
            <option key={value} value={value}>{value.replace(/_/g, " ")}</option>
          ))}
        </select>
        <select
          aria-label="Filter by temperature"
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold"
          value={temperature}
          onChange={(event) => {
            setTemperature(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All temperatures</option>
          {Object.values(LeadTemperature).map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
        <select
          aria-label="Filter by owner"
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold disabled:bg-slate-50 disabled:text-slate-400"
          value={segment === "unassigned" ? "" : ownerUserId}
          disabled={segment === "unassigned"}
          onChange={(event) => {
            setOwnerUserId(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All owners</option>
          {users.data?.map((user) => (
            <option key={user._id} value={user._id}>{user.name}</option>
          ))}
        </select>
        <ViewToggle
          view={view}
          onChange={(next) => {
            setView(next);
            setPage(1);
          }}
        />
      </FilterBar>

      {view === "table" ? (
        <>
          <div className={highlightId ? "[&_tr[data-highlight=true]]:bg-methanova-goldTint" : ""}>
            <ResourceTable
              rows={rows.map((row) => ({ ...row, _id: row.id, "data-highlight": row.id === highlightId }))}
              columns={columns}
              isLoading={list.isLoading}
              error={list.error as Error | null}
              emptyHint={emptyHint}
              onRowClick={(row) => navigate(`/app/crm/leads/${row.id as string}`)}
              highlightRowId={highlightId}
              rowActions={(row) => (
                <>
                  {!row.ownerUserId && (
                    <Button size="sm" variant="secondary" onClick={() => void handleAssignToMe(row)}>
                      Assign to me
                    </Button>
                  )}
                  {!row.firstResponseAt && (
                    <Button size="sm" variant="ghost" onClick={() => setLogTarget(row)}>
                      Log first response
                    </Button>
                  )}
                </>
              )}
            />
          </div>

          {total > TABLE_PAGE_SIZE && (
            <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
              <p className="tabular-nums">
                Showing {(page - 1) * TABLE_PAGE_SIZE + 1}–{Math.min(page * TABLE_PAGE_SIZE, total)} of {total}
              </p>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
                  Previous
                </Button>
                <span className="tabular-nums">Page {page} of {totalPages}</span>
                <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div>
          {total > KANBAN_PAGE_SIZE && (
            <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-inset ring-amber-600/20">
              Showing the first {KANBAN_PAGE_SIZE} of {total} matching leads. Narrow the filters or switch to the table to page through the rest.
            </p>
          )}
          <KanbanBoard
            entity="lead"
            columns={[...LEAD_STAGE_ORDER]}
            cards={rows.map((row) => ({ ...row, status: row.stage }))}
            isLoading={list.isLoading}
            emptyHint={typeof emptyHint === "string" ? emptyHint : emptyHint.message}
            onMove={(card, to) => handleBoardMove(card, to)}
            renderCard={(card) => (
              <button
                type="button"
                onClick={() => navigate(`/app/crm/leads/${card.id}`)}
                className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold"
              >
                <p className="text-sm font-medium text-slate-900">{card.companyName}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {[card.districtName, card.stateName].filter(Boolean).join(", ") || "Site not set"}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {card.isParked && <StatusPill value="Parked" tone="waiting" />}
                  <span className="text-xs tabular-nums text-slate-600">
                    {card.indicativeValuePaise === null || card.indicativeValuePaise === undefined ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      formatPaiseAsCrore(card.indicativeValuePaise)
                    )}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {card.ownerName ?? "Unassigned"} · {card.daysInStage}d in stage
                </p>
              </button>
            )}
          />
        </div>
      )}

      <details className="mt-6 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
        <summary className="cursor-pointer text-sm font-semibold text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold">
          Inbox insights
        </summary>
        <p className="mt-1 text-xs text-slate-500">Source mix and qualification averages — not the start of the Reports module.</p>
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card title="Where enquiries come from">
          {sourceMix.isLoading ? (
            <SkeletonBars />
          ) : sourceTotal < MIN_LEADS_FOR_CHARTS ? (
            <EmptyPanel>
              {sourceTotal === 0
                ? `No leads in the last ${sourceMix.data?.windowDays ?? 90} days yet. Source mix appears once enquiries start landing.`
                : `Only ${sourceTotal} lead${sourceTotal === 1 ? "" : "s"} in the last ${sourceMix.data?.windowDays ?? 90} days — too few for a mix to mean anything. This fills in at ${MIN_LEADS_FOR_CHARTS}.`}
            </EmptyPanel>
          ) : (
            <>
              <BarChart
                categories={sourceItems.map((item) => item.label)}
                series={[
                  {
                    label: `Leads (last ${sourceMix.data?.windowDays} days)`,
                    colorClass: "fill-methanova-green",
                    values: sourceItems.map((item) => item.count),
                  },
                ]}
                formatValue={(value) => `${value} lead${value === 1 ? "" : "s"}`}
              />
              <p className="mt-2 text-xs text-slate-500 tabular-nums">
                {sourceTotal} leads across {sourceItems.length} source
                {sourceItems.length === 1 ? "" : "s"}
              </p>
            </>
          )}
        </Card>

        <Card title="How readiness is scored">
          {criteriaTally.isLoading ? (
            <SkeletonBars />
          ) : leadsScored < MIN_LEADS_FOR_CHARTS ? (
            <EmptyPanel>
              {leadsScored === 0
                ? "No leads have been qualified yet. Score one from its detail page and the pattern starts here."
                : `Only ${leadsScored} lead${leadsScored === 1 ? "" : "s"} scored so far — too few to read a pattern from. This fills in at ${MIN_LEADS_FOR_CHARTS}.`}
            </EmptyPanel>
          ) : (
            <>
              <BarChart
                categories={tallyItems.map((item) => item.label)}
                series={[
                  {
                    label: "Average score out of 5",
                    colorClass: "fill-methanova-gold",
                    values: tallyItems.map((item) => item.averageScore),
                  },
                ]}
                formatValue={(value) => value.toFixed(1)}
              />
              {/* The averages exclude "not assessed", exactly as the score
                  itself does, so the counts have to be visible — an average
                  over two leads is not the same claim as one over twenty. */}
              <ul className="mt-2 space-y-1">
                {tallyItems.map((item) => (
                  <li key={item.criterionKey} className="flex justify-between gap-3 text-xs text-slate-500">
                    <span>{item.label}</span>
                    <span className="tabular-nums">
                      {item.assessedCount} of {leadsScored} assessed
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>
      </details>

      {/* The same modal the detail workspace uses — logging a first response
          from the inbox must behave identically to logging it from the lead. */}
      <LogActivityModal
        open={logTarget !== null}
        leadId={logTarget?.id}
        leadLabel={logTarget ? `${logTarget.leadCode} · ${logTarget.companyName}` : undefined}
        onClose={() => setLogTarget(null)}
      />

      <ConfirmDialog
        open={lostTarget !== null}
        title="Mark this lead lost?"
        confirmLabel="Mark lost"
        isPending={transition.isPending}
        error={lostError}
        onConfirm={() => void confirmLostMove()}
        onCancel={() => {
          setLostTarget(null);
          setLostError(null);
        }}
      >
        <p className="text-sm text-slate-600">
          {lostTarget
            ? `${lostTarget.leadCode} · ${lostTarget.companyName} will leave the pipeline.`
            : null}
        </p>
        <div className="mt-3">
        <Field label="Reason" htmlFor="inbox-lost-reason" required>
          <textarea
            id="inbox-lost-reason"
            rows={3}
            value={lostReason}
            onChange={(event) => setLostReason(event.target.value)}
          />
        </Field>
        </div>
      </ConfirmDialog>

      <AddLeadWizard
        open={wizardOpen}
        onClose={() => {
          setWizardOpen(false);
          addButtonRef.current?.focus();
        }}
        onCreated={(lead) => {
          setWizardOpen(false);
          addButtonRef.current?.focus();
          setHighlightId(lead._id);
          window.setTimeout(() => setHighlightId(null), 4000);
          toast({
            message: `Lead ${lead.leadCode} created`,
            action: { label: "View", onClick: () => navigate(`/app/crm/leads/${lead._id}`) },
          });
        }}
      />
    </div>
  );
}

/**
 * The empty state for a panel that has real data but not enough of it. It says
 * what is missing and at what point the chart appears, rather than rendering
 * a plausible-looking shape from three data points — DESIGN_SYSTEM §6's rule
 * against fabricated data covers "technically true but statistically
 * meaningless" as much as it covers invented numbers.
 */
function EmptyPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[180px] items-center justify-center rounded-lg border border-dashed border-slate-200 px-6 py-8">
      <p className="max-w-sm text-center text-sm text-slate-500">{children}</p>
    </div>
  );
}
