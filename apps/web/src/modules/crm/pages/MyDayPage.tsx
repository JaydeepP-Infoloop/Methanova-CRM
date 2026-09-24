import { AccessLevel, AppModule, canAccess, type MyDayBucketDto, type MyDayRowDto } from "@methanova/shared-types";
import { AlertTriangle, CalendarCheck, CalendarDays, CheckCircle2, Inbox } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../app/providers";
import { Card } from "../../../components/Card";
import { Button } from "../../../components/Button";
import { PageHeader } from "../../../components/PagePrimitives";
import { RefCell } from "../../../components/RefCell";
import { ResourceTable, type ResourceColumn } from "../../../components/ResourceTable";
import { SegmentedFilter } from "../../../components/SegmentedFilter";
import { Skeleton } from "../../../components/Skeleton";
import { StatCard } from "../../../components/StatCard";
import { StatusPill } from "../../../components/StatusPill";
import { emptyStateMessage } from "../../../lib/emptyState";
import { formatDate, formatPaise, formatPaiseAsCrore } from "../../../lib/formatters";
import { LogActivityModal } from "../components/LogActivityModal";
import { LeadStageBadge } from "../components/LeadStageBadge";
import { useMyDay } from "../api/my-day.api";

type BucketVariant = "overdue" | "today" | "thisWeek";

type Row = MyDayRowDto & Record<string, unknown>;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The date always shows — a bare "2d late" without the actual date makes
 * someone do the arithmetic backwards to know what they missed. `formatDate`
 * (not a new date format) supplies the date half; the status half is the one
 * thing that differs by bucket, since "how late" and "how soon" are read off
 * different clocks.
 */
function DueChip({ row, variant }: { row: MyDayRowDto; variant: BucketVariant }) {
  const date = formatDate(row.dueDate);
  if (variant === "overdue") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-600/20">
        <span className="tabular-nums">{date}</span>
        <span aria-hidden="true">·</span>
        {row.daysLate}d late
      </span>
    );
  }
  if (variant === "today") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
        <span className="tabular-nums">{date}</span>
        <span aria-hidden="true">·</span>
        Today
      </span>
    );
  }
  // Server-side `daysLate` only answers "how overdue" (it floors at 0 for
  // anything not yet due), so "how soon" for the This week bucket is worked
  // out here from the same `dueDate` the chip already displays.
  const daysUntil = Math.max(0, Math.ceil((new Date(row.dueDate).getTime() - Date.now()) / DAY_MS));
  return (
    <span className="inline-flex items-center gap-1 text-xs tabular-nums text-slate-500">
      {date} · in {daysUntil}d
    </span>
  );
}

const SOURCE_LABEL: Record<MyDayRowDto["source"], string> = {
  NEXT_ACTION: "Follow-up",
  PARKED_REVISIT: "Parked revisit",
  REENGAGE: "Re-engage",
};

/**
 * One bucket's own table. Kept as a plain `ResourceTable` rather than a
 * bespoke card list — these rows are exactly tabular data, and reusing it
 * gets the shared empty/loading/hover chrome for free instead of a second
 * hand-rolled version of it.
 */
function BucketSection({
  title,
  bucket,
  variant,
  onLogFollowUp,
}: {
  title: string;
  bucket: MyDayBucketDto;
  variant: BucketVariant;
  onLogFollowUp: (row: MyDayRowDto) => void;
}) {
  const navigate = useNavigate();

  const columns: ResourceColumn<Row>[] = [
    { key: "dueDate", label: "Due", render: (row) => <DueChip row={row} variant={variant} /> },
    {
      key: "companyName",
      label: "Lead",
      render: (row) => (
        <div>
          <RefCell id={row.leadId} name={row.companyName} secondary={row.leadCode} to={`/app/crm/leads/${row.leadId}`} />
          {row.source !== "NEXT_ACTION" && (
            <p className="mt-0.5 text-xs text-slate-400">{SOURCE_LABEL[row.source]}</p>
          )}
        </div>
      ),
    },
    { key: "temperature", label: "Temp", render: (row) => <StatusPill value={row.temperature} /> },
    {
      key: "followUpsDoneCount",
      label: "Follow-ups",
      render: (row) => (
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
          {row.followUpsDoneCount === 0 ? "No follow-ups yet" : `Follow-up ${row.followUpsDoneCount} done`}
        </span>
      ),
    },
    { key: "stage", label: "Stage", render: (row) => <LeadStageBadge stage={row.stage} /> },
    {
      key: "indicativeValuePaise",
      label: "Value",
      align: "right",
      render: (row) =>
        row.indicativeValuePaise === null ? (
          <span className="text-slate-400">—</span>
        ) : (
          <span className="tabular-nums">{formatPaise(row.indicativeValuePaise)}</span>
        ),
    },
    {
      key: "commitmentText",
      label: "Commitment",
      render: (row) => (
        <div>
          <p className="text-sm text-slate-700">{row.commitmentText || "—"}</p>
          {row.provenance && (
            <p className="mt-0.5 text-xs text-slate-400">
              Promised at follow-up {row.provenance.sequenceNo} on {formatDate(row.provenance.promisedAt)}
              {row.provenance.promisedByUserName ? ` · ${row.provenance.promisedByUserName}` : ""}
            </p>
          )}
        </div>
      ),
    },
  ];

  return (
    <Card
      title={title}
      action={
        <span className="text-xs text-slate-500">
          {bucket.count} lead{bucket.count === 1 ? "" : "s"} · {formatPaiseAsCrore(bucket.valueTotalPaise)}
        </span>
      }
      bodyPadding={false}
    >
      <ResourceTable
        rows={bucket.items.map((row) => ({ ...row, _id: row.leadId }))}
        columns={columns}
        emptyHint={emptyStateMessage({ entityLabel: "follow-ups" })}
        onRowClick={(row) => navigate(`/app/crm/leads/${row.leadId as string}`)}
        rowActions={(row) => (
          <>
            <Button size="sm" variant="ghost" onClick={() => onLogFollowUp(row)}>
              Log follow-up {row.followUpsDoneCount + 1}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => navigate(`/app/crm/leads/${row.leadId}`)}>
              Open
            </Button>
          </>
        )}
      />
    </Card>
  );
}

