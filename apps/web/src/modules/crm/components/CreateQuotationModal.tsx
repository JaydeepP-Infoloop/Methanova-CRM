import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../../../components/Button";
import { CONTROL_CLASS } from "../../../components/Field";
import { Modal } from "../../../components/Modal";
import { useToast } from "../../../components/Toast";
import { ApiError } from "../../../lib/apiClient";
import { useLeadList } from "../api/leads.api";
import { quotationsApi } from "../api/quotations.api";
import type { PaymentMilestone, PriceLine, QuotationRow } from "../types";

const inputClass = CONTROL_CLASS;

interface PriceLineDraft extends PriceLine {
  key: string;
}
interface MilestoneDraft extends PaymentMilestone {
  key: string;
}

let nextKey = 1;
function freshKey(): string {
  return String(nextKey++);
}

function emptyPriceLine(): PriceLineDraft {
  return { key: freshKey(), description: "", amountPaise: 0, hsnSac: "" };
}
function emptyMilestone(): MilestoneDraft {
  return { key: freshKey(), description: "", percentage: 0, dueOnMilestone: "" };
}

function rupeesToPaiseLoose(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}
function paiseToRupeesLoose(paise: number): string {
  return String(paise / 100);
}

export interface CreateQuotationModalProps {
  open: boolean;
  onClose: () => void;
  /** Present when revising an existing quotation — prefills every field and requires a reason. */
  revisionOf?: QuotationRow | null;
  onCreated?: (quotation: QuotationRow) => void;
}

/**
 * One panel, not a multi-step wizard: a quotation has fewer interdependent
 * fields than lead intake does, and nothing here gates a later step's
 * validity the way geography cascades or contact rules do.
 */
