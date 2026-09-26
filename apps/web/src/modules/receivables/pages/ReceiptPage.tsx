import { PageHeader } from "../../../components/PagePrimitives";
import { ResourceTable, type ResourceColumn } from "../../../components/ResourceTable";
import { UrlFilterNotice } from "../../../components/UrlFilterNotice";
import { AgeingBadge } from "../components/AgeingBadge";
import { formatPaise, formatDate } from "../../../lib/formatters";
import { useUrlFilters } from "../../../lib/useUrlFilters";
import { receiptsApi } from "../api/receipts.api";
import type { ReceiptRow } from "../types";

const columns: ResourceColumn<ReceiptRow>[] = [
  { key: "invoiceId", label: "Invoice" },
  { key: "amountPaise", label: "Amount", render: (row) => formatPaise(row.amountPaise as number) },
  { key: "receivedOn", label: "Received", render: (row) => formatDate(row.receivedOn as string) },
  { key: "reference", label: "Reference" },
  { key: "ageing", label: "Ageing", render: (row) => <AgeingBadge since={row.receivedOn as string} /> },
];

/** "2026-09" → "Sep 2026", the same UTC month the Dashboard's "Collected" card sums. */
function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
}

export function ReceiptPage() {
  const url = useUrlFilters(["month"] as const);
  const { data, isLoading, error } = receiptsApi.useList(url.filters);
  return (
    <div>
      <PageHeader title="Receipts & Ageing" />
      {url.filters.month && (
        <UrlFilterNotice labels={[`Received in ${monthLabel(url.filters.month)}`]} onClear={url.clear} />
      )}
      <ResourceTable
        rows={data ?? []}
        columns={columns}
        isLoading={isLoading}
        error={error as Error | null}
        emptyHint={url.active ? { message: "No receipts in this month." } : undefined}
      />
    </div>
  );
}
