import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Card } from "../../../components/Card";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { Button } from "../../../components/Button";
import { CONTROL_CLASS } from "../../../components/Field";
import { Modal } from "../../../components/Modal";
import { PageHeader } from "../../../components/PagePrimitives";
import { SkeletonEditorRows } from "../../../components/Skeleton";
import { StatusPill } from "../../../components/StatusPill";
import { useToast } from "../../../components/Toast";
import { ApiError } from "../../../lib/apiClient";
import {
  useCreateCriterion,
  useCriteriaAdminList,
  useDeleteCriterion,
  useQualificationSettings,
  useUpdateCriterion,
  useUpdateQualificationSettings,
  type QualificationCriterionRecord,
} from "../api/qualification-criteria.api";

const inputClass = CONTROL_CLASS;

type Draft = Record<string, { label: string; description: string; weight: string }>;

export function QualificationCriteriaPage() {
  const toast = useToast();
  const criteria = useCriteriaAdminList();
  const settings = useQualificationSettings();
  const updateCriterion = useUpdateCriterion();
  const createCriterion = useCreateCriterion();
  const deleteCriterion = useDeleteCriterion();
  const updateSettings = useUpdateQualificationSettings();

  const [draft, setDraft] = useState<Draft>({});
  const [threshold, setThreshold] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<QualificationCriterionRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Seed the editable drafts from the server copy whenever it (re)loads.
  useEffect(() => {
    if (!criteria.data) return;
    setDraft(
      Object.fromEntries(
        criteria.data.map((criterion) => [
          criterion._id,
          {
            label: criterion.label,
            description: criterion.description ?? "",
            weight: String(criterion.weight),
          },
        ]),
      ),
    );
  }, [criteria.data]);

  useEffect(() => {
    if (settings.data) setThreshold(String(settings.data.recommendThreshold));
  }, [settings.data]);

  const rows = criteria.data ?? [];
  // Weights are relative, so a raw "2" means nothing on its own. What an
  // admin actually needs to know is the share of the score each criterion
  // carries — computed from the drafts so it updates as they type.
  const totalWeight = rows.reduce((sum, row) => sum + (Number(draft[row._id]?.weight) || 0), 0);

  function isDirty(row: QualificationCriterionRecord): boolean {
    const current = draft[row._id];
    if (!current) return false;
    return (
      current.label !== row.label ||
      current.description !== (row.description ?? "") ||
      Number(current.weight) !== row.weight
    );
  }

  async function saveRow(row: QualificationCriterionRecord) {
    const current = draft[row._id];
    setError(null);
    try {
      await updateCriterion.mutateAsync({
        id: row._id,
        payload: {
          label: current.label.trim(),
          description: current.description.trim() || undefined,
          weight: Number(current.weight),
        },
      });
      toast({ message: `${current.label} updated` });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not save that change.");
    }
  }

  async function saveThreshold() {
    setError(null);
    try {
      await updateSettings.mutateAsync({ recommendThreshold: Number(threshold) });
      toast({ message: `Recommendation threshold set to ${threshold}%` });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not save the threshold.");
    }
  }

  return (
    <div>
      <PageHeader
        title="Qualification criteria"
        subtitle="The rubric every lead is screened against. Changes apply to future qualifications — scores already recorded keep the weights they were decided under."
      >
        <Button icon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={() => setAddOpen(true)}>
          Add criterion
        </Button>
      </PageHeader>

      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-600/20">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {criteria.isLoading ? (
            <SkeletonEditorRows />
          ) : rows.length === 0 ? (
            <Card title="No criteria">
              <p className="text-sm text-slate-500">
                Without criteria a lead cannot be scored. Add at least one dimension to screen against.
              </p>
            </Card>
          ) : (
            rows.map((row) => {
              const current = draft[row._id];
              if (!current) return null;
              const share = totalWeight > 0 ? Math.round((Number(current.weight) / totalWeight) * 100) : 0;
              return (
                <div key={row._id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
                  <div className="flex items-start justify-between gap-3">
                    {/* Key is immutable: stored lead scores reference it. */}
                    <StatusPill value={row.key} tone="neutral" />
                    <div className="flex items-center gap-2">
                      <span className="text-xs tabular-nums text-slate-500">{share}% of score</span>
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

                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
                    <div className="sm:col-span-2">
                      <label htmlFor={`label-${row._id}`} className="block text-xs font-medium text-slate-700">Label</label>
                      <input
                        id={`label-${row._id}`}
                        className={`mt-1 ${inputClass}`}
                        value={current.label}
                        onChange={(event) => setDraft({ ...draft, [row._id]: { ...current, label: event.target.value } })}
                      />
                    </div>
                    <div>
                      <label htmlFor={`weight-${row._id}`} className="block text-xs font-medium text-slate-700">Weight</label>
                      <input
                        id={`weight-${row._id}`}
                        type="number"
                        min="0"
                        step="0.5"
                        className={`mt-1 ${inputClass}`}
                        value={current.weight}
                        onChange={(event) => setDraft({ ...draft, [row._id]: { ...current, weight: event.target.value } })}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        className="w-full"
                        variant="secondary"
                        disabled={!isDirty(row) || updateCriterion.isPending}
                        onClick={() => void saveRow(row)}
                      >
                        {isDirty(row) ? "Save" : "Saved"}
                      </Button>
                    </div>
                    <div className="sm:col-span-4">
                      <label htmlFor={`desc-${row._id}`} className="block text-xs font-medium text-slate-700">
                        Description — shown to whoever is scoring
                      </label>
                      <input
                        id={`desc-${row._id}`}
                        className={`mt-1 ${inputClass}`}
                        value={current.description}
                        onChange={(event) => setDraft({ ...draft, [row._id]: { ...current, description: event.target.value } })}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="space-y-4">
          <Card title="Recommendation threshold">
            <p className="text-sm text-slate-500">
              At or above this score the qualify modal recommends qualifying. It is a prompt, not a rule —
              a person still decides.
            </p>
            <div className="mt-3 flex items-end gap-2">
              <div className="flex-1">
                <label htmlFor="threshold" className="block text-xs font-medium text-slate-700">Threshold %</label>
                <input
                  id="threshold"
                  type="number"
                  min="0"
                  max="100"
                  className={`mt-1 ${inputClass}`}
                  value={threshold}
                  onChange={(event) => setThreshold(event.target.value)}
                />
              </div>
              <Button
                variant="secondary"
                disabled={updateSettings.isPending || threshold === String(settings.data?.recommendThreshold ?? "")}
                onClick={() => void saveThreshold()}
              >
                Save
              </Button>
            </div>
          </Card>

          <Card title="How the score works">
            <p className="text-sm text-slate-600">
              Each criterion is scored 0–5. The total is the weighted average as a percentage, using only
              the criteria that were actually scored — anything left unassessed is excluded rather than
              counted as zero, so an unanswered question never drags a good lead down.
            </p>
          </Card>
        </div>
      </div>

      <AddCriterionModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreate={async (payload) => {
          await createCriterion.mutateAsync(payload);
          toast({ message: `${payload.label} added` });
          setAddOpen(false);
        }}
        isPending={createCriterion.isPending}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Remove ${pendingDelete?.label ?? ""}?`}
        confirmLabel="Remove"
        isPending={deleteCriterion.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return;
          void deleteCriterion.mutateAsync(pendingDelete._id).then(() => {
            toast({ message: `${pendingDelete.label} removed` });
            setPendingDelete(null);
          });
        }}
      >
        <p>
          It stops appearing when scoring new leads. Leads already scored against it keep their recorded
          scores — nothing historical is rewritten.
        </p>
      </ConfirmDialog>
    </div>
  );
}

function AddCriterionModal({
  open,
  onClose,
  onCreate,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: { key: string; label: string; description?: string; weight: number }) => Promise<void>;
  isPending: boolean;
}) {
  const [label, setLabel] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [weight, setWeight] = useState("1");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLabel("");
    setKey("");
    setDescription("");
    setWeight("1");
    setError(null);
  }, [open]);

  /** Derive the key from the label so an admin never has to think about casing. */
  function onLabelChange(value: string) {
    const previousSuggestion = label.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
    setLabel(value);
    if (key === "" || key === previousSuggestion) {
      setKey(value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, ""));
    }
  }

  async function submit() {
    setError(null);
    if (!label.trim()) return setError("Label is required");
    if (!/^[A-Z][A-Z0-9_]*$/.test(key)) return setError("Key must be UPPER_SNAKE_CASE");
    try {
      await onCreate({ key, label: label.trim(), description: description.trim() || undefined, weight: Number(weight) });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add that criterion.");
    }
  }

  return (
    <Modal
      open={open}
      title="Add criterion"
      description="A new dimension every lead will be screened against."
      size="md"
      onRequestClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} isPending={isPending} pendingLabel="Adding…">
            Add criterion
          </Button>
        </div>
      }
    >
      {error && <p role="alert" className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-600/20">{error}</p>}
      <div className="space-y-3">
        <div>
          <label htmlFor="new-label" className="block text-xs font-medium text-slate-700">Label<span className="ml-0.5 text-rose-600">*</span></label>
          <input id="new-label" className={`mt-1 ${inputClass}`} value={label} onChange={(e) => onLabelChange(e.target.value)} placeholder="Offtake security" />
        </div>
        <div>
          <label htmlFor="new-key" className="block text-xs font-medium text-slate-700">Key</label>
          <input id="new-key" className={`mt-1 ${inputClass}`} value={key} onChange={(e) => setKey(e.target.value.toUpperCase())} placeholder="OFFTAKE_SECURITY" />
          <p className="mt-1 text-xs text-slate-500">Permanent once created — recorded scores reference it.</p>
        </div>
        <div>
          <label htmlFor="new-desc" className="block text-xs font-medium text-slate-700">Description</label>
          <input id="new-desc" className={`mt-1 ${inputClass}`} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Shown to whoever is scoring" />
        </div>
        <div>
          <label htmlFor="new-weight" className="block text-xs font-medium text-slate-700">Weight</label>
          <input id="new-weight" type="number" min="0" step="0.5" className={`mt-1 ${inputClass}`} value={weight} onChange={(e) => setWeight(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}
