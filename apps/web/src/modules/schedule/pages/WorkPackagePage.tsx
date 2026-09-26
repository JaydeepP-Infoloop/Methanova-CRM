import { nextStates, WORK_PACKAGE_STATUS_ORDER } from "@methanova/shared-types";
import { useState } from "react";
import { Button } from "../../../components/Button";
import { FilterBar, filterRows } from "../../../components/FilterBar";
import { KanbanBoard } from "../../../components/KanbanBoard";
import { PageHeader } from "../../../components/PagePrimitives";
import { ResourceTable, type ResourceColumn } from "../../../components/ResourceTable";
import { StatusPill } from "../../../components/StatusPill";
import { useToast } from "../../../components/Toast";
import { UrlFilterNotice } from "../../../components/UrlFilterNotice";
import { ViewToggle, type ListView } from "../../../components/ViewToggle";
import { ApiError } from "../../../lib/apiClient";
import { emptyStateMessage } from "../../../lib/emptyState";
import { formatDate, formatPaise } from "../../../lib/formatters";
import { useUrlFilters } from "../../../lib/useUrlFilters";
import { useTransitionWorkPackage, workPackagesApi } from "../api/work-packages.api";
import { WorkPackageStatusBadge } from "../components/WorkPackageStatusBadge";
import { DelayWorkPackageModal } from "../components/DelayWorkPackageModal";
import type { WorkPackageRow } from "../types";

export function WorkPackagePage() {
  const url = useUrlFilters(["projectId", "delayed", "dueThisWeek", "mine", "status", "id", "openProjects"] as const);
  const { data, isLoading, error } = workPackagesApi.useList(url.filters);
  const transition = useTransitionWorkPackage();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ListView>("table");
  const [actionError, setActionError] = useState<string | null>(null);
  const [holdTarget, setHoldTarget] = useState<WorkPackageRow | null>(null);

  const rows = filterRows(data ?? [], search, ["name", "status"]);
  const emptyHint =
    url.active && !search
      ? { message: "No work packages match this filter." }
      : emptyStateMessage({ entityLabel: "work packages", hasSearch: Boolean(search) });
  const filterLabels = [
    ...(url.filters.delayed ? ["Delayed only"] : []),
    ...(url.filters.dueThisWeek ? ["Due in the next 7 days, not yet late"] : []),
    ...(url.filters.mine ? ["My projects"] : []),
    ...(url.filters.status ? [`Status ${url.filters.status.replace(/_/g, " ")}`] : []),
    ...(url.filters.id ? ["One work package"] : []),
    ...(url.filters.openProjects ? ["Open projects only"] : []),
  ];

  /**
   * ON_HOLD is the one transition that needs a value alongside it (see
   * `work-packages.validation.ts`) — it opens the modal instead of
   * transitioning immediately. Every other move, from either the table's
   * buttons or a kanban drag, goes straight through.
   */
  async function move(row: WorkPackageRow, to: string) {
    if (to === "ON_HOLD") {
      setHoldTarget(row);
      return;
    }
    setActionError(null);
    try {
      await transition.mutateAsync({ id: row._id, to });
      toast({ message: `Moved to ${to.replace(/_/g, " ")}` });
    } catch (caught) {
      setActionError(caught instanceof ApiError ? caught.message : "Could not move that work package");
    }
  }

  const columns: ResourceColumn<WorkPackageRow>[] = [
    { key: "sequence", label: "Seq", align: "right", sortable: true },
    { key: "name", label: "Work package", sortable: true },
    {
      key: "plannedEnd",
      label: "Planned end",
      sortable: true,
      render: (row) => (row.plannedEnd ? formatDate(row.plannedEnd) : "—"),
    },
    {
      key: "percentComplete",
      label: "Complete",
      align: "right",
      sortable: true,
      render: (row) => `${row.percentComplete ?? 0}%`,
    },
    {
      key: "daysDelayed",
      label: "Delay",
      align: "right",
      sortable: true,
      render: (row) => (row.isDelayed ? <StatusPill value={`${row.daysDelayed}d late`} tone="problem" /> : "—"),
    },
    {
      key: "actualEnd",
      label: "Actual end",
      sortable: true,
      render: (row) => (row.actualEnd ? formatDate(row.actualEnd) : "—"),
    },
    {
      key: "amountPaise",
      label: "Amount",
      align: "right",
      sortable: true,
      render: (row) => formatPaise(row.amountPaise),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (row) => <WorkPackageStatusBadge status={row.status} />,
    },
    {
      key: "transitions",
      label: "",
      align: "right",
      render: (row) => {
        const targets = nextStates("workPackage", row.status);
        if (targets.length === 0) return null;
        return (
          <div className="flex flex-wrap justify-end gap-1.5" onClick={(event) => event.stopPropagation()}>
            {targets.map((target) => (
              <Button key={target} size="sm" onClick={() => void move(row, target)}>
                {target.replace(/_/g, " ")}
              </Button>
            ))}
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader title="Work Packages" subtitle="The implementation schedule, in delivery order." />
      {actionError && (
        <p role="alert" className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-600/20">
          {actionError}
        </p>
      )}
      {url.active && (
        <UrlFilterNotice labels={filterLabels} projectId={url.filters.projectId} onClear={url.clear} />
      )}
      <FilterBar search={search} onSearchChange={setSearch} placeholder="Search work packages…">
        <ViewToggle view={view} onChange={setView} />
      </FilterBar>

      {view === "table" ? (
        <ResourceTable
          rows={rows}
          columns={columns}
          isLoading={isLoading}
          error={error as Error | null}
          emptyHint={emptyHint}
        />
      ) : (
        <KanbanBoard
          entity="workPackage"
          columns={[...WORK_PACKAGE_STATUS_ORDER]}
          cards={rows.map((row) => ({ ...row, id: row._id }))}
          isLoading={isLoading}
          emptyHint={emptyHint.message}
          onMove={(card, to) => move(card as unknown as WorkPackageRow, to)}
          renderCard={(card) => (
            <>
              <p className="text-sm font-medium text-slate-900">{card.name}</p>
              <p className="mt-1 text-xs text-slate-500">
                #{card.sequence} · {card.plannedEnd ? formatDate(card.plannedEnd) : "no end date"}
              </p>
              <p className="mt-1 text-xs tabular-nums text-slate-600">{formatPaise(card.amountPaise)}</p>
            </>
          )}
        />
      )}

      <DelayWorkPackageModal
        open={Boolean(holdTarget)}
        workPackageId={holdTarget?._id}
        workPackageLabel={holdTarget ? holdTarget.name : ""}
        onClose={() => setHoldTarget(null)}
      />
    </div>
  );
}