export function CreateQuotationModal({ open, onClose, revisionOf, onCreated }: CreateQuotationModalProps) {
  const toast = useToast();
  const create = quotationsApi.useCreate();
  const leads = useLeadList({ page: 1, pageSize: 100, sort: "newest" });

  const [leadId, setLeadId] = useState("");
  const [revisionReason, setRevisionReason] = useState("");
  const [capacityTpd, setCapacityTpd] = useState("");
  const [feedstockBasis, setFeedstockBasis] = useState("");
  const [expectedCbgTpd, setExpectedCbgTpd] = useState("");
  const [priceLines, setPriceLines] = useState<PriceLineDraft[]>([emptyPriceLine()]);
  const [scopeInclusions, setScopeInclusions] = useState("");
  const [scopeExclusions, setScopeExclusions] = useState("");
  const [templateName, setTemplateName] = useState("Standard milestones");
  const [milestones, setMilestones] = useState<MilestoneDraft[]>([emptyMilestone()]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (revisionOf) {
      setLeadId(revisionOf.leadId);
      setRevisionReason("");
      setCapacityTpd(String(revisionOf.capacityTpd ?? ""));
      setFeedstockBasis(revisionOf.feedstockBasis ?? "");
      setExpectedCbgTpd(String(revisionOf.expectedCbgTpd ?? ""));
      setPriceLines(
        (revisionOf.priceLines ?? []).length > 0
          ? revisionOf.priceLines.map((line) => ({ ...line, key: freshKey() }))
          : [emptyPriceLine()],
      );
      setScopeInclusions((revisionOf.scopeInclusions ?? []).join("\n"));
      setScopeExclusions((revisionOf.scopeExclusions ?? []).join("\n"));
      setTemplateName(revisionOf.paymentTermsTemplate?.name ?? "Standard milestones");
      setMilestones(
        (revisionOf.paymentTermsTemplate?.milestones ?? []).length > 0
          ? revisionOf.paymentTermsTemplate.milestones.map((m) => ({ ...m, key: freshKey() }))
          : [emptyMilestone()],
      );
      setNotes(revisionOf.notes ?? "");
    } else {
      setLeadId("");
      setRevisionReason("");
      setCapacityTpd("");
      setFeedstockBasis("");
      setExpectedCbgTpd("");
      setPriceLines([emptyPriceLine()]);
      setScopeInclusions("");
      setScopeExclusions("");
      setTemplateName("Standard milestones");
      setMilestones([emptyMilestone()]);
      setNotes("");
    }
  }, [open, revisionOf]);

  const totalPaise = priceLines.reduce((sum, line) => sum + line.amountPaise, 0);
  const milestoneTotal = milestones.reduce((sum, m) => sum + m.percentage, 0);

  async function submit() {
    setError(null);
    if (!leadId) return setError("Pick a lead");
    if (revisionOf && !revisionReason.trim()) return setError("A reason is required when revising a quotation");
    if (!capacityTpd || Number(capacityTpd) <= 0) return setError("Capacity must be greater than zero");
    if (!feedstockBasis.trim()) return setError("Feedstock basis is required");
    if (priceLines.some((line) => !line.description.trim() || !line.hsnSac.trim())) {
      return setError("Every price line needs a description and an HSN/SAC code");
    }
    if (milestones.some((m) => !m.description.trim())) {
      return setError("Every payment milestone needs a description");
    }
    if (Math.round(milestoneTotal * 100) !== 10000) {
      return setError(`Milestone percentages must sum to 100 (currently ${milestoneTotal})`);
    }

    try {
      const created = await create.mutateAsync({
        leadId,
        parentQuotationId: revisionOf?._id,
        revisionReason: revisionOf ? revisionReason.trim() : undefined,
        capacityTpd: Number(capacityTpd),
        feedstockBasis: feedstockBasis.trim(),
        expectedCbgTpd: Number(expectedCbgTpd) || 0,
        priceLines: priceLines.map(({ key: _key, ...line }) => line),
        scopeInclusions: scopeInclusions.split("\n").map((s) => s.trim()).filter(Boolean),
        scopeExclusions: scopeExclusions.split("\n").map((s) => s.trim()).filter(Boolean),
        paymentTermsTemplate: {
          name: templateName.trim() || "Payment terms",
          milestones: milestones.map(({ key: _key, ...m }) => m),
        },
        notes: notes.trim() || undefined,
      } as unknown as Partial<QuotationRow>);
      toast({ message: revisionOf ? "Revision created" : "Quotation created" });
      onCreated?.(created);
      onClose();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not save that quotation");
    }
  }

  return (
    <Modal
      open={open}
      title={revisionOf ? `Revise ${revisionOf.leadId ? "quotation" : ""}` : "New quotation"}
      description={
        revisionOf
          ? "Creates a new revision. The one you're revising is marked superseded automatically."
          : "A priced proposal against a lead."
      }
      size="lg"
      onRequestClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} isPending={create.isPending} pendingLabel="Saving…">
            {revisionOf ? "Create revision" : "Create quotation"}
          </Button>
        </div>
      }
    >
      {error && (
        <p role="alert" className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-600/20">
          {error}
        </p>
      )}

      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="q-lead" className="block text-xs font-medium text-slate-700">
              Lead<span className="ml-0.5 text-rose-600">*</span>
            </label>
            <select
              id="q-lead"
              className={`mt-1 ${inputClass}`}
              value={leadId}
              disabled={Boolean(revisionOf)}
              onChange={(event) => setLeadId(event.target.value)}
            >
              <option value="">Select a lead…</option>
              {(leads.data?.items ?? []).map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.leadCode} · {lead.companyName}
                </option>
              ))}
            </select>
          </div>
          {revisionOf && (
            <div>
              <label htmlFor="q-reason" className="block text-xs font-medium text-slate-700">
                Reason for this revision<span className="ml-0.5 text-rose-600">*</span>
              </label>
              <input
                id="q-reason"
                className={`mt-1 ${inputClass}`}
                value={revisionReason}
                placeholder="Client asked for a lower-capacity option"
                onChange={(event) => setRevisionReason(event.target.value)}
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="q-capacity" className="block text-xs font-medium text-slate-700">
              Capacity (TPD)<span className="ml-0.5 text-rose-600">*</span>
            </label>
            <input
              id="q-capacity"
              type="number"
              min="0"
              className={`mt-1 ${inputClass}`}
              value={capacityTpd}
              onChange={(event) => setCapacityTpd(event.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="q-feedstock" className="block text-xs font-medium text-slate-700">
              Feedstock basis<span className="ml-0.5 text-rose-600">*</span>
            </label>
            <input
              id="q-feedstock"
              className={`mt-1 ${inputClass}`}
              placeholder="10 TPD cattle dung + 5 TPD press mud"
              value={feedstockBasis}
              onChange={(event) => setFeedstockBasis(event.target.value)}
            />
          </div>
        </div>
        <div>
          <label htmlFor="q-cbg" className="block text-xs font-medium text-slate-700">
            Expected CBG (TPD)
          </label>
          <input
            id="q-cbg"
            type="number"
            min="0"
            className={`mt-1 w-40 ${inputClass}`}
            value={expectedCbgTpd}
            onChange={(event) => setExpectedCbgTpd(event.target.value)}
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-700">Price lines</p>
            <span className="text-xs tabular-nums text-slate-500">Total: ₹{(totalPaise / 100).toLocaleString("en-IN")}</span>
          </div>
          <div className="mt-1 space-y-2">
            {priceLines.map((line, index) => (
              <div key={line.key} className="grid grid-cols-12 gap-2">
                <input
                  className={`col-span-5 ${inputClass}`}
                  placeholder="Description"
                  value={line.description}
                  onChange={(event) =>
                    setPriceLines((current) =>
                      current.map((l) => (l.key === line.key ? { ...l, description: event.target.value } : l)),
                    )
                  }
                />
                <input
                  className={`col-span-3 ${inputClass}`}
                  placeholder="HSN/SAC"
                  value={line.hsnSac}
                  onChange={(event) =>
                    setPriceLines((current) =>
                      current.map((l) => (l.key === line.key ? { ...l, hsnSac: event.target.value } : l)),
                    )
                  }
                />
                <input
                  type="number"
                  min="0"
                  className={`col-span-3 ${inputClass}`}
                  placeholder="Amount (₹)"
                  value={paiseToRupeesLoose(line.amountPaise)}
                  onChange={(event) =>
                    setPriceLines((current) =>
                      current.map((l) =>
                        l.key === line.key ? { ...l, amountPaise: rupeesToPaiseLoose(event.target.value) } : l,
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  disabled={priceLines.length === 1}
                  onClick={() => setPriceLines((current) => current.filter((l) => l.key !== line.key))}
                  aria-label={`Remove price line ${index + 1}`}
                  className="col-span-1 flex items-center justify-center rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setPriceLines((current) => [...current, emptyPriceLine()])}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-methanova-green hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Add price line
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="q-inclusions" className="block text-xs font-medium text-slate-700">
              Scope inclusions — one per line
            </label>
            <textarea
              id="q-inclusions"
              rows={3}
              className={`mt-1 ${inputClass}`}
              value={scopeInclusions}
              onChange={(event) => setScopeInclusions(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="q-exclusions" className="block text-xs font-medium text-slate-700">
              Scope exclusions — one per line
            </label>
            <textarea
              id="q-exclusions"
              rows={3}
              className={`mt-1 ${inputClass}`}
              value={scopeExclusions}
              onChange={(event) => setScopeExclusions(event.target.value)}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="q-template-name" className="block text-xs font-medium text-slate-700">
              Payment terms template
            </label>
            <span className={`text-xs tabular-nums ${Math.round(milestoneTotal * 100) === 10000 ? "text-slate-500" : "text-rose-600"}`}>
              {milestoneTotal}% of 100%
            </span>
          </div>
          <input
            id="q-template-name"
            className={`mt-1 ${inputClass}`}
            value={templateName}
            onChange={(event) => setTemplateName(event.target.value)}
          />
          <div className="mt-2 space-y-2">
            {milestones.map((milestone, index) => (
              <div key={milestone.key} className="grid grid-cols-12 gap-2">
                <input
                  className={`col-span-5 ${inputClass}`}
                  placeholder="Milestone"
                  value={milestone.description}
                  onChange={(event) =>
                    setMilestones((current) =>
                      current.map((m) => (m.key === milestone.key ? { ...m, description: event.target.value } : m)),
                    )
                  }
                />
                <input
                  className={`col-span-4 ${inputClass}`}
                  placeholder="Due on (optional)"
                  value={milestone.dueOnMilestone ?? ""}
                  onChange={(event) =>
                    setMilestones((current) =>
                      current.map((m) => (m.key === milestone.key ? { ...m, dueOnMilestone: event.target.value } : m)),
                    )
                  }
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  className={`col-span-2 ${inputClass}`}
                  placeholder="%"
                  value={milestone.percentage || ""}
                  onChange={(event) =>
                    setMilestones((current) =>
                      current.map((m) =>
                        m.key === milestone.key ? { ...m, percentage: Number(event.target.value) || 0 } : m,
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  disabled={milestones.length === 1}
                  onClick={() => setMilestones((current) => current.filter((m) => m.key !== milestone.key))}
                  aria-label={`Remove milestone ${index + 1}`}
                  className="col-span-1 flex items-center justify-center rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setMilestones((current) => [...current, emptyMilestone()])}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-methanova-green hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Add milestone
          </button>
        </div>

        <div>
          <label htmlFor="q-notes" className="block text-xs font-medium text-slate-700">
            Notes
          </label>
          <textarea id="q-notes" rows={2} className={`mt-1 ${inputClass}`} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </div>
      </div>
    </Modal>
  );
}
