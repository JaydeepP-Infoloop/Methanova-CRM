import { useEffect, useState } from "react";
import { Modal } from "../../../components/Modal";
import { Button } from "../../../components/Button";
import { CONTROL_CLASS } from "../../../components/Field";
import { useToast } from "../../../components/Toast";
import { ApiError } from "../../../lib/apiClient";
import { useRescheduleNextAction } from "../api/leads.api";

const inputClass = CONTROL_CLASS;

export interface RescheduleNextActionModalProps {
  open: boolean;
  leadId?: string;
  leadLabel: string;
  currentAction: string;
  currentDate: string;
  onClose: () => void;
}

/**
 * Changes the commitment text and date directly, without logging an activity.
 * This is deliberately a different action from "Log follow-up": that one
 * records that contact happened and, in doing so, sets a new promise with
 * provenance behind it. This one just moves the date on a promise nothing has
 * happened against yet — which is why the server drops the old provenance the
 * moment either field changes here, rather than leave it pointing at whatever
 * follow-up last set it.
 */
export function RescheduleNextActionModal({
  open,
  leadId,
  leadLabel,
  currentAction,
  currentDate,
  onClose,
}: RescheduleNextActionModalProps) {
  const toast = useToast();
  const reschedule = useRescheduleNextAction(leadId);
  const [nextAction, setNextAction] = useState(currentAction);
  const [nextActionDate, setNextActionDate] = useState(currentDate.slice(0, 10));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNextAction(currentAction);
    setNextActionDate(currentDate.slice(0, 10));
    setError(null);
  }, [open, currentAction, currentDate]);

  async function submit() {
    if (!nextAction.trim()) return setError("Describe what is owed next");
    if (!nextActionDate) return setError("Pick a date");
    setError(null);
    try {
      await reschedule.mutateAsync({ nextAction: nextAction.trim(), nextActionDate });
      toast({ message: `${leadLabel}'s next action rescheduled` });
      onClose();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not reschedule this");
    }
  }

  return (
    <Modal
      open={open}
      title="Reschedule next action"
      description="Moves the commitment without recording that contact happened."
      size="md"
      onRequestClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} isPending={reschedule.isPending} pendingLabel="Saving…">
            Save
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
          <label htmlFor="reschedule-action" className="block text-xs font-medium text-slate-700">
            What is owed<span className="ml-0.5 text-rose-600">*</span>
          </label>
          <input
            id="reschedule-action"
            className={`mt-1 ${inputClass}`}
            value={nextAction}
            onChange={(event) => setNextAction(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="reschedule-date" className="block text-xs font-medium text-slate-700">
            Due<span className="ml-0.5 text-rose-600">*</span>
          </label>
          <input
            id="reschedule-date"
            type="date"
            className={`mt-1 ${inputClass}`}
            value={nextActionDate}
            onChange={(event) => setNextActionDate(event.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
}
