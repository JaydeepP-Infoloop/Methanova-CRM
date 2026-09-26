import { AccessLevel, AppModule, canAccess } from "@methanova/shared-types";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../../../app/providers";
import { Button } from "../../../components/Button";
import { FilterBar, filterRows } from "../../../components/FilterBar";
import { PageHeader } from "../../../components/PagePrimitives";
import { RefCell } from "../../../components/RefCell";
import { ResourceTable, type ResourceColumn } from "../../../components/ResourceTable";
import { emptyStateMessage } from "../../../lib/emptyState";
import { formatDate } from "../../../lib/formatters";
import { progressUpdatesApi } from "../api/progress-updates.api";
import { workPackagesApi } from "../api/work-packages.api";
import { LogProgressModal } from "../components/LogProgressModal";
import type { ProgressUpdateRow } from "../types";

type ProgressUpdateListRow = ProgressUpdateRow & { workPackageLabel: string };

/** Inline — a single consumer, so a shared component would be premature abstraction. */
function ProgressBar({ percent }: { percent: number }) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
        <div
          className="h-full rounded-full bg-methanova-green"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="w-10 shrink-0 tabular-nums text-xs text-slate-600">{clamped}%</span>
    </div>
  );
}

const columns: ResourceColumn<ProgressUpdateListRow>[] = [
  {
    key: "workPackageLabel",
    label: "Work package",
    sortable: true,
    // /app/schedule/work-packages/:id is not a route yet (list-only today —
    // see app/router.tsx), so this resolves a name where one is known but is
    // never a link, same condition as the Project reference on ProjectPage.
    render: (row) => <RefCell id={row.workPackageId} name={row.workPackageLabel || undefined} />,
  },
  {
    key: "percentComplete",
    label: "Progress",
    sortable: true,
    render: (row) => <ProgressBar percent={row.percentComplete} />,
  },
  { key: "notes", label: "Note", render: (row) => row.notes || "—" },
  { key: "at", label: "When", sortable: true, render: (row) => formatDate(row.at) },
];

export function ProgressUpdatePage() {
  const { user } = useAuth();
  const canWrite = Boolean(user && canAccess(user.role, AppModule.schedule, AccessLevel.WRITE));
  const { data, isLoading, error } = progressUpdatesApi.useList();
  const workPackages = workPackagesApi.useList();
  const [search, setSearch] = useState("");
  const [logOpen, setLogOpen] = useState(false);

  const workPackageLabels = new Map((workPackages.data ?? []).map((wp) => [wp._id, wp.name]));

  const resolved: ProgressUpdateListRow[] = (data ?? []).map((row) => ({
    ...row,
    workPackageLabel: workPackageLabels.get(row.workPackageId) ?? "",
  }));

  const rows = filterRows(resolved, search, ["workPackageLabel", "notes"]);

  return (
    <div>
      <PageHeader
        title="Progress Updates"
        subtitle="Percent-complete entries logged against each work package."
      >
        {canWrite && (
          <Button onClick={() => setLogOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New progress update
          </Button>
        )}
      </PageHeader>
      <LogProgressModal open={logOpen} onClose={() => setLogOpen(false)} />
      <FilterBar search={search} onSearchChange={setSearch} placeholder="Search by work package or note…" />
      <ResourceTable
        rows={rows}
        columns={columns}
        isLoading={isLoading}
        error={error as Error | null}
        emptyHint={
          search
            ? emptyStateMessage({ entityLabel: "progress updates", hasSearch: true })
            : { message: "No progress updates yet. One appears here each time a work package's completion is recorded." }
        }
      />
    </div>
  );
}
