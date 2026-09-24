import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Card } from "../../../components/Card";
import { Button } from "../../../components/Button";
import { CONTROL_CLASS } from "../../../components/Field";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { Modal } from "../../../components/Modal";
import { PageHeader } from "../../../components/PagePrimitives";
import { SkeletonEditorRows } from "../../../components/Skeleton";
import { StatusPill } from "../../../components/StatusPill";
import { useToast } from "../../../components/Toast";
import { ApiError } from "../../../lib/apiClient";
import { useFeedstockTypes, type FeedstockTypeOption } from "../../crm/api/masters.api";
import {
  useCreateFeedstockType,
  useDeleteFeedstockType,
  useFeedstockUsage,
  useRecalculateExpectedCbg,
  useUpdateFeedstockType,
} from "../api/reference.api";

const inputClass = CONTROL_CLASS;

/**
 * The factor is stored as `number | null` and the two are not interchangeable:
 * null means "not decided yet" and makes the intake estimate show an em dash,
 * 0 asserts this feedstock yields nothing. An empty input is therefore null,
 * and the row says so rather than leaving the admin to guess.
 */
type Draft = Record<string, { label: string; yieldFactor: string; unit: string; sortOrder: string }>;

function factorToInput(value: number | null): string {
  return value === null || value === undefined ? "" : String(value);
}

function inputToFactor(value: string): number | null {
  return value.trim() === "" ? null : Number(value);
}

