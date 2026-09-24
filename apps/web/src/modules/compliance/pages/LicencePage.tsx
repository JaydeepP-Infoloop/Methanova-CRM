import { LICENCE_STATUS_ORDER } from "@methanova/shared-types";
import { useState } from "react";
import { FilterBar, filterRows } from "../../../components/FilterBar";
import { KanbanBoard } from "../../../components/KanbanBoard";
import { PageHeader } from "../../../components/PagePrimitives";
import { ResourceTable, type ResourceColumn } from "../../../components/ResourceTable";
import { StatusPill } from "../../../components/StatusPill";
import { ViewToggle, type ListView } from "../../../components/ViewToggle";
import { emptyStateMessage } from "../../../lib/emptyState";
import { licencesApi } from "../api/licences.api";
import { LicenceStatusBadge } from "../components/LicenceStatusBadge";
import type { LicenceRow } from "../types";

const columns: ResourceColumn<LicenceRow>[] = [
  { key: "bundle", label: "Bundle", sortable: true, render: (row) => <StatusPill value={row.bundle} /> },
  { key: "authority", label: "Authority", sortable: true },
  { key: "projectId", label: "Project" },
  {
    key: "queries",
    label: "Open queries",
    align: "right",
    sortValue: (row) => row.queries?.length ?? 0,
    render: (row) => String(row.queries?.length ?? 0),
  },
  {
    key: "visits",
    label: "Authority visits",
    align: "right",
    sortValue: (row) => row.visits?.length ?? 0,
    render: (row) => String(row.visits?.length ?? 0),
  },
  {
    key: "status",
    label: "Status",
    sortable: true,
    render: (row) => <LicenceStatusBadge status={row.status} />,
  },
];

export function LicencePage() {
  const { data, isLoading, error } = licencesApi.useList();
  const transition = licencesApi.useTransition();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ListView>("table");

  const rows = filterRows(data ?? [], search, ["bundle", "authority", "status"]);

  // The true-empty case keeps its own copy — nothing appears here until an
  // MOU spins a project up, which "No licences yet." doesn't explain — while
  // a search miss gets the shared, consistent wording.
  const emptyHint = search
    ? emptyStateMessage({ entityLabel: "licences", hasSearch: true })
    : { message: "Licences appear once an MOU is signed." };

  return (
    <div>
      <PageHeader
        title="Licences & NOCs"
        subtitle="Pre-CTE, CTE and CTO bundles across every active project."
      />
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        placeholder="Search by bundle, authority or status…"
      >
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
          entity="licence"
          columns={[...LICENCE_STATUS_ORDER]}
          cards={rows.map((row) => ({ ...row, id: row._id }))}
          isLoading={isLoading}
          emptyHint={emptyHint.message}
          onMove={(card, to) => transition.mutateAsync({ id: card.id, to })}
          renderCard={(card) => (
            <>
              <div className="flex items-center justify-between gap-2">
                <StatusPill value={card.bundle} />
                <span className="text-xs text-slate-500">{card.authority}</span>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {card.queries?.length ?? 0} queries · {card.visits?.length ?? 0} visits
              </p>
            </>
          )}
        />
      )}
    </div>
  );
}
