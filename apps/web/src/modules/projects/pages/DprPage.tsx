import { PageHeader } from "../../../components/PagePrimitives";
import { ResourceTable, type ResourceColumn } from "../../../components/ResourceTable";
import { drpApi } from "../api/drp.api";
import type { DprRow } from "../types";

const columns: ResourceColumn<DprRow>[] = [
  { key: "projectId", label: "Project" },
  { key: "version", label: "Version" },
  { key: "capacityNm3", label: "Capacity (Nm3)" },
];

export function DprPage() {
  const { data, isLoading, error } = drpApi.useList();
  return (
    <div>
      <PageHeader title="Detailed Project Reports" />
      <ResourceTable rows={data ?? []} columns={columns} isLoading={isLoading} error={error as Error | null} />
    </div>
  );
}