export function FeedstockTypesPage() {
  const toast = useToast();
  const types = useFeedstockTypes();
  const usage = useFeedstockUsage();
  const update = useUpdateFeedstockType();
  const create = useCreateFeedstockType();
  const remove = useDeleteFeedstockType();
  const recalculate = useRecalculateExpectedCbg();

  const [draft, setDraft] = useState<Draft>({});
  const [addOpen, setAddOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<FeedstockTypeOption | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [recalcOpen, setRecalcOpen] = useState(false);

  useEffect(() => {
    if (!types.data) return;
    setDraft(
      Object.fromEntries(
        types.data.map((type) => [
          type._id,
          {
            label: type.label,
            yieldFactor: factorToInput(type.yieldFactor),
            unit: type.unit ?? "TPD",
            sortOrder: String(type.sortOrder ?? 0),
          },
        ]),
      ),
    );
  }, [types.data]);

  const rows = types.data ?? [];
  const staleOpenLeads = usage.data?.staleOpenLeads ?? 0;

  function isDirty(row: FeedstockTypeOption): boolean {
    const current = draft[row._id];
    if (!current) return false;
    return (
      current.label !== row.label ||
      current.yieldFactor !== factorToInput(row.yieldFactor) ||
      current.unit !== (row.unit ?? "TPD") ||
      Number(current.sortOrder) !== row.sortOrder
    );
  }

  async function save(row: FeedstockTypeOption) {
    const current = draft[row._id];
    const factor = inputToFactor(current.yieldFactor);
    if (factor !== null && (Number.isNaN(factor) || factor < 0)) {
      toast({ message: "A yield factor must be zero or more, or blank", tone: "error" });
      return;
    }
    try {
      await update.mutateAsync({
        id: row._id,
        payload: {
          label: current.label.trim(),
          yieldFactor: factor,
          unit: current.unit.trim() || "TPD",
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
        title="Feedstock yield factors"
        subtitle="Tonnes of CBG per TPD of feedstock — the engineering assumption behind every expected-output estimate the intake form shows."
      >
        <Button icon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={() => setAddOpen(true)}>
          Add feedstock
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {types.isLoading ? (
            <SkeletonEditorRows />
          ) : rows.length === 0 ? (
            <Card title="No feedstock types">
              <p className="text-sm text-slate-500">
                The intake form needs at least one feedstock to select before it can estimate output.
              </p>
            </Card>
          ) : (
            rows.map((row) => {
              const current = draft[row._id];
              if (!current) return null;
              const configured = inputToFactor(current.yieldFactor) !== null;
              const leadCount = usage.data?.leadsByType[row._id] ?? 0;
              return (
                <div key={row._id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
                  <div className="flex items-start justify-between gap-3">
                    {/* Key is the stable business identifier and is not editable. */}
                    <div className="flex items-center gap-2">
                      <StatusPill value={row.key} tone="neutral" />
                      {!configured && <StatusPill value="Not configured" tone="waiting" />}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs tabular-nums text-slate-500">
                        {leadCount} lead{leadCount === 1 ? "" : "s"}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(row)}
                        aria-label={`Remove ${row.label}`}
                        className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
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
                        onChange={(event) =>
                          setDraft({ ...draft, [row._id]: { ...current, label: event.target.value } })
                        }
                      />
                    </div>
                    <div>
                      <label htmlFor={`factor-${row._id}`} className="block text-xs font-medium text-slate-700">
                        Yield factor
                      </label>
                      <input
                        id={`factor-${row._id}`}
                        type="number"
                        min="0"
                        step="0.001"
                        placeholder="Blank = undecided"
                        className={`mt-1 ${inputClass}`}
                        value={current.yieldFactor}
                        onChange={(event) =>
                          setDraft({ ...draft, [row._id]: { ...current, yieldFactor: event.target.value } })
                        }
                      />
                    </div>
                    <div>
                      <label htmlFor={`unit-${row._id}`} className="block text-xs font-medium text-slate-700">
                        Unit
                      </label>
                      <input
                        id={`unit-${row._id}`}
                        className={`mt-1 ${inputClass}`}
                        value={current.unit}
                        onChange={(event) =>
                          setDraft({ ...draft, [row._id]: { ...current, unit: event.target.value } })
                        }
                      />
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
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-slate-500">
                      {configured
                        ? `10 ${current.unit || "TPD"} of this alone ⇒ ${(
                            Number(current.yieldFactor) * 10
                          ).toFixed(2)} T/day CBG`
                        : "Contributes nothing to the estimate and shows as an em dash until a factor is set."}
                    </p>
                    <Button
                      variant="secondary"
                      disabled={!isDirty(row) || update.isPending}
                      onClick={() => void save(row)}
                    >
                      {isDirty(row) ? "Save" : "Saved"}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="space-y-4">
          <Card title="Estimates on existing leads">
            <p className="text-sm text-slate-500">
              A lead's expected output is worked out and stored when it is created, so changing a factor
              here does not move leads that already exist. Bring them forward when you are happy with the
              numbers above.
            </p>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-600">Open leads</dt>
                <dd className="tabular-nums font-medium text-slate-900">{usage.data?.openLeads ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-600">Estimates out of date</dt>
                <dd
                  className={`tabular-nums font-medium ${staleOpenLeads > 0 ? "text-amber-700" : "text-slate-900"}`}
                >
                  {usage.data ? staleOpenLeads : "—"}
                </dd>
              </div>
            </dl>
            <Button
              className="mt-3 w-full"
              variant="secondary"
              icon={<RefreshCw className="h-4 w-4" aria-hidden="true" />}
              disabled={staleOpenLeads === 0}
              isPending={recalculate.isPending}
              pendingLabel="Recalculating…"
              onClick={() => setRecalcOpen(true)}
            >
              {staleOpenLeads > 0
                ? `Recalculate ${staleOpenLeads} lead${staleOpenLeads === 1 ? "" : "s"}`
                : "Nothing to recalculate"}
            </Button>
          </Card>

          <Card title="How the estimate works">
            <p className="text-sm text-slate-600">
              Expected CBG is the sum of the selected feedstocks' factors multiplied by the quantity the
              client can supply, rounded to two decimals. A feedstock with no factor contributes nothing
              and is named back to whoever is filling in the form, so a missing assumption is visible
              rather than quietly understating the figure.
            </p>
          </Card>
        </div>
      </div>

      <AddFeedstockModal
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
        open={recalcOpen}
        title={`Recalculate ${staleOpenLeads} lead${staleOpenLeads === 1 ? "" : "s"}?`}
        confirmLabel="Recalculate"
        isPending={recalculate.isPending}
        onCancel={() => setRecalcOpen(false)}
        onConfirm={() => {
          void recalculate
            .mutateAsync()
            .then((result) => {
              toast({ message: `${result.updated} of ${result.scanned} open leads updated` });
              setRecalcOpen(false);
            })
            .catch((caught: unknown) => {
              toast({
                message: caught instanceof ApiError ? caught.message : "Could not recalculate",
                tone: "error",
              });
            });
        }}
      >
        <p>
          Open leads get their expected-output estimate rewritten using the factors above. Won and lost
          leads are left alone — a won lead's estimate fed the MOU and the project that followed it, and a
          lost lead is history. Every change is recorded against the lead.
        </p>
      </ConfirmDialog>

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
        <p>It stops appearing at intake. It cannot be removed while any lead still lists it.</p>
      </ConfirmDialog>
    </div>
  );
}

function AddFeedstockModal({
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
    yieldFactor: number | null;
    unit: string;
    sortOrder: number;
  }) => Promise<void>;
}) {
  const [label, setLabel] = useState("");
  const [key, setKey] = useState("");
  const [yieldFactor, setYieldFactor] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLabel("");
    setKey("");
    setYieldFactor("");
    setError(null);
  }, [open]);

  const slug = (value: string) =>
    value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");

  async function submit() {
    setError(null);
    if (!label.trim()) return setError("Label is required");
    if (!/^[A-Z][A-Z0-9_]*$/.test(key)) return setError("Key must be UPPER_SNAKE_CASE");
    const factor = inputToFactor(yieldFactor);
    if (factor !== null && (Number.isNaN(factor) || factor < 0)) {
      return setError("A yield factor must be zero or more, or left blank");
    }
    try {
      await onCreate({ key, label: label.trim(), yieldFactor: factor, unit: "TPD", sortOrder: 100 });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add that feedstock");
    }
  }

  return (
    <Modal
      open={open}
      title="Add feedstock type"
      description="A new option in the intake form's feedstock list."
      size="md"
      onRequestClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} isPending={isPending} pendingLabel="Adding…">
            Add feedstock
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
          <label htmlFor="fs-label" className="block text-xs font-medium text-slate-700">
            Label<span className="ml-0.5 text-rose-600">*</span>
          </label>
          <input
            id="fs-label"
            className={`mt-1 ${inputClass}`}
            value={label}
            placeholder="Sugarcane trash"
            onChange={(event) => {
              const previous = slug(label);
              setLabel(event.target.value);
              if (key === "" || key === previous) setKey(slug(event.target.value));
            }}
          />
        </div>
        <div>
          <label htmlFor="fs-key" className="block text-xs font-medium text-slate-700">
            Key
          </label>
          <input
            id="fs-key"
            className={`mt-1 ${inputClass}`}
            value={key}
            onChange={(event) => setKey(event.target.value.toUpperCase())}
          />
          <p className="mt-1 text-xs text-slate-500">Permanent once created.</p>
        </div>
        <div>
          <label htmlFor="fs-factor" className="block text-xs font-medium text-slate-700">
            Yield factor
          </label>
          <input
            id="fs-factor"
            type="number"
            min="0"
            step="0.001"
            className={`mt-1 ${inputClass}`}
            value={yieldFactor}
            placeholder="0.05"
            onChange={(event) => setYieldFactor(event.target.value)}
          />
          <p className="mt-1 text-xs text-slate-500">
            Leave blank if it has not been decided. Blank is not zero: it shows as an em dash at intake
            rather than quietly contributing nothing to a number that looks complete.
          </p>
        </div>
      </div>
    </Modal>
  );
}
