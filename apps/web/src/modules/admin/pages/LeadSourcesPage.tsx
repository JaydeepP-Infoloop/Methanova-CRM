import { Plus, Trash2 } from "lucide-react";
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
import { useLeadSources, type LeadSourceOption } from "../../crm/api/masters.api";
import { useCreateLeadSource, useDeleteLeadSource, useUpdateLeadSource } from "../api/reference.api";

const inputClass = CONTROL_CLASS;

type Draft = Record<string, { label: string; detailLabel: string; detailPlaceholder: string; detailRequired: boolean; sortOrder: string }>;

export function LeadSourcesPage() {
  const toast = useToast();
  const sources = useLeadSources();
  const update = useUpdateLeadSource();
  const create = useCreateLeadSource();
  const remove = useDeleteLeadSource();

  const [draft, setDraft] = useState<Draft>({});
  const [addOpen, setAddOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<LeadSourceOption | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!sources.data) return;
    setDraft(
      Object.fromEntries(
        sources.data.map((source) => [
          source._id,
          {
            label: source.label,
            detailLabel: source.detailLabel ?? "",
            detailPlaceholder: source.detailPlaceholder ?? "",
            detailRequired: Boolean(source.detailRequired),
            sortOrder: String(source.sortOrder ?? 0),
          },
        ]),
      ),
    );
  }, [sources.data]);

  const rows = sources.data ?? [];

  function isDirty(row: LeadSourceOption): boolean {
    const current = draft[row._id];
    if (!current) return false;
    return (
      current.label !== row.label ||
      current.detailLabel !== (row.detailLabel ?? "") ||
      current.detailPlaceholder !== (row.detailPlaceholder ?? "") ||
      current.detailRequired !== Boolean(row.detailRequired) ||
      Number(current.sortOrder) !== row.sortOrder
    );
  }

  async function save(row: LeadSourceOption) {
    const current = draft[row._id];
    try {
      await update.mutateAsync({
        id: row._id,
        payload: {
          label: current.label.trim(),
          detailLabel: current.detailLabel.trim() || undefined,
          detailPlaceholder: current.detailPlaceholder.trim() || undefined,
          detailRequired: current.detailRequired,
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
        title="Lead sources"
        subtitle="Where enquiries come from, and what extra detail each one demands at intake."
      >
        <Button icon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={() => setAddOpen(true)}>
          Add source
        </Button>
      </PageHeader>

      <div className="space-y-3">
        {sources.isLoading ? (
          <SkeletonEditorRows />
        ) : rows.length === 0 ? (
          <Card title="No lead sources">
            <p className="text-sm text-slate-500">The intake form needs at least one source to choose from.</p>
          </Card>
        ) : (
          rows.map((row) => {
            const current = draft[row._id];
            if (!current) return null;
            return (
              <div key={row._id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
                <div className="flex items-start justify-between gap-3">
                  {/* Key is the stable business identifier and is not editable. */}
                  <StatusPill value={row.key} tone="neutral" />
                  <button
                    type="button"
                    onClick={() => setPendingDelete(row)}
                    aria-label={`Remove ${row.label}`}
                    className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
                  <div>
                    <label htmlFor={`label-${row._id}`} className="block text-xs font-medium text-slate-700">Label</label>
                    <input id={`label-${row._id}`} className={`mt-1 ${inputClass}`} value={current.label}
                      onChange={(e) => setDraft({ ...draft, [row._id]: { ...current, label: e.target.value } })} />
                  </div>
                  <div>
                    <label htmlFor={`detailLabel-${row._id}`} className="block text-xs font-medium text-slate-700">Detail field label</label>
                    <input id={`detailLabel-${row._id}`} className={`mt-1 ${inputClass}`} placeholder="Source detail" value={current.detailLabel}
                      onChange={(e) => setDraft({ ...draft, [row._id]: { ...current, detailLabel: e.target.value } })} />
                  </div>
                  <div>
                    <label htmlFor={`detailPlaceholder-${row._id}`} className="block text-xs font-medium text-slate-700">Detail placeholder</label>
                    <input id={`detailPlaceholder-${row._id}`} className={`mt-1 ${inputClass}`} value={current.detailPlaceholder}
                      onChange={(e) => setDraft({ ...draft, [row._id]: { ...current, detailPlaceholder: e.target.value } })} />
                  </div>
                  <div>
                    <label htmlFor={`sortOrder-${row._id}`} className="block text-xs font-medium text-slate-700">Order</label>
                    <input id={`sortOrder-${row._id}`} type="number" className={`mt-1 ${inputClass}`} value={current.sortOrder}
                      onChange={(e) => setDraft({ ...draft, [row._id]: { ...current, sortOrder: e.target.value } })} />
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={current.detailRequired}
                      onChange={(e) => setDraft({ ...draft, [row._id]: { ...current, detailRequired: e.target.checked } })}
                      className="h-4 w-4 rounded border-slate-300 text-methanova-green focus-visible:ring-methanova-gold"
                    />
                    Detail is required at intake
                  </label>
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

      <AddSourceModal
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
        <p>It stops appearing at intake. Leads that already came from it keep the attribution.</p>
      </ConfirmDialog>
    </div>
  );
}

function AddSourceModal({
  open,
  isPending,
  onClose,
  onCreate,
}: {
  open: boolean;
  isPending: boolean;
  onClose: () => void;
  onCreate: (payload: { key: string; label: string; detailLabel?: string; detailPlaceholder?: string; detailRequired: boolean; sortOrder: number }) => Promise<void>;
}) {
  const [label, setLabel] = useState("");
  const [key, setKey] = useState("");
  const [detailLabel, setDetailLabel] = useState("");
  const [detailRequired, setDetailRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLabel("");
    setKey("");
    setDetailLabel("");
    setDetailRequired(false);
    setError(null);
  }, [open]);

  const slug = (value: string) => value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");

  async function submit() {
    setError(null);
    if (!label.trim()) return setError("Label is required");
    if (!/^[A-Z][A-Z0-9_]*$/.test(key)) return setError("Key must be UPPER_SNAKE_CASE");
    try {
      await onCreate({
        key,
        label: label.trim(),
        detailLabel: detailLabel.trim() || undefined,
        detailRequired,
        sortOrder: 100,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add that source");
    }
  }

  return (
    <Modal
      open={open}
      title="Add lead source"
      description="A new option in the intake form's source list."
      size="md"
      onRequestClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} isPending={isPending} pendingLabel="Adding…">
            Add source
          </Button>
        </div>
      }
    >
      {error && <p role="alert" className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-600/20">{error}</p>}
      <div className="space-y-3">
        <div>
          <label htmlFor="src-label" className="block text-xs font-medium text-slate-700">Label<span className="ml-0.5 text-rose-600">*</span></label>
          <input id="src-label" className={`mt-1 ${inputClass}`} value={label} placeholder="Trade publication"
            onChange={(e) => { const previous = slug(label); setLabel(e.target.value); if (key === "" || key === previous) setKey(slug(e.target.value)); }} />
        </div>
        <div>
          <label htmlFor="src-key" className="block text-xs font-medium text-slate-700">Key</label>
          <input id="src-key" className={`mt-1 ${inputClass}`} value={key} onChange={(e) => setKey(e.target.value.toUpperCase())} />
          <p className="mt-1 text-xs text-slate-500">Permanent once created.</p>
        </div>
        <div>
          <label htmlFor="src-detail" className="block text-xs font-medium text-slate-700">Detail field label</label>
          <input id="src-detail" className={`mt-1 ${inputClass}`} value={detailLabel} placeholder="e.g. Publication name"
            onChange={(e) => setDetailLabel(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={detailRequired} onChange={(e) => setDetailRequired(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-methanova-green focus-visible:ring-methanova-gold" />
          Detail is required at intake
        </label>
      </div>
    </Modal>
  );
}
