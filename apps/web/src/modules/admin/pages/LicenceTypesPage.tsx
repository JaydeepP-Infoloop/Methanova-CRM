import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../../../components/Button";
import { Card } from "../../../components/Card";
import { CONTROL_CLASS } from "../../../components/Field";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { Modal } from "../../../components/Modal";
import { PageHeader } from "../../../components/PagePrimitives";
import { SkeletonEditorRows } from "../../../components/Skeleton";
import { StatusPill } from "../../../components/StatusPill";
import { useToast } from "../../../components/Toast";
import { ApiError } from "../../../lib/apiClient";
import { useLicenceTypes, type LicenceTypeOption } from "../../crm/api/masters.api";
import {
  useCreateLicenceType,
  useDeleteLicenceType,
  useUpdateLicenceType,
} from "../api/reference.api";

const inputClass = CONTROL_CLASS;
const BUNDLES = ["PRE_CTE", "CTE", "CTO"] as const;
const SCOPES = ["METHANOVA", "CLIENT"] as const;

type Draft = Record<
  string,
  { label: string; authority: string; bundle: string; scope: string; expectedVisitCount: string; sortOrder: string }
>;

export function LicenceTypesPage() {
  const toast = useToast();
  const types = useLicenceTypes();
  const update = useUpdateLicenceType();
  const create = useCreateLicenceType();
  const remove = useDeleteLicenceType();

  const [draft, setDraft] = useState<Draft>({});
  const [addOpen, setAddOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<LicenceTypeOption | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!types.data) return;
    setDraft(
      Object.fromEntries(
        types.data.map((type) => [
          type._id,
          {
            label: type.label,
            authority: type.authority,
            bundle: type.bundle,
            scope: type.scope,
            expectedVisitCount: String(type.expectedVisitCount ?? 0),
            sortOrder: String(type.sortOrder ?? 0),
          },
        ]),
      ),
    );
  }, [types.data]);

  const rows = types.data ?? [];

  function isDirty(row: LicenceTypeOption): boolean {
    const current = draft[row._id];
    if (!current) return false;
    return (
      current.label !== row.label ||
      current.authority !== row.authority ||
      current.bundle !== row.bundle ||
      current.scope !== row.scope ||
      Number(current.expectedVisitCount) !== row.expectedVisitCount ||
      Number(current.sortOrder) !== row.sortOrder
    );
  }

  async function save(row: LicenceTypeOption) {
    const current = draft[row._id];
    try {
      await update.mutateAsync({
        id: row._id,
        payload: {
          label: current.label.trim(),
          authority: current.authority.trim(),
          bundle: current.bundle as LicenceTypeOption["bundle"],
          scope: current.scope as LicenceTypeOption["scope"],
          expectedVisitCount: Number(current.expectedVisitCount),
          sortOrder: Number(current.sortOrder),
        },
      });
      toast({ message: `${current.label} updated` });
    } catch (caught) {
      toast({ message: caught instanceof ApiError ? caught.message : "Could not save", tone: "error" });
    }
  }

  return (
    <div>
      <PageHeader
        title="Licence types"
        subtitle="The project licence checklist's own master data — what signing an MOU instantiates one checklist row per, in place of a fixed three-bundle stub."
      >
        <Button icon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={() => setAddOpen(true)}>
          Add licence type
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {types.isLoading ? (
            <SkeletonEditorRows />
          ) : rows.length === 0 ? (
            <Card title="No licence types">
              <p className="text-sm text-slate-500">
                Signing an MOU needs at least one licence type configured to build a checklist from.
              </p>
            </Card>
          ) : (
            rows.map((row) => {
              const current = draft[row._id];
              if (!current) return null;
              return (
                <div key={row._id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
                  <div className="flex items-start justify-between gap-3">
                    {/* Key is the stable business identifier and is not editable. */}
                    <div className="flex items-center gap-2">
                      <StatusPill value={row.key} tone="neutral" />
                      <StatusPill value={row.bundle} />
                    </div>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(row)}
                      aria-label={`Remove ${row.label}`}
                      className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-5">
                    <div className="sm:col-span-2">
                      <label htmlFor={`label-${row._id}`} className="block text-xs font-medium text-slate-700">
                        Label
                      </label>
                      <input
                        id={`label-${row._id}`}
                        className={`mt-1 ${inputClass}`}
                        value={current.label}
                        onChange={(event) => setDraft({ ...draft, [row._id]: { ...current, label: event.target.value } })}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label htmlFor={`authority-${row._id}`} className="block text-xs font-medium text-slate-700">
                        Authority
                      </label>
                      <input
                        id={`authority-${row._id}`}
                        className={`mt-1 ${inputClass}`}
                        value={current.authority}
                        onChange={(event) =>
                          setDraft({ ...draft, [row._id]: { ...current, authority: event.target.value } })
                        }
                      />
                    </div>
                    <div>
                      <label htmlFor={`visits-${row._id}`} className="block text-xs font-medium text-slate-700">
                        Expected visits
                      </label>
                      <input
                        id={`visits-${row._id}`}
                        type="number"
                        min="0"
                        className={`mt-1 ${inputClass}`}
                        value={current.expectedVisitCount}
                        onChange={(event) =>
                          setDraft({ ...draft, [row._id]: { ...current, expectedVisitCount: event.target.value } })
                        }
                      />
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
                    <div>
                      <label htmlFor={`bundle-${row._id}`} className="block text-xs font-medium text-slate-700">
                        Bundle
                      </label>
                      <select
                        id={`bundle-${row._id}`}
                        className={`mt-1 ${inputClass}`}
                        value={current.bundle}
                        onChange={(event) => setDraft({ ...draft, [row._id]: { ...current, bundle: event.target.value } })}
                      >
                        {BUNDLES.map((bundle) => (
                          <option key={bundle} value={bundle}>
                            {bundle.replace(/_/g, " ")}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor={`scope-${row._id}`} className="block text-xs font-medium text-slate-700">
                        Scope
                      </label>
                      <select
                        id={`scope-${row._id}`}
                        className={`mt-1 ${inputClass}`}
                        value={current.scope}
                        onChange={(event) => setDraft({ ...draft, [row._id]: { ...current, scope: event.target.value } })}
                      >
                        {SCOPES.map((scope) => (
                          <option key={scope} value={scope}>
                            {scope === "METHANOVA" ? "Methanova" : "Client"}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor={`order-${row._id}`} className="block text-xs font-medium text-slate-700">
                        Order
                      </label>
                      <input
                        id={`order-${row._id}`}
                        type="number"
                        className={`mt-1 ${inputClass}`}
                        value={current.sortOrder}
                        onChange={(event) =>
                          setDraft({ ...draft, [row._id]: { ...current, sortOrder: event.target.value } })
                        }
                      />
                    </div>
                    <div className="flex items-end justify-end">
                      <Button
                        variant="secondary"
                        disabled={!isDirty(row) || update.isPending}
                        onClick={() => void save(row)}
                      >
                        {isDirty(row) ? "Save" : "Saved"}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="space-y-4">
          <Card title="How this feeds signing">
            <p className="text-sm text-slate-600">
              Signing an MOU creates one licence checklist row per type listed here, carrying that type's
              authority and bundle straight onto the row. Adding, removing or re-bundling a type here
              changes the checklist every project spun up afterwards gets — it never rewrites a project
              that already exists.
            </p>
          </Card>
          <Card title="Scope">
            <p className="text-sm text-slate-600">
              Methanova or Client — who is responsible for pursuing this licence. This is separate from
              which of Methanova&rsquo;s three bundles (Pre-CTE / CTE / CTO) it belongs to.
            </p>
          </Card>
        </div>
      </div>

      <AddLicenceTypeModal
        open={addOpen}
        isPending={create.isPending}
        onClose={() => setAddOpen(false)}
        onCreate={async (payload) => {
          await create.mutateAsync(payload);
          toast({ message: `${payload.label} added` });
          setAddOpen(false);
        }}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Remove ${pendingDelete?.label ?? ""}?`}
        confirmLabel="Remove"
        isPending={remove.isPending}
        error={deleteError}
        onCancel={() => {
          setPendingDelete(null);
          setDeleteError(null);
        }}
        onConfirm={() => {
          if (!pendingDelete) return;
          setDeleteError(null);
          void remove
            .mutateAsync(pendingDelete._id)
            .then(() => {
              toast({ message: `${pendingDelete.label} removed` });
              setPendingDelete(null);
            })
            .catch((caught: unknown) => {
              setDeleteError(caught instanceof ApiError ? caught.message : "Could not remove that");
            });
        }}
      >
        <p>It stops appearing in future checklists. It cannot be removed while any project checklist already lists it.</p>
      </ConfirmDialog>
    </div>
  );
}

function AddLicenceTypeModal({
  open,
  isPending,
  onClose,
  onCreate,
}: {
  open: boolean;
  isPending: boolean;
  onClose: () => void;
  onCreate: (payload: {
    key: string;
    label: string;
    authority: string;
    bundle: (typeof BUNDLES)[number];
    scope: (typeof SCOPES)[number];
    expectedVisitCount: number;
    sortOrder: number;
  }) => Promise<void>;
}) {
  const [label, setLabel] = useState("");
  const [key, setKey] = useState("");
  const [authority, setAuthority] = useState("");
  const [bundle, setBundle] = useState<(typeof BUNDLES)[number]>("PRE_CTE");
  const [scope, setScope] = useState<(typeof SCOPES)[number]>("METHANOVA");
  const [expectedVisitCount, setExpectedVisitCount] = useState("1");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLabel("");
    setKey("");
    setAuthority("");
    setBundle("PRE_CTE");
    setScope("METHANOVA");
    setExpectedVisitCount("1");
    setError(null);
  }, [open]);

  const slug = (value: string) =>
    value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");

  async function submit() {
    setError(null);
    if (!label.trim()) return setError("Label is required");
    if (!authority.trim()) return setError("Authority is required");
    if (!/^[A-Z][A-Z0-9_]*$/.test(key)) return setError("Key must be UPPER_SNAKE_CASE");
    try {
      await onCreate({
        key,
        label: label.trim(),
        authority: authority.trim(),
        bundle,
        scope,
        expectedVisitCount: Number(expectedVisitCount) || 0,
        sortOrder: 100,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add that licence type");
    }
  }

  return (
    <Modal
      open={open}
      title="Add licence type"
      description="A new row every future MOU signing's licence checklist is built from."
      size="md"
      onRequestClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} isPending={isPending} pendingLabel="Adding…">
            Add licence type
          </Button>
        </div>
      }
    >
      {error && (
        <p role="alert" className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-600/20">
          {error}
        </p>
      )}
      <div className="space-y-3">
        <div>
          <label htmlFor="lt-label" className="block text-xs font-medium text-slate-700">
            Label<span className="ml-0.5 text-rose-600">*</span>
          </label>
          <input
            id="lt-label"
            className={`mt-1 ${inputClass}`}
            value={label}
            placeholder="Consent to Establish"
            onChange={(event) => {
              const previous = slug(label);
              setLabel(event.target.value);
              if (key === "" || key === previous) setKey(slug(event.target.value));
            }}
          />
        </div>
        <div>
          <label htmlFor="lt-key" className="block text-xs font-medium text-slate-700">
            Key
          </label>
          <input id="lt-key" className={`mt-1 ${inputClass}`} value={key} onChange={(event) => setKey(event.target.value.toUpperCase())} />
          <p className="mt-1 text-xs text-slate-500">Permanent once created.</p>
        </div>
        <div>
          <label htmlFor="lt-authority" className="block text-xs font-medium text-slate-700">
            Authority<span className="ml-0.5 text-rose-600">*</span>
          </label>
          <input
            id="lt-authority"
            className={`mt-1 ${inputClass}`}
            value={authority}
            placeholder="State Pollution Control Board"
            onChange={(event) => setAuthority(event.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="lt-bundle" className="block text-xs font-medium text-slate-700">
              Bundle
            </label>
            <select id="lt-bundle" className={`mt-1 ${inputClass}`} value={bundle} onChange={(event) => setBundle(event.target.value as (typeof BUNDLES)[number])}>
              {BUNDLES.map((value) => (
                <option key={value} value={value}>
                  {value.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="lt-scope" className="block text-xs font-medium text-slate-700">
              Scope
            </label>
            <select id="lt-scope" className={`mt-1 ${inputClass}`} value={scope} onChange={(event) => setScope(event.target.value as (typeof SCOPES)[number])}>
              {SCOPES.map((value) => (
                <option key={value} value={value}>
                  {value === "METHANOVA" ? "Methanova" : "Client"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="lt-visits" className="block text-xs font-medium text-slate-700">
              Expected visits
            </label>
            <input
              id="lt-visits"
              type="number"
              min="0"
              className={`mt-1 ${inputClass}`}
              value={expectedVisitCount}
              onChange={(event) => setExpectedVisitCount(event.target.value)}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
