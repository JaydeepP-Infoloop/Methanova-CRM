import { nextStates, QUOTATION_STATUS_ORDER } from "@methanova/shared-types";
import { GitCompare, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "../../../components/Button";
import { FilterBar, filterRows } from "../../../components/FilterBar";
import { Modal } from "../../../components/Modal";
import { PageHeader } from "../../../components/PagePrimitives";
import { RefCell } from "../../../components/RefCell";
import { ResourceTable, type ResourceColumn } from "../../../components/ResourceTable";
import { StatusPill } from "../../../components/StatusPill";
import { useToast } from "../../../components/Toast";
import { ApiError } from "../../../lib/apiClient";
import { emptyStateMessage } from "../../../lib/emptyState";
import { formatDate, formatPaise } from "../../../lib/formatters";
import { useUrlFilters } from "../../../lib/useUrlFilters";
import { CreateQuotationModal } from "../components/CreateQuotationModal";
import { useLeadLabels } from "../api/lead-lookup";
import { quotationsApi, useQuotationRevisions } from "../api/quotations.api";
import type { QuotationRow } from "../types";

/** The row plus the lead label resolved for display and search. */
type QuotationListRow = QuotationRow & { leadLabel: string; leadCode?: string };

/** Select value for `?open=1` — every non-terminal status, the same rule as the Dashboard's Open Quotations KPI. */
const OPEN_OPTION = "__open";

const FILTER_SELECT_CLASS =
  "rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold";

export function QuotationPage() {
  const url = useUrlFilters(["status", "open"] as const);
  const { data, isLoading, error } = quotationsApi.useList(url.filters);
  const statusSelectValue = url.filters.open ? OPEN_OPTION : (url.filters.status ?? "");
  const transition = quotationsApi.useTransition();
  const toast = useToast();
  const leadLabels = useLeadLabels();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [revisionTarget, setRevisionTarget] = useState<QuotationRow | null>(null);
  const [comparing, setComparing] = useState<QuotationRow | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const resolved: QuotationListRow[] = (data ?? []).map((row) => {
    const lead = leadLabels.get(row.leadId);
    return { ...row, leadLabel: lead?.companyName ?? "", leadCode: lead?.leadCode };
  });

  const rows = filterRows(resolved, search, ["leadLabel", "leadCode", "status"]);

  async function move(row: QuotationRow, to: string) {
    setActionError(null);
    try {
      await transition.mutateAsync({ id: row._id, to });
      toast({ message: `Moved to ${to.replace(/_/g, " ")}` });
    } catch (caught) {
      setActionError(caught instanceof ApiError ? caught.message : "Could not move that quotation");
    }
  }

  const columns: ResourceColumn<QuotationListRow>[] = [
    {
      key: "leadLabel",
      label: "Lead",
      sortable: true,
      render: (row) => (
        <div>
          <RefCell
            id={row.leadId}
            name={row.leadLabel || undefined}
            secondary={row.leadCode}
            to={`/app/crm/leads/${row.leadId}`}
          />
          <p className="mt-0.5 text-xs text-slate-400">revision {row.revision}</p>
        </div>
      ),
    },
    { key: "status", label: "Status", sortable: true, render: (row) => <StatusPill value={row.status} /> },
    { key: "capacityTpd", label: "Capacity", align: "right", render: (row) => `${row.capacityTpd ?? "—"} TPD` },
    {
      key: "totalPaise",
      label: "Total",
      align: "right",
      sortable: true,
      render: (row) => formatPaise(row.totalPaise),
    },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (row) => {
        const targets = nextStates("quotation", row.status).filter((t) => t !== "SUPERSEDED");
        return (
          <div className="flex flex-wrap justify-end gap-1.5" onClick={(event) => event.stopPropagation()}>
            {row.revision > 1 && (
              <button
                type="button"
                onClick={() => setComparing(row)}
                aria-label="Compare revisions"
                className="rounded-lg border border-slate-300 p-1.5 text-slate-500 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold"
              >
                <GitCompare className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
            {["DRAFT", "PENDING_APPROVAL", "APPROVED", "SENT", "UNDER_NEGOTIATION"].includes(row.status) && (
              <Button size="sm" variant="secondary" onClick={() => setRevisionTarget(row)}>
                Revise
              </Button>
            )}
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
        title="Quotations"
        subtitle="Priced proposals against each lead. Every revision is kept, not overwritten."
      >
        <Button icon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={() => setCreateOpen(true)}>
          New quotation
        </Button>
      </PageHeader>
      <FilterBar search={search} onSearchChange={setSearch} placeholder="Search by lead name, code or status…">
        <select
          aria-label="Filter by status"
          className={FILTER_SELECT_CLASS}
          value={statusSelectValue}
          onChange={(event) => {
            const value = event.target.value;
            url.replace(
              value === OPEN_OPTION ? { open: "1", status: undefined } : { status: value || undefined, open: undefined },
            );
          }}
        >
          <option value="">All statuses</option>
          <option value={OPEN_OPTION}>Open (not accepted, rejected or superseded)</option>
          {QUOTATION_STATUS_ORDER.map((status) => (
            <option key={status} value={status}>
              {status.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </FilterBar>
      {actionError && (
        <p role="alert" className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-600/20">
          {actionError}
        </p>
      )}
      <ResourceTable
        rows={rows}
        columns={columns}
        isLoading={isLoading}
        error={error as Error | null}
        emptyHint={
          search
            ? emptyStateMessage({ entityLabel: "quotations", hasSearch: true })
            : url.active
              ? { message: "No quotations match this filter." }
              : {
                message: "No quotations yet. A priced proposal appears here once one is issued against a lead.",
                action: { label: "New quotation", onClick: () => setCreateOpen(true) },
              }
        }
      />

      <CreateQuotationModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <CreateQuotationModal
        open={revisionTarget !== null}
        revisionOf={revisionTarget}
        onClose={() => setRevisionTarget(null)}
      />
      <RevisionsModal quotation={comparing} onClose={() => setComparing(null)} />
    </div>
  );
}

/** Every revision in one lineage, side by side — price total, status and key terms for each, oldest first. */
function RevisionsModal({ quotation, onClose }: { quotation: QuotationRow | null; onClose: () => void }) {
  const revisions = useQuotationRevisions(quotation?._id);
  const rows = revisions.data ?? [];

  return (
    <Modal
      open={quotation !== null}
      title="Compare revisions"
      description="Every revision in this quotation's lineage, oldest first."
      size="lg"
      onRequestClose={onClose}
    >
      {revisions.isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200">
              <tr>
                {rows.map((row) => (
                  <th key={row._id} className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Revision {row.revision}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                {rows.map((row) => (
                  <td key={row._id} className="px-3 py-2">
                    <StatusPill value={row.status} />
                  </td>
                ))}
              </tr>
              <tr>
                {rows.map((row) => (
                  <td key={row._id} className="px-3 py-2 tabular-nums">
                    {formatPaise(row.totalPaise)}
                  </td>
                ))}
              </tr>
              <tr>
                {rows.map((row) => (
                  <td key={row._id} className="px-3 py-2">
                    {row.capacityTpd} TPD
                  </td>
                ))}
              </tr>
              <tr>
                {rows.map((row) => (
                  <td key={row._id} className="px-3 py-2 text-xs text-slate-500">
                    {row.priceLines.length} line{row.priceLines.length === 1 ? "" : "s"}
                  </td>
                ))}
              </tr>
              <tr>
                {rows.map((row) => (
                  <td key={row._id} className="px-3 py-2 text-xs text-slate-500">
                    {row.revisionReason || "—"}
                  </td>
                ))}
              </tr>
              <tr>
                {rows.map((row) => (
                  <td key={row._id} className="px-3 py-2 text-xs text-slate-400">
                    {row.createdAt ? formatDate(row.createdAt) : "—"}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
