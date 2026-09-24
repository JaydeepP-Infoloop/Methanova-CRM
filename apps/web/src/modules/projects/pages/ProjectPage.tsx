import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FilterBar, filterRows } from "../../../components/FilterBar";
import { IdentityCell } from "../../../components/IdentityCell";
import { PageHeader } from "../../../components/PagePrimitives";
import { ResourceTable, type ResourceColumn } from "../../../components/ResourceTable";
import { emptyStateMessage } from "../../../lib/emptyState";
import { useProjectList } from "../api/project.api";
import { ProjectStatusBadge } from "../components/ProjectStatusBadge";
import { populatedName, type ProjectRow } from "../types";

export function ProjectPage() {
  const navigate = useNavigate();
  const [mine, setMine] = useState(false);
  const { data, isLoading, error } = useProjectList(mine);
  const [search, setSearch] = useState("");
  const rows = filterRows(data ?? [], search, ["name", "code", "status"]);

  const columns: ResourceColumn<ProjectRow>[] = [
    {
      key: "name",
      label: "Project",
      sortable: true,
      render: (row) => <IdentityCell name={row.name} secondary={row.code} />,
    },
    {
      key: "pm",
      label: "Project Manager",
      render: (row) => populatedName(row.projectManagerUserId),
    },
    { key: "status", label: "Status", sortable: true, render: (row) => <ProjectStatusBadge status={row.status} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Projects"
        subtitle="Everything created the moment an MOU is signed, through commissioning and handover."
      />
      <FilterBar search={search} onSearchChange={setSearch} placeholder="Search by project name, code or status…">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={mine} onChange={(event) => setMine(event.target.checked)} />
          Assigned to me
        </label>
      </FilterBar>
      <ResourceTable
        rows={rows}
        columns={columns}
        isLoading={isLoading}
        error={error as Error | null}
        onRowClick={(row) => navigate(`/app/projects/${row._id}`)}
        emptyHint={
          search
            ? emptyStateMessage({ entityLabel: "projects", hasSearch: true })
            : mine
              ? { message: "You are not the Project Manager or a member on any plant yet." }
              : { message: "No projects yet. One is created automatically the moment an MOU is signed." }
        }
      />
    </div>
  );
}
