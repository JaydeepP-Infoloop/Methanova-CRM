import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FilterBar, filterRows } from "../../../components/FilterBar";
import { IdentityCell } from "../../../components/IdentityCell";
import { PageHeader } from "../../../components/PagePrimitives";
import { ResourceTable, type ResourceColumn } from "../../../components/ResourceTable";
import { UrlFilterNotice } from "../../../components/UrlFilterNotice";
import { emptyStateMessage } from "../../../lib/emptyState";
import { useUrlFilters } from "../../../lib/useUrlFilters";
import { useProjectList } from "../api/project.api";
import { ProjectStatusBadge } from "../components/ProjectStatusBadge";
import { populatedName, type ProjectRow } from "../types";

const PORTFOLIO_LABELS: Record<string, string> = {
  ACTIVE: "Active (incl. commissioning)",
  ON_HOLD: "On hold",
  COMPLETED: "Completed (handed over or in O&M)",
  TERMINATED: "Terminated",
};

export function ProjectPage() {
  const navigate = useNavigate();
  // "Assigned to me" lives in the URL too, so a dashboard link (?mine=true) lands with it ticked.
  const url = useUrlFilters(["portfolio", "atRisk", "mine"] as const);
  const mine = url.filters.mine === "true";
  const { portfolio, atRisk } = url.filters;
  const drillDownActive = Boolean(portfolio || atRisk);
  const { data, isLoading, error } = useProjectList(mine, { portfolio, atRisk });
  const [search, setSearch] = useState("");
  const rows = filterRows(data ?? [], search, ["name", "code", "status"]);
  const filterLabels = [
    ...(url.filters.portfolio ? [PORTFOLIO_LABELS[url.filters.portfolio] ?? url.filters.portfolio] : []),
    ...(url.filters.atRisk ? ["At risk (open projects with a delayed work package, overdue licence or overdue invoice)"] : []),
  ];

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
    {
      key: "progressPct",
      label: "Progress",
      align: "right",
      sortable: true,
      render: (row) => (typeof row.progressPct === "number" ? `${row.progressPct}%` : "Not available"),
    },
    { key: "status", label: "Status", sortable: true, render: (row) => <ProjectStatusBadge status={row.status} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Projects"
        subtitle="Everything created the moment an MOU is signed, through commissioning and handover."
      />
      {drillDownActive && (
        <UrlFilterNotice labels={filterLabels} onClear={() => url.replace({ portfolio: undefined, atRisk: undefined, mine: url.filters.mine })} />
      )}
      <FilterBar search={search} onSearchChange={setSearch} placeholder="Search by project name, code or status…">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={mine} onChange={(event) => url.replace({ portfolio, atRisk, mine: event.target.checked ? "true" : undefined })} />
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
            : drillDownActive
              ? { message: "No projects match this filter." }
              : mine
                ? { message: "You are not the Project Manager or a member on any plant yet." }
                : { message: "No projects yet. One is created automatically the moment an MOU is signed." }
        }
      />
    </div>
  );
}
