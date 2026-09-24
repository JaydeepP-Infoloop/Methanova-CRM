import { useEffect, useState } from "react";
import { Button } from "../../../components/Button";
import { CONTROL_CLASS } from "../../../components/Field";
import { Modal } from "../../../components/Modal";
import { useToast } from "../../../components/Toast";
import { ApiError } from "../../../lib/apiClient";
import { formatPaise } from "../../../lib/formatters";
import { useLeadLabels } from "../api/lead-lookup";
import { mouApi } from "../api/mou.api";
import { quotationsApi } from "../api/quotations.api";
import type { MouRow } from "../types";

const inputClass = CONTROL_CLASS;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function rupeesToPaiseLoose(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}
function paiseToRupeesLoose(paise: number): string {
  return String(paise / 100);
}

export interface CreateMouModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (mou: MouRow) => void;
}

/** Only a quotation the client has actually accepted can become the basis an MOU locks onto. */
export function CreateMouModal({ open, onClose, onCreated }: CreateMouModalProps) {
  const toast = useToast();
  const create = mouApi.useCreate();
  const quotations = quotationsApi.useList();
  const leadLabels = useLeadLabels();

  const acceptedQuotations = (quotations.data ?? []).filter((q) => q.status === "ACCEPTED");

  const [acceptedQuotationId, setAcceptedQuotationId] = useState("");
  const [mouDate, setMouDate] = useState(todayIso());
  const [feeRupees, setFeeRupees] = useState("");
  const [contractValueRupees, setContractValueRupees] = useState("");
  const [feeAdjustable, setFeeAdjustable] = useState(false);
  const [civilScope, setCivilScope] = useState<"METHANOVA" | "CLIENT">("CLIENT");
  const [targetCommissioningDate, setTargetCommissioningDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setAcceptedQuotationId("");
    setMouDate(todayIso());
    setFeeRupees("");
    setContractValueRupees("");
    setFeeAdjustable(false);
    setCivilScope("CLIENT");
    setTargetCommissioningDate("");
    setError(null);
  }, [open]);

  const selectedQuotation = acceptedQuotations.find((q) => q._id === acceptedQuotationId);

  function selectQuotation(id: string) {
    setAcceptedQuotationId(id);
    const quotation = acceptedQuotations.find((q) => q._id === id);
    if (quotation && !contractValueRupees) {
      setContractValueRupees(paiseToRupeesLoose(quotation.totalPaise));
    }
  }

  async function submit() {
    setError(null);
    if (!acceptedQuotationId) return setError("Pick an accepted quotation");
    if (!feeRupees || Number(feeRupees) < 0) return setError("Enter the MOU fee");
    if (!targetCommissioningDate) return setError("Pick a target commissioning date");

    try {
      const created = await create.mutateAsync({
        leadId: selectedQuotation?.leadId,
        acceptedQuotationId,
        mouDate,
        feePaise: rupeesToPaiseLoose(feeRupees),
        contractValuePaise: contractValueRupees ? rupeesToPaiseLoose(contractValueRupees) : undefined,
        feeAdjustable,
        civilScope,
        targetCommissioningDate,
      } as unknown as Partial<MouRow>);
      toast({ message: "MOU created" });
      onCreated?.(created);
      onClose();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not create that MOU");
    }
  }

  return (
    <Modal
      open={open}
      title="New MOU"
      description="Locks its technical and commercial basis to an accepted quotation."
      size="md"
      onRequestClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} isPending={create.isPending} pendingLabel="Creating…">
            Create MOU
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
          <label htmlFor="mou-quotation" className="block text-xs font-medium text-slate-700">
            Accepted quotation<span className="ml-0.5 text-rose-600">*</span>
          </label>
          <select
            id="mou-quotation"
            className={`mt-1 ${inputClass}`}
            value={acceptedQuotationId}
            onChange={(event) => selectQuotation(event.target.value)}
          >
            <option value="">Select an accepted quotation…</option>
            {acceptedQuotations.map((quotation) => {
              const lead = leadLabels.get(quotation.leadId);
              return (
                <option key={quotation._id} value={quotation._id}>
                  {lead?.leadCode ?? quotation.leadId} · {lead?.companyName ?? ""} · {formatPaise(quotation.totalPaise)}
                </option>
              );
            })}
          </select>
          {acceptedQuotations.length === 0 && (
            <p className="mt-1 text-xs text-slate-500">No quotation is in ACCEPTED status yet.</p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="mou-date" className="block text-xs font-medium text-slate-700">
              MOU date
            </label>
            <input
              id="mou-date"
              type="date"
              className={`mt-1 ${inputClass}`}
              value={mouDate}
              onChange={(event) => setMouDate(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="mou-commissioning" className="block text-xs font-medium text-slate-700">
              Target commissioning date<span className="ml-0.5 text-rose-600">*</span>
            </label>
            <input
              id="mou-commissioning"
              type="date"
              min={todayIso()}
              className={`mt-1 ${inputClass}`}
              value={targetCommissioningDate}
              onChange={(event) => setTargetCommissioningDate(event.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="mou-fee" className="block text-xs font-medium text-slate-700">
              MOU fee (₹)<span className="ml-0.5 text-rose-600">*</span>
            </label>
            <input
              id="mou-fee"
              type="number"
              min="0"
              className={`mt-1 ${inputClass}`}
              value={feeRupees}
              onChange={(event) => setFeeRupees(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="mou-value" className="block text-xs font-medium text-slate-700">
              Contract value (₹)
            </label>
            <input
              id="mou-value"
              type="number"
              min="0"
              className={`mt-1 ${inputClass}`}
              value={contractValueRupees}
              onChange={(event) => setContractValueRupees(event.target.value)}
            />
            <p className="mt-1 text-xs text-slate-500">Defaults to the quotation's total; edit if final terms differ.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="mou-civil" className="block text-xs font-medium text-slate-700">
              Civil works scope
            </label>
            <select
              id="mou-civil"
              className={`mt-1 ${inputClass}`}
              value={civilScope}
              onChange={(event) => setCivilScope(event.target.value as "METHANOVA" | "CLIENT")}
            >
              <option value="CLIENT">Client</option>
              <option value="METHANOVA">Methanova</option>
            </select>
            <p className="mt-1 text-xs text-slate-500">Structural drawings stay Methanova's scope either way.</p>
          </div>
          <label className="mt-6 flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={feeAdjustable}
              onChange={(event) => setFeeAdjustable(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-methanova-green focus-visible:ring-methanova-gold"
            />
            Fee is adjustable against the first bill
          </label>
        </div>
      </div>
    </Modal>
  );
}
