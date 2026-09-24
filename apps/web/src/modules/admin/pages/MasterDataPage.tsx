import { PageHeader } from "../../../components/PagePrimitives";
import { ResourceTable, type ResourceColumn } from "../../../components/ResourceTable";
import { masterDataApi } from "../api/master-data.api";
import type { MasterDataRow } from "../types";

const columns: ResourceColumn<MasterDataRow>[] = [
  { key: "key", label: "Key" },
  { key: "label", label: "Label" },
];

export function MasterDataPage() {
  const { data, isLoading, error } = masterDataApi.useList();
  return (
    <div>
      <PageHeader title="Master Data" />
      <ResourceTable rows={data ?? []} columns={columns} isLoading={isLoading} error={error as Error | null} />
    </div>
  );
}
