import { PageHeader } from "../../../components/PagePrimitives";
import { ResourceTable, type ResourceColumn } from "../../../components/ResourceTable";
import { formatDate } from "../../../lib/formatters";
import { reportsApi } from "../api/reports.api";
import type { ReportSnapshotRow } from "../types";

const columns: ResourceColumn<ReportSnapshotRow>[] = [
  { key: "name", label: "Report" },
  { key: "generatedAt", label: "Generated", render: (row) => formatDate(row.generatedAt as string) },
];

export function ReportSnapshotPage() {
  const { data, isLoading, error } = reportsApi.useList();
  return (
    <div>
      <PageHeader title="Reports" />
      <ResourceTable rows={data ?? []} columns={columns} isLoading={isLoading} error={error as Error | null} />
    </div>
  );
}
