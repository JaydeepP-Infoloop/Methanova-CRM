import {
  ACTIVITY_OUTCOME_CATEGORY_LABELS,
  ACTIVITY_TYPE_ORDER,
  ActivityParentType,
  type ActivityListItemDto,
} from "@methanova/shared-types";
import { CalendarCheck, ListTree, Mail, MapPin, Phone } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../../../app/providers";
import { ActivityRail, type ActivityRailItem } from "../../../components/ActivityRail";
import { Button } from "../../../components/Button";
import { FilterBar, filterRows } from "../../../components/FilterBar";
import { PageHeader } from "../../../components/PagePrimitives";
import { RefCell } from "../../../components/RefCell";
import { ResourceTable, type ResourceColumn } from "../../../components/ResourceTable";
import { SegmentedFilter } from "../../../components/SegmentedFilter";
import { StatCard } from "../../../components/StatCard";
import { StatusPill, type StatusTone } from "../../../components/StatusPill";
import { ViewToggle, type ListView } from "../../../components/ViewToggle";
import { emptyStateMessage } from "../../../lib/emptyState";
import { formatDate } from "../../../lib/formatters";
import { useActivityList, type ActivityListFilters } from "../api/activities.api";

const PAGE_SIZE = 25;
const DAY_MS = 24 * 60 * 60 * 1000;
const VISIT_TYPES = ["PLANT_VISIT", "SITE_VISIT"];

/**
 * The one dominant, mutually-exclusive cut through the log — who logged it,
 * when, and the "went and looked at something" slice sales leadership asks
 * for most often. Type and date-range in FilterBar stay independent of this:
 * picking a specific type there simply overrides "Visits only" here, since a
 * more specific choice should win over a preset rather than AND against it.
 */
type Segment = "all" | "mine" | "thisWeek" | "visits";

const FOLLOW_UP_TONE: Record<"PENDING" | "KEPT" | "BROKEN", StatusTone> = {
  PENDING: "waiting",
  KEPT: "positive",
  BROKEN: "problem",
};

function toRailItem(row: ActivityListItemDto): ActivityRailItem {
  return {
    id: row.id,
    sequenceNo: row.sequenceNo,
    type: row.type,
    occurredAt: row.occurredAt,
    summary: row.summary,
    outcomeCategory: row.outcomeCategory,
    outcome: row.outcome,
    externalContactNames: row.externalContactNames,
    internalParticipants: row.internalParticipants,
    nextFollowUpDate: row.nextFollowUpDate,
    nextFollowUpAction: row.nextFollowUpAction,
    followUpOutcome: row.followUpOutcome,
    loggedByUserName: row.loggedByUserName,
    leadId: row.parentType === ActivityParentType.LEAD ? row.parentId : null,
    leadCode: row.leadCode,
    companyName: row.companyName,
  };
}

