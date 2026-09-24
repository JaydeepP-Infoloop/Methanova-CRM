import {
  computeQualificationScore,
  QUALIFICATION_MAX_SCORE,
  QualificationDecision,
} from "@methanova/shared-types";
import { useEffect, useState } from "react";
import { Button } from "../../../components/Button";
import { Field } from "../../../components/Field";
import { Modal } from "../../../components/Modal";
import { useToast } from "../../../components/Toast";
import { ApiError } from "../../../lib/apiClient";
import { croreToPaise } from "../../../lib/formatters";
import { useQualificationCriteria, useQualifyLead } from "../api/qualification.api";
import { useQualificationSettings } from "../../admin/api/qualification-criteria.api";

const SCORE_LABELS = ["Not assessed", "Very weak", "Weak", "Moderate", "Strong", "Very strong"];

/** Used only while the setting is still loading; the stored value is the real one. */
const FALLBACK_RECOMMEND_THRESHOLD = 60;

export interface QualifyLeadModalProps {
  open: boolean;
  leadId?: string;
  leadLabel?: string;
  onClose: () => void;
}

export function QualifyLeadModal({ open, leadId, leadLabel, onClose }: QualifyLeadModalProps) {
  const toast = useToast();
  const criteria = useQualificationCriteria();
  const qualify = useQualifyLead(leadId);
  // Read from the admin-editable setting rather than a constant, so retuning
  // the threshold does not require a deploy.
  const settings = useQualificationSettings();
  const recommendThreshold = settings.data?.recommendThreshold ?? FALLBACK_RECOMMEND_THRESHOLD;

  const [scores, setScores] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  /** Crore strings, converted to integer paise on submit — same unit as the intake form. */
  const [budgetMinCrore, setBudgetMinCrore] = useState("");
  const [budgetMaxCrore, setBudgetMaxCrore] = useState("");
  const [reason, setReason] = useState("");
  const [showReason, setShowReason] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setScores({});
    setNotes({});
    setBudgetMinCrore("");
    setBudgetMaxCrore("");
    setReason("");
    setShowReason(false);
    setErrors({});
    setBanner(null);
  }, [open]);

  const scored = Object.entries(scores)
    .filter(([, value]) => value > 0)
    .map(([criterionKey, value]) => ({ criterionKey, score: value }));

  // Same function the server uses, so this preview cannot disagree with the stored score.
  const totalScore = computeQualificationScore(
    scored,
    (criteria.data ?? []).map((criterion) => ({ key: criterion.key, weight: criterion.weight })),
  );

  async function submit(decision: (typeof QualificationDecision)[keyof typeof QualificationDecision]) {
    setBanner(null);
    if (scored.length === 0) {
      setErrors({ scores: "Score at least one criterion" });
      return;
    }
    if (decision === QualificationDecision.DISQUALIFIED && !reason.trim()) {
      setShowReason(true);
      setErrors({ reason: "A reason is required to disqualify" });
      return;
    }
    const budgetMinPaise = croreToPaise(budgetMinCrore);
    const budgetMaxPaise = croreToPaise(budgetMaxCrore);
    // Half a band is a legitimate answer ("at least 5 crore"); an inverted one
    // never is. Caught here as well as server-side so the fix happens in place.
    if (budgetMinPaise !== null && budgetMaxPaise !== null && budgetMinPaise > budgetMaxPaise) {
      setErrors({ budget: "The top of the range cannot be below the bottom" });
      return;
    }
    setErrors({});
    try {
      await qualify.mutateAsync({
        scores: scored.map((entry) => ({ ...entry, note: notes[entry.criterionKey]?.trim() || undefined })),
        decision,
        disqualificationReason: decision === QualificationDecision.DISQUALIFIED ? reason.trim() : undefined,
        budgetMinPaise,
        budgetMaxPaise,
      });
      toast({
        message:
          decision === QualificationDecision.QUALIFIED
            ? `Qualified at ${totalScore}% — moved to Qualification`
            : "Lead disqualified and marked lost",
      });
      onClose();
    } catch (caught) {
      if (caught instanceof ApiError) {
        setBanner(caught.body.error ?? caught.message);
        return;
      }
      setBanner(caught instanceof Error ? caught.message : "Could not record that decision.");
    }
  }

  const recommended = totalScore >= recommendThreshold;

  return (
    <Modal
      open={open}
      title="Qualify lead"
      description={leadLabel}
      onRequestClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <span className="text-slate-500">Score </span>
            <span className="text-lg font-semibold tabular-nums text-slate-900">{totalScore}%</span>
            {scored.length > 0 && (
              <span className={`ml-2 text-xs ${recommended ? "text-emerald-700" : "text-amber-700"}`}>
                {recommended ? "Above threshold" : `Below ${recommendThreshold}% threshold`}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void submit(QualificationDecision.DISQUALIFIED)} disabled={qualify.isPending}>
              Disqualify
            </Button>
            <Button onClick={() => void submit(QualificationDecision.QUALIFIED)} isPending={qualify.isPending} pendingLabel="Saving…">
              Qualify
            </Button>
          </div>
        </div>
      }
    >
      {banner && (
        <p role="alert" className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-600/20">
          {banner}
        </p>
      )}
      {errors.scores && <p className="mb-3 text-sm text-rose-600">{errors.scores}</p>}

      <p className="mb-4 text-sm text-slate-500">
        Score each dimension you have a basis to judge. Anything left at "Not assessed" is excluded from
        the score rather than counted as zero.
      </p>

      <div className="space-y-4">
        {criteria.data?.map((criterion) => (
          <div key={criterion._id} className="rounded-xl p-4 ring-1 ring-slate-200">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-900">{criterion.label}</p>
                {criterion.description && <p className="mt-0.5 text-xs text-slate-500">{criterion.description}</p>}
              </div>
              <span className="shrink-0 text-xs tabular-nums text-slate-400">weight {criterion.weight}</span>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {Array.from({ length: QUALIFICATION_MAX_SCORE + 1 }, (_, value) => {
                const selected = (scores[criterion.key] ?? 0) === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={selected}
                    aria-label={`${criterion.label}: ${SCORE_LABELS[value]}`}
                    onClick={() => setScores((current) => ({ ...current, [criterion.key]: value }))}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ring-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold ${
                      selected
                        ? "bg-methanova-greenTint text-methanova-green ring-methanova-green/30"
                        : "bg-white text-slate-600 ring-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {value === 0 ? "—" : value}
                  </button>
                );
              })}
              <span className="self-center pl-1 text-xs text-slate-500">
                {SCORE_LABELS[scores[criterion.key] ?? 0]}
              </span>
            </div>

            <div className="mt-3">
            <Field label="Note" htmlFor={`note-${criterion.key}`} hint="Optional">
              <input
                id={`note-${criterion.key}`}
                placeholder="Note (optional)"
                value={notes[criterion.key] ?? ""}
                onChange={(event) => setNotes((current) => ({ ...current, [criterion.key]: event.target.value }))}
              />
            </Field>
            </div>
          </div>
        ))}
      </div>

      {/* Budget sits with the assessment rather than on the lead itself: the
          SoW ties it to the Qualified stage, so it is an output of screening,
          stored with the scores and the date that produced it. */}
      <div className="mt-4 rounded-xl p-4 ring-1 ring-slate-200">
        <p className="text-sm font-medium text-slate-900">Budget range (optional)</p>
        <p className="mt-0.5 text-xs text-slate-500">
          What the client has indicated they can spend. Either end on its own is fine — "at least 5 crore"
          is a real answer.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="From (₹ crore)" htmlFor="budgetMinCrore" error={errors.budget}>
            <input
              id="budgetMinCrore"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={budgetMinCrore}
              onChange={(event) => setBudgetMinCrore(event.target.value)}
            />
          </Field>
          <Field label="To (₹ crore)" htmlFor="budgetMaxCrore">
            <input
              id="budgetMaxCrore"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={budgetMaxCrore}
              onChange={(event) => setBudgetMaxCrore(event.target.value)}
            />
          </Field>
        </div>
      </div>

      {(showReason || reason) && (
        <div className="mt-4">
        <Field
          label="Reason for disqualifying"
          htmlFor="disqualificationReason"
          required
          error={errors.reason}
        >
          <input
            id="disqualificationReason"
            placeholder="Why is this not worth pursuing?"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
        </div>
      )}
    </Modal>
  );
}
