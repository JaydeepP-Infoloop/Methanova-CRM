import { useEffect, useState } from "react";
import { Modal } from "../../../components/Modal";
import { Button } from "../../../components/Button";
import { CONTROL_CLASS } from "../../../components/Field";
import { useToast } from "../../../components/Toast";
import { ApiError } from "../../../lib/apiClient";
import { useParkLead } from "../api/leads.api";

const inputClass = CONTROL_CLASS;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function inAMonthIso(): string {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  return date.toISOString().slice(0, 10);
}

export interface ParkLeadModalProps {
  open: boolean;
  leadId?: string;
  leadLabel: string;
  /** Shown back to the user so it is obvious the stage is not moving. */
  currentStage: string;
  onClose: () => void;
}

export function ParkLeadModal({ open, leadId, leadLabel, currentStage, onClose }: ParkLeadModalProps) {
  const toast = useToast();
  const park = useParkLead(leadId);
  const [reason, setReason] = useState("");
  const [revisitDate, setRevisitDate] = useState(inAMonthIso());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setReason("");
    setRevisitDate(inAMonthIso());
    setError(null);
  }, [open]);

  async function submit() {
    if (!reason.trim()) return setError("A reason is required when parking a lead");
    if (!revisitDate) return setError("Pick a date to revisit this");
    setError(null);
    try {
      await park.mutateAsync({ reason: reason.trim(), revisitDate });
      toast({ message: `${leadLabel} parked until ${revisitDate}` });
      onClose();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not park this lead");
    }
  }

  return (
    <Modal
      open={open}
      title="Park this lead"
      description="For a live deal that has gone quiet and is worth picking up later."
      size="md"
      onRequestClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} isPending={park.isPending} pendingLabel="Parking…">
            Park lead
          </Button>
        </div>
      }
    >
      {error && (
        <p role="alert" className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-600/20">
          {error}
        </p>
      )}

      <p className="mb-4 text-sm text-slate-600">
        The stage does not move — this lead stays at{" "}
        <span className="font-medium text-slate-900">{currentStage.replace(/_/g, " ")}</span> and picks up
        from there when you unpark it. Parking is not the same as marking it dead; for that, move the
        stage rail to Lost.
      </p>

      <div className="space-y-3">
        <div>
          <label htmlFor="park-reason" className="block text-xs font-medium text-slate-700">
            Why are we parking this?<span className="ml-0.5 text-rose-600">*</span>
          </label>
          <input
            id="park-reason"
            className={`mt-1 ${inputClass}`}
            value={reason}
            placeholder="Client deferred the budget decision to next quarter"
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="park-revisit" className="block text-xs font-medium text-slate-700">
            Revisit on<span className="ml-0.5 text-rose-600">*</span>
          </label>
          <input
            id="park-revisit"
            type="date"
            min={todayIso()}
            className={`mt-1 ${inputClass}`}
            value={revisitDate}
            onChange={(event) => setRevisitDate(event.target.value)}
          />
          <p className="mt-1 text-xs text-slate-500">
            My Day surfaces this lead again on this date. Unparking itself still stays a manual action —
            being due for a revisit does not mean it is ready to move.
          </p>
        </div>
      </div>
    </Modal>
  );
}
