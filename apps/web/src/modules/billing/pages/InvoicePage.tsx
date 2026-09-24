import { useState } from "react";
import { FilterBar, filterRows } from "../../../components/FilterBar";
import { PageHeader } from "../../../components/PagePrimitives";
import { ResourceTable, type ResourceColumn } from "../../../components/ResourceTable";
import { StatusPill } from "../../../components/StatusPill";
import { InvoiceStatusBadge } from "../components/InvoiceStatusBadge";
import { emptyStateMessage } from "../../../lib/emptyState";
import { formatDate, formatPaise } from "../../../lib/formatters";
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
];

export function InvoicePage() {
  const { data, isLoading, error } = invoicesApi.useList();
  const [search, setSearch] = useState("");
  const rows = filterRows(data ?? [], search, ["number", "kind", "status"]);

  return (
    <div>
      <PageHeader title="Invoices" subtitle="Proformas, tax invoices and credit notes across all projects." />
      <FilterBar search={search} onSearchChange={setSearch} placeholder="Search by invoice number, kind or status…" />
      <ResourceTable
        rows={rows}
        columns={columns}
        isLoading={isLoading}
        error={error as Error | null}
        emptyHint={emptyStateMessage({ entityLabel: "invoices", hasSearch: Boolean(search) })}
      />
    </div>
  );
}
