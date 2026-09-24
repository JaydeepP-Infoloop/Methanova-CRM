import { PageHeader } from "../../../components/PagePrimitives";
import { ResourceTable, type ResourceColumn } from "../../../components/ResourceTable";
import { feasibilityApi } from "../api/feasibility.api";
import type { FeasibilitySurveyRow } from "../types";

const columns: ResourceColumn<FeasibilitySurveyRow>[] = [
  { key: "projectId", label: "Project" },
  { key: "version", label: "Version" },
  { key: "findings", label: "Findings" },
];

export function FeasibilitySurveyPage() {
  const { data, isLoading, error } = feasibilityApi.useList();
  return (
    <div>
      <PageHeader title="Feasibility Surveys" />
      <ResourceTable rows={data ?? []} columns={columns} isLoading={isLoading} error={error as Error | null} />
    </div>
  );
}
