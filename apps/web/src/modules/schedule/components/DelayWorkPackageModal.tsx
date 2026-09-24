import { useEffect, useState } from "react";
import { WORK_PACKAGE_DELAY_REASON_LABELS, WorkPackageDelayReason } from "@methanova/shared-types";
import { Button } from "../../../components/Button";
import { CONTROL_CLASS } from "../../../components/Field";
import { Modal } from "../../../components/Modal";
import { useToast } from "../../../components/Toast";
import { ApiError } from "../../../lib/apiClient";
import { useTransitionWorkPackage } from "../api/work-packages.api";

export interface DelayWorkPackageModalProps {
  open: boolean;
  workPackageId?: string;
  workPackageLabel: string;
  onClose: () => void;
}

/** The one transition that needs a reason alongside it — the server requires a `delayReason` from the SoW's fixed list on this specific move (see `work-packages.validation.ts`). */
export function DelayWorkPackageModal({ open, workPackageId, workPackageLabel, onClose }: DelayWorkPackageModalProps) {
  const toast = useToast();
  const hold = useTransitionWorkPackage();
  const [delayReason, setDelayReason] = useState<WorkPackageDelayReason | "">("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDelayReason("");
    setError(null);
  }, [open]);

  async function submit() {
    if (!workPackageId) return;
    if (!delayReason) {
      setError("Pick a reason for putting this work package on hold");
      return;
    }
    setError(null);
    try {
      await hold.mutateAsync({ id: workPackageId, to: "ON_HOLD", delayReason });
      toast({ message: `${workPackageLabel} put on hold` });
      onClose();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not put this on hold");
    }
  }

  return (
    <Modal
      open={open}
      title="Put work package on hold"
      description={workPackageLabel}
      size="md"
      onRequestClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} isPending={hold.isPending} pendingLabel="Saving…">
            Put on hold
          </Button>
        </div>
      }
    >
      {error && (
        <p role="alert" className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-600/20">
          {error}
        </p>
      )}
      <div>
        <label htmlFor="work-package-delay-reason" className="block text-xs font-medium text-slate-700">
          Reason<span className="ml-0.5 text-rose-600">*</span>
        </label>
        <select
          id="work-package-delay-reason"
          className={`mt-1 ${CONTROL_CLASS}`}
          value={delayReason}
          onChange={(event) => setDelayReason(event.target.value as WorkPackageDelayReason | "")}
        >
          <option value="">Select a reason…</option>
          {Object.values(WorkPackageDelayReason).map((reason) => (
            <option key={reason} value={reason}>
              {WORK_PACKAGE_DELAY_REASON_LABELS[reason]}
            </option>
          ))}
        </select>
      </div>
    </Modal>
  );
}