export function ActivityPage() {
  const { user } = useAuth();
  const [view, setView] = useState<ListView>("kanban");
  const [segment, setSegment] = useState<Segment>("all");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const sevenDaysAgoIso = new Date(Date.now() - 7 * DAY_MS).toISOString().slice(0, 10);

  const filters: ActivityListFilters = {
    page,
    pageSize: PAGE_SIZE,
    // FilterBar's own type select is the more specific choice, so it wins
    // over the segment's "Visits only" preset when both are set.
    type: type ? [type] : segment === "visits" ? VISIT_TYPES : undefined,
    loggedByUserId: segment === "mine" ? user?.id : undefined,
    dateFrom: dateFrom || (segment === "thisWeek" ? sevenDaysAgoIso : undefined),
    dateTo: dateTo || undefined,
  };

  const list = useActivityList(filters);
  const items = list.data?.items ?? [];
  const total = list.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const summary = list.data?.summary;

  // The search box only narrows what's already on this page — the backend
  // list has no free-text index, and a "search" that silently only checks
  // the current page while claiming to search everything would be worse
  // than not offering one, so the placeholder says exactly what it does.
  const visibleItems = filterRows(
    items as unknown as (ActivityListItemDto & Record<string, unknown>)[],
    search,
    ["summary", "outcome", "companyName", "leadCode"],
  );

  const hasSearch = Boolean(search);
  const hasFilters = Boolean(type || dateFrom || dateTo || segment !== "all");
  const anyFilterActive = hasSearch || hasFilters;

  // The true-empty case keeps its own richer copy (why this page is empty
  // and where activities come from) rather than the generic helper's
  // template — the search/filter-miss cases below it don't need that, they
  // just need to say clearly which of the two (or both) came up empty,
  // which is exactly what previously collapsed into one message regardless
  // of which was actually active.
  const emptyHint = anyFilterActive
    ? emptyStateMessage({ entityLabel: "activities", hasSearch, hasFilters })
    : { message: "Nothing logged yet — calls, visits and emails appear here as the team records them against a lead." };

  const stat = (value: number | undefined) => (value === undefined ? "—" : String(value));

  const columns: ResourceColumn<ActivityListItemDto & Record<string, unknown>>[] = [
    {
      key: "companyName",
      label: "Lead",
      render: (row) =>
        row.parentType === ActivityParentType.LEAD ? (
          <div>
            <RefCell
              id={row.parentId}
              name={row.companyName ?? undefined}
              secondary={row.leadCode ?? undefined}
              to={`/app/crm/leads/${row.parentId}`}
            />
            <p className="mt-0.5 text-xs text-slate-400">follow-up {row.sequenceNo}</p>
          </div>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    { key: "type", label: "Type", render: (row) => <StatusPill value={row.type} tone="neutral" /> },
    { key: "occurredAt", label: "When", sortable: true, render: (row) => formatDate(row.occurredAt) },
    { key: "loggedByUserName", label: "Logged by", render: (row) => row.loggedByUserName ?? "—" },
    { key: "summary", label: "Summary" },
    {
      key: "outcome",
      label: "Outcome",
      render: (row) =>
        row.outcomeCategory ? (
          <span>
            {ACTIVITY_OUTCOME_CATEGORY_LABELS[row.outcomeCategory]}
            {row.outcome ? ` — ${row.outcome}` : ""}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      key: "nextFollowUpDate",
      label: "Follow-up",
      render: (row) =>
        row.nextFollowUpDate ? (
          <div>
            <p className="tabular-nums text-xs text-slate-600">{formatDate(row.nextFollowUpDate)}</p>
            {row.followUpOutcome && (
              <StatusPill value={row.followUpOutcome} tone={FOLLOW_UP_TONE[row.followUpOutcome]} />
            )}
          </div>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Activity Log"
        subtitle="Every logged call, visit and email across the pipeline, newest first."
      >
        <ViewToggle view={view} onChange={setView} secondLabel="Timeline" secondIcon={ListTree} />
      </PageHeader>

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard icon={CalendarCheck} label="Logged this week" value={stat(summary?.loggedThisWeek)} />
        <StatCard icon={Phone} label="Calls" value={stat(summary?.calls)} />
        <StatCard icon={MapPin} label="Visits" value={stat(summary?.visits)} />
        <StatCard icon={Mail} label="Emails" value={stat(summary?.emails)} />
        <StatCard
          icon={CalendarCheck}
          label="Promises overdue"
          value={stat(summary?.promisesOverdue)}
          delta={
            summary && summary.followUpsCommitted > 0
              ? { value: `${summary.followUpsCommitted} committed`, direction: "up", intent: "neutral" }
              : undefined
          }
        />
      </div>

      <div className="mb-4">
        <SegmentedFilter<Segment>
          label="Filter the log"
          value={segment}
          onChange={(value) => {
            setSegment(value);
            setPage(1);
          }}
          options={[
            { value: "all", label: "Everything" },
            { value: "mine", label: "Mine" },
            { value: "thisWeek", label: "This week" },
            { value: "visits", label: "Visits only" },
          ]}
        />
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        placeholder="Search this page by lead, summary or outcome…"
      >
        <select
          aria-label="Filter by type"
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold"
          value={type}
          onChange={(event) => {
            setType(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All types</option>
          {ACTIVITY_TYPE_ORDER.map((value) => (
            <option key={value} value={value}>
              {value.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <input
          type="date"
          aria-label="From date"
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold"
          value={dateFrom}
          onChange={(event) => {
            setDateFrom(event.target.value);
            setPage(1);
          }}
        />
        <input
          type="date"
          aria-label="To date"
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold"
          value={dateTo}
          onChange={(event) => {
            setDateTo(event.target.value);
            setPage(1);
          }}
        />
      </FilterBar>

      {view === "table" ? (
        <ResourceTable
          rows={visibleItems}
          columns={columns}
          isLoading={list.isLoading}
          error={list.error as Error | null}
          emptyHint={emptyHint}
        />
      ) : (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200/70">
          {list.error ? (
            <p className="px-5 py-10 text-center text-sm text-rose-600">{(list.error as Error).message}</p>
          ) : (
            <ActivityRail
              isLoading={list.isLoading}
              items={visibleItems.map(toRailItem)}
              showLead
              emptyState={
                <div className="px-5 py-10 text-center">
                  <p className="text-sm font-medium text-slate-900">{emptyHint.message}</p>
                </div>
              }
            />
          )}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
          <p className="tabular-nums">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
              Previous
            </Button>
            <span className="tabular-nums">
              Page {page} of {totalPages}
            </span>
            <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
