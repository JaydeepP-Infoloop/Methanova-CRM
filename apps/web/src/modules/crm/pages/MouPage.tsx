import { AccessLevel, AppModule, canAccess, MouStatus, nextStates } from "@methanova/shared-types";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../app/providers";
import { Button } from "../../../components/Button";
import { Card } from "../../../components/Card";
import { CONTROL_CLASS } from "../../../components/Field";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { FilterBar, filterRows } from "../../../components/FilterBar";
import { PageHeader } from "../../../components/PagePrimitives";
import { RefCell } from "../../../components/RefCell";
import { ResourceTable, type ResourceColumn } from "../../../components/ResourceTable";
import { StatusPill } from "../../../components/StatusPill";
import { useToast } from "../../../components/Toast";
import { ApiError } from "../../../lib/apiClient";
import { emptyStateMessage } from "../../../lib/emptyState";
import { formatPaise } from "../../../lib/formatters";
import { useUpdateMouApprovalSettings } from "../../admin/api/reference.api";
import { useLeadLabels } from "../api/lead-lookup";
import { useMouApprovalSettings } from "../api/masters.api";
import { mouApi } from "../api/mou.api";
import { CreateMouModal } from "../components/CreateMouModal";
import type { MouRow } from "../types";

export function MouPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, isLoading, error } = mouApi.useList();
  const transition = mouApi.useTransition();
  const toast = useToast();
  const leadLabels = useLeadLabels();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [signing, setSigning] = useState<MouRow | null>(null);
  const [signError, setSignError] = useState<string | null>(null);

  const canManageThreshold = Boolean(user && canAccess(user.role, AppModule.admin, AccessLevel.FULL));

  const rows = filterRows(data ?? [], search, ["code", "status"]);

  async function confirmSign() {
    if (!signing) return;
    setSignError(null);
    try {
      const signed = await transition.mutateAsync({ id: signing._id, to: MouStatus.SIGNED });
      const projectId = (signed as MouRow).projectId;
      toast({
        message: `${signing.code} signed`,
        action: projectId
          ? { label: "View project", onClick: () => navigate(`/app/projects/${projectId}`) }
          : undefined,
      });
      setSigning(null);
    } catch (caught) {
      setSignError(caught instanceof ApiError ? caught.message : "Could not sign that MOU.");
    }
  }

  const columns: ResourceColumn<MouRow>[] = [
    { key: "code", label: "Code", sortable: true },
    {
      key: "leadId",
      label: "Lead",
      render: (row) => {
        const lead = leadLabels.get(row.leadId);
        return (
          <RefCell id={row.leadId} name={lead?.companyName} secondary={lead?.leadCode} to={`/app/crm/leads/${row.leadId}`} />
        );
      },
    },
    {
      key: "contractValuePaise",
      label: "Contract value",
      align: "right",
      sortable: true,
      render: (row) => formatPaise(row.contractValuePaise),
    },
    {
      key: "feePaise",
      label: "Fee",
      align: "right",
      sortable: true,
      render: (row) => formatPaise(row.feePaise),
    },
    { key: "status", label: "Status", sortable: true, render: (row) => <StatusPill value={row.status} /> },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (row) =>
        nextStates("mou", row.status).includes(MouStatus.SIGNED) ? (
          <div onClick={(event) => event.stopPropagation()}>
            <Button
              size="sm"
              onClick={() => {
                setSignError(null);
                setSigning(row);
              }}
            >
              Sign MOU
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        title="MOUs"
        subtitle="Signing an MOU starts the project — it is the hinge point of the whole system."
      >
        <Button icon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={() => setCreateOpen(true)}>
          New MOU
        </Button>
      </PageHeader>

      {canManageThreshold && <ApprovalThresholdCard />}

      <FilterBar search={search} onSearchChange={setSearch} placeholder="Search MOUs by code or status…" />
      <ResourceTable
        rows={rows}
        columns={columns}
        isLoading={isLoading}
        error={error as Error | null}
        emptyHint={
          search
            ? emptyStateMessage({ entityLabel: "MOUs", hasSearch: true })
            : {
                message: "No MOUs yet. Create one against a quotation the client has accepted.",
                action: { label: "New MOU", onClick: () => setCreateOpen(true) },
              }
        }
      />

      <CreateMouModal open={createOpen} onClose={() => setCreateOpen(false)} />

      <ConfirmDialog
        open={signing !== null}
        title={`Sign ${signing?.code ?? "MOU"}?`}
        confirmLabel="Sign MOU"
        isPending={transition.isPending}
        error={signError}
        onCancel={() => setSigning(null)}
        onConfirm={() => void confirmSign()}
      >
        <p>
          This cannot be undone. Signing creates the following in a single transaction — either all of it
          is created, or none of it is:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>the project, named and located from the lead, sized from the accepted quotation</li>
          <li>its payment schedule, built from the quotation's payment terms template</li>
          <li>the licence checklist, one row per configured licence type</li>
          <li>
            the MOU fee tax invoice
            {signing ? <> for {formatPaise(signing.feePaise)} plus GST</> : null}
          </li>
        </ul>
        <p className="mt-2">The lead also moves to WON. A contract above the approval threshold needs Director approval.</p>
      </ConfirmDialog>
    </div>
  );
}

/** Visible only to roles that can actually save it — the same admin/FULL gate `signMou()` itself checks server-side. */
function ApprovalThresholdCard() {
  const toast = useToast();
  const settings = useMouApprovalSettings();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (settings.data) setValue(String(settings.data.thresholdPaise / 100));
  }, [settings.data]);

  const update = useUpdateMouApprovalSettings();

  async function save() {
    setError(null);
    const rupees = Number(value);
    if (!Number.isFinite(rupees) || rupees < 0) return setError("Enter a valid amount");
    try {
      await update.mutateAsync({ thresholdPaise: Math.round(rupees * 100) });
      toast({ message: "Approval threshold updated" });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not save that");
    }
  }

  return (
    <Card title="Director-approval threshold" className="mb-4">
      <p className="text-sm text-slate-600">
        Signing an MOU with a contract value at or above this figure requires Director approval — enforced
        server-side, not just hidden from the button here.
      </p>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
      <div className="mt-3 flex items-end gap-2">
        <div className="flex-1">
          <label htmlFor="mou-threshold" className="block text-xs font-medium text-slate-700">
            Threshold (₹)
          </label>
          <input
            id="mou-threshold"
            type="number"
            min="0"
            className={`mt-1 ${CONTROL_CLASS}`}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </div>
        <Button
          variant="secondary"
          disabled={update.isPending || !settings.data || value === String(settings.data.thresholdPaise / 100)}
          onClick={() => void save()}
        >
          {update.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </Card>
  );
}