export function MyDayPage() {
  const { user } = useAuth();
  const [scope, setScope] = useState<"mine" | "team">("mine");
  const [logTarget, setLogTarget] = useState<MyDayRowDto | null>(null);

  const canSeeTeam = Boolean(user && canAccess(user.role, AppModule.crm, AccessLevel.FULL));
  const { data, isLoading, error } = useMyDay(scope);

  const stat = (value: number | undefined) => (value === undefined ? "—" : String(value));
  const totalDue = data ? data.overdue.count + data.today.count + data.thisWeek.count : undefined;

  return (
    <div>
      <PageHeader
        title="My Day"
        subtitle="What's owed, ordered by how late it already is — not a record of what's already happened."
      >
        {canSeeTeam && (
          <SegmentedFilter<"mine" | "team">
            label="Whose queue"
            value={scope}
            onChange={setScope}
            options={[
              { value: "mine", label: "My queue" },
              { value: "team", label: "Team queue" },
            ]}
          />
        )}
      </PageHeader>

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard icon={AlertTriangle} label="Overdue follow-ups" value={stat(data?.summary.overdueFollowUps)} />
        <StatCard icon={CalendarCheck} label="Due today" value={stat(data?.summary.dueToday)} />
        <StatCard icon={CalendarDays} label="Rest of this week" value={stat(data?.summary.restOfWeek)} />
        <StatCard icon={Inbox} label="Inbox needing action" value={stat(data?.summary.inboxNeedingAction)} />
        <StatCard icon={CheckCircle2} label="Completed today" value={stat(data?.summary.completedToday)} />
      </div>

      {error ? (
        <p className="rounded-xl bg-white p-6 text-sm text-rose-600 shadow-sm ring-1 ring-slate-200/70">
          {(error as Error).message}
        </p>
      ) : isLoading ? (
        <div className="space-y-4">
          {[0, 1].map((index) => (
            <div key={index} className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200/70">
              <div className="flex items-center justify-between px-5 py-4">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3 w-24" />
              </div>
              <div className="space-y-3 px-5 pb-5">
                {[0, 1].map((rowIndex) => (
                  <Skeleton key={rowIndex} className="h-10 w-full" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : totalDue === 0 ? (
        // Nothing owed is a real, good state — DESIGN_SYSTEM §6 says as much
        // plainly rather than rendering three empty-looking tables that read
        // like something failed to load.
        <div className="rounded-xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200/70">
          <p className="text-sm font-medium text-slate-900">Nothing owed right now</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
            {scope === "team" ? "No one on the team" : "You"} have no overdue, due-today or due-this-week
            follow-ups, parked revisits or re-engagements queued up.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {data && data.overdue.count > 0 && (
            <BucketSection title="Overdue" bucket={data.overdue} variant="overdue" onLogFollowUp={setLogTarget} />
          )}
          {data && data.today.count > 0 && (
            <BucketSection title="Today" bucket={data.today} variant="today" onLogFollowUp={setLogTarget} />
          )}
          {data && data.thisWeek.count > 0 && (
            <BucketSection title="This week" bucket={data.thisWeek} variant="thisWeek" onLogFollowUp={setLogTarget} />
          )}
        </div>
      )}

      <LogActivityModal
        open={logTarget !== null}
        leadId={logTarget?.leadId}
        leadLabel={logTarget ? `${logTarget.leadCode} · ${logTarget.companyName}` : undefined}
        onClose={() => setLogTarget(null)}
      />
    </div>
  );
}
