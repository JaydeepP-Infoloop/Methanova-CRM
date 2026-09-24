import { useState } from "react";
import { FilterBar, filterRows } from "../../../components/FilterBar";
import { PageHeader } from "../../../components/PagePrimitives";
import { RefCell } from "../../../components/RefCell";
import { ResourceTable, type ResourceColumn } from "../../../components/ResourceTable";
import { formatPaise } from "../../../lib/formatters";
import { mouApi } from "../../crm/api/mou.api";
import { projectApi } from "../../projects/api/project.api";
import { paymentSchedulesApi } from "../api/payment-schedules.api";
import type { PaymentScheduleRow } from "../types";

/** Sum of a schedule's own lines — there is no single stored total field. */
function totalPaise(row: PaymentScheduleRow): number {
  return row.lines.reduce((sum, line) => sum + line.amountPaise, 0);
}

type PaymentScheduleListRow = PaymentScheduleRow & {
  projectLabel: string;
  projectCode?: string;
  mouLabel: string;
};

const columns: ResourceColumn<PaymentScheduleListRow>[] = [
  {
    key: "projectLabel",
    label: "Project",
    sortable: true,
    // Neither /app/projects/:id nor /app/crm/mou/:id exist yet (list-only
    // routes today), so these resolve to a name where one is known but are
    // never links — a route this task did not add would send someone to a
    // 404.
    render: (row) => <RefCell id={row.projectId} name={row.projectLabel || undefined} secondary={row.projectCode} />,
  },
  {
    key: "mouLabel",
    label: "MOU",
    sortable: true,
    render: (row) => <RefCell id={row.mouId} name={row.mouLabel || undefined} />,
  },
  {
    key: "lineCount",
    label: "Lines",
    align: "right",
    sortValue: (row) => row.lines.length,
    render: (row) => String(row.lines.length),
  },
  {
    key: "total",
    label: "Total",
    align: "right",
    sortValue: (row) => totalPaise(row),
    render: (row) => formatPaise(totalPaise(row)),
  },
];

export function PaymentSchedulePage() {
  const { data, isLoading, error } = paymentSchedulesApi.useList();
  const projects = projectApi.useList();
  const mous = mouApi.useList();
  const [search, setSearch] = useState("");

  const projectLabels = new Map((projects.data ?? []).map((p) => [p._id, p]));
  const mouLabels = new Map((mous.data ?? []).map((m) => [m._id, m]));

  const resolved: PaymentScheduleListRow[] = (data ?? []).map((row) => {
    const project = projectLabels.get(row.projectId);
    const mou = mouLabels.get(row.mouId);
    return {
      ...row,
      projectLabel: project?.name ?? "",
      projectCode: project?.code,
      mouLabel: mou?.code ?? "",
    };
  });

  const rows = filterRows(resolved, search, ["projectLabel", "projectCode", "mouLabel"]);

  return (
    <div>
      <PageHeader
        title="Payment Schedules"
        subtitle="The billing plan each project's invoices are drawn against."
      />
      <FilterBar search={search} onSearchChange={setSearch} placeholder="Search by project or MOU…" />
      <ResourceTable
        rows={rows}
        columns={columns}
        isLoading={isLoading}
        error={error as Error | null}
        emptyHint={
          search
            ? "No payment schedules match that search."
            : "No payment schedules yet. One is created automatically the moment an MOU is signed."
        }
      />
    </div>
  );
}
