import { WORK_PACKAGE_STATUS_ORDER } from "@methanova/shared-types";
import { useState } from "react";
import { FilterBar, filterRows } from "../../../components/FilterBar";
import { KanbanBoard } from "../../../components/KanbanBoard";
import { PageHeader } from "../../../components/PagePrimitives";
import { ResourceTable, type ResourceColumn } from "../../../components/ResourceTable";
import { ViewToggle, type ListView } from "../../../components/ViewToggle";
import { emptyStateMessage } from "../../../lib/emptyState";
import { formatDate, formatPaise } from "../../../lib/formatters";
import { workPackagesApi } from "../api/work-packages.api";
import { WorkPackageStatusBadge } from "../components/WorkPackageStatusBadge";
import type { WorkPackageRow } from "../types";

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
];

export function WorkPackagePage() {
  const { data, isLoading, error } = workPackagesApi.useList();
  const transition = workPackagesApi.useTransition();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ListView>("table");

  const rows = filterRows(data ?? [], search, ["name", "status"]);
  const emptyHint = emptyStateMessage({ entityLabel: "work packages", hasSearch: Boolean(search) });

  return (
    <div>
      <PageHeader title="Work Packages" subtitle="The implementation schedule, in delivery order." />
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
          onMove={(card, to) => transition.mutateAsync({ id: card.id, to })}
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
    </div>
  );
}
