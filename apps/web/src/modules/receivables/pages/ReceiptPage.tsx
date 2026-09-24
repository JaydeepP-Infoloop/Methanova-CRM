import { PageHeader } from "../../../components/PagePrimitives";
import { ResourceTable, type ResourceColumn } from "../../../components/ResourceTable";
import { AgeingBadge } from "../components/AgeingBadge";
import { formatPaise, formatDate } from "../../../lib/formatters";
import { receiptsApi } from "../api/receipts.api";
import type { ReceiptRow } from "../types";

const columns: ResourceColumn<ReceiptRow>[] = [
  { key: "invoiceId", label: "Invoice" },
  { key: "amountPaise", label: "Amount", render: (row) => formatPaise(row.amountPaise as number) },
  { key: "receivedOn", label: "Received", render: (row) => formatDate(row.receivedOn as string) },
  { key: "reference", label: "Reference" },
  { key: "ageing", label: "Ageing", render: (row) => <AgeingBadge since={row.receivedOn as string} /> },
];

export function ReceiptPage() {
  const { data, isLoading, error } = receiptsApi.useList();
  return (
    <div>
      <PageHeader title="Receipts & Ageing" />
      <ResourceTable rows={data ?? []} columns={columns} isLoading={isLoading} error={error as Error | null} />
    </div>
  );
}
