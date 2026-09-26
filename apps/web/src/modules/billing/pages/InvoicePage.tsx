import { useState } from "react";
import { FilterBar, filterRows } from "../../../components/FilterBar";
import { PageHeader } from "../../../components/PagePrimitives";
import { ResourceTable, type ResourceColumn } from "../../../components/ResourceTable";
import { StatusPill } from "../../../components/StatusPill";
import { InvoiceStatusBadge } from "../components/InvoiceStatusBadge";
import { emptyStateMessage } from "../../../lib/emptyState";
import { formatDate, formatPaise } from "../../../lib/formatters";
import { useUrlFilters } from "../../../lib/useUrlFilters";
import { UrlFilterNotice } from "../../../components/UrlFilterNotice";
import { invoicesApi } from "../api/invoices.api";
import type { InvoiceRow } from "../types";

/** Which GST regime applied is not obvious from the totals, so the split is shown explicitly. */
function gstSummary(row: InvoiceRow): string {
  return row.igstPaise > 0
    ? `IGST ${formatPaise(row.igstPaise)}`
    : `CGST+SGST ${formatPaise(row.cgstPaise + row.sgstPaise)}`;
}

const columns: ResourceColumn<InvoiceRow>[] = [
  { key: "number", label: "Number", sortable: true },
  { key: "clientName", label: "Client", sortable: true, render: (row) => row.clientName ?? "—" },
  { key: "kind", label: "Kind", render: (row) => <StatusPill value={row.kind} /> },
  { key: "status", label: "Status", sortable: true, render: (row) => <InvoiceStatusBadge status={row.status} /> },
  {
    key: "dueDate",
    label: "Due date",
    sortable: true,
    render: (row) => (row.dueDate ? formatDate(row.dueDate) : "—"),
  },
  {
    key: "taxablePaise",
    label: "Taxable",
    align: "right",
    sortable: true,
    render: (row) => formatPaise(row.taxablePaise),
  },
  { key: "gst", label: "GST", align: "right", render: gstSummary },
  {
    key: "retentionPaise",
    label: "Retention",
    align: "right",
    sortable: true,
    render: (row) => formatPaise(row.retentionPaise),
  },
  {
    key: "totalPaise",
    label: "Total",
    align: "right",
    sortable: true,
    render: (row) => formatPaise(row.totalPaise),
  },
  {
    key: "outstandingPaise",
    label: "Outstanding",
    align: "right",
    sortable: true,
    render: (row) => (row.outstandingPaise === undefined ? "—" : formatPaise(row.outstandingPaise)),
  },
  {
    key: "retentionHeldPaise",
    label: "Retention held",
    align: "right",
    sortable: true,
    render: (row) => (row.retentionHeldPaise ? formatPaise(row.retentionHeldPaise) : "—"),
  },
  {
    key: "ageingBucket",
    label: "Ageing",
    render: (row) => (row.ageingBucket ? <StatusPill value={row.ageingBucket} /> : "—"),
  },
];

const BUCKET_LABELS: Record<string, string> = {
  CURRENT: "Not yet due",
  "0-30": "1–30 days past due",
  "31-60": "31–60 days past due",
  "61-90": "61–90 days past due",
  "90+": "Over 90 days past due",
  none: "Outstanding with no due date",
};

export function InvoicePage() {
  const url = useUrlFilters(["projectId", "receivable", "retention", "overdue", "bucket", "id"] as const);
  const { data, isLoading, error } = invoicesApi.useList(url.filters);
  const [search, setSearch] = useState("");
  const rows = filterRows(data ?? [], search, ["number", "kind", "status", "clientName"]);
  const filterLabels = [
    ...(url.filters.receivable ? ["Outstanding, largest first"] : []),
    ...(url.filters.retention ? ["Retention still held (not aged, not overdue)"] : []),
    ...(url.filters.overdue ? ["Past due and still owed"] : []),
    ...(url.filters.bucket ? [BUCKET_LABELS[url.filters.bucket] ?? url.filters.bucket] : []),
    ...(url.filters.id ? ["One invoice"] : []),
  ];

  return (
    <div>
      <PageHeader title="Invoices" subtitle="Proformas, tax invoices and credit notes across all projects." />
      {url.active && (
        <UrlFilterNotice labels={filterLabels} projectId={url.filters.projectId} onClear={url.clear} />
      )}
      <FilterBar search={search} onSearchChange={setSearch} placeholder="Search by invoice number, client, kind or status…" />
      <ResourceTable
        rows={rows}
        columns={columns}
        isLoading={isLoading}
        error={error as Error | null}
        emptyHint={
          url.active && !search
            ? { message: "No invoices match this filter." }
            : emptyStateMessage({ entityLabel: "invoices", hasSearch: Boolean(search) })
        }
      />
    </div>
  );
}
