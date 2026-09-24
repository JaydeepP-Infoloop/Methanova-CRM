import { LICENCE_STATUS_ORDER, nextStates } from "@methanova/shared-types";
import { useState } from "react";
import { Button } from "../../../components/Button";
import { FilterBar, filterRows } from "../../../components/FilterBar";
import { KanbanBoard } from "../../../components/KanbanBoard";
import { PageHeader } from "../../../components/PagePrimitives";
import { ResourceTable, type ResourceColumn } from "../../../components/ResourceTable";
import { StatusPill } from "../../../components/StatusPill";
import { useToast } from "../../../components/Toast";
import { ViewToggle, type ListView } from "../../../components/ViewToggle";
import { ApiError } from "../../../lib/apiClient";
import { emptyStateMessage } from "../../../lib/emptyState";
import { formatDate } from "../../../lib/formatters";
import { licencesApi, useTransitionLicence } from "../api/licences.api";
import { GrantLicenceModal } from "../components/GrantLicenceModal";
import { LicenceStatusBadge } from "../components/LicenceStatusBadge";
import type { LicenceRow } from "../types";

export function LicencePage() {
  const { data, isLoading, error } = licencesApi.useList();
  const transition = useTransitionLicence();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ListView>("table");
  const [actionError, setActionError] = useState<string | null>(null);
  const [grantTarget, setGrantTarget] = useState<LicenceRow | null>(null);

  const rows = filterRows(data ?? [], search, ["bundle", "authority", "status"]);

  // The true-empty case keeps its own copy — nothing appears here until an
  // MOU spins a project up, which "No licences yet." doesn't explain — while
  // a search miss gets the shared, consistent wording.
  const emptyHint = search
    ? emptyStateMessage({ entityLabel: "licences", hasSearch: true })
    : { message: "Licences appear once an MOU is signed." };

  /**
   * GRANTED is the one transition that needs a value alongside it (see
   * `licences.validation.ts`) — it opens the modal instead of transitioning
   * immediately. Every other move, from either the table's buttons or a
   * kanban drag, goes straight through.
   */
  async function move(row: LicenceRow, to: string) {
    if (to === "GRANTED") {
      setGrantTarget(row);
      return;
    }
    setActionError(null);
    try {
      await transition.mutateAsync({ id: row._id, to });
      toast({ message: `Moved to ${to.replace(/_/g, " ")}` });
    } catch (caught) {
      setActionError(caught instanceof ApiError ? caught.message : "Could not move that licence");
    }
  }

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
      key: "targetDate",
      label: "Target date",
      sortable: true,
      render: (row) => (row.targetDate ? formatDate(row.targetDate) : "—"),
    },
    {
      key: "validUntil",
      label: "Valid until",
      sortable: true,
      render: (row) => (row.validUntil ? formatDate(row.validUntil) : "—"),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (row) => <LicenceStatusBadge status={row.status} />,
    },
    {
      key: "transitions",
      label: "",
      align: "right",
      render: (row) => {
        const targets = nextStates("licence", row.status);
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
      <PageHeader
        title="Licences & NOCs"
        subtitle="Pre-CTE, CTE and CTO bundles across every active project."
      />
      {actionError && (
        <p role="alert" className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-600/20">
          {actionError}
        </p>
      )}
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
          onMove={(card, to) => move(card as unknown as LicenceRow, to)}
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

      <GrantLicenceModal
        open={Boolean(grantTarget)}
        licenceId={grantTarget?._id}
        licenceLabel={grantTarget ? `${grantTarget.bundle.replace(/_/g, " ")} · ${grantTarget.authority}` : ""}
        onClose={() => setGrantTarget(null)}
      />
    </div>
  );
}
