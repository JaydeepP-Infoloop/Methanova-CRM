import { PageHeader } from "../../../components/PagePrimitives";
import { ResourceTable, type ResourceColumn } from "../../../components/ResourceTable";
import { DocumentKindBadge } from "../components/DocumentKindBadge";
import { documentsApi } from "../api/documents.api";
import type { DocumentRecordRow } from "../types";

const columns: ResourceColumn<DocumentRecordRow>[] = [
  { key: "filename", label: "File" },
  { key: "kind", label: "Kind", render: (row) => <DocumentKindBadge kind={row.kind as string} /> },
  { key: "version", label: "Version" },
  { key: "projectId", label: "Project" },
];

export function DocumentRecordPage() {
  const { data, isLoading, error } = documentsApi.useList();
  return (
    <div>
      <PageHeader title="Documents" />
      <ResourceTable rows={data ?? []} columns={columns} isLoading={isLoading} error={error as Error | null} />
    </div>
  );
}
