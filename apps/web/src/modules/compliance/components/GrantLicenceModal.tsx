import { useEffect, useState } from "react";
import { Button } from "../../../components/Button";
import { CONTROL_CLASS } from "../../../components/Field";
import { Modal } from "../../../components/Modal";
import { useToast } from "../../../components/Toast";
import { ApiError } from "../../../lib/apiClient";
import { useTransitionLicence } from "../api/licences.api";

export interface GrantLicenceModalProps {
  open: boolean;
  licenceId?: string;
  licenceLabel: string;
  onClose: () => void;
}

/**
 * The one transition that needs a value alongside it: marking a licence
 * GRANTED without recording when it expires would leave the existing
 * GRANTED → EXPIRED move in `TRANSITION_MAP` with nothing to ever trigger it.
 * The server requires `validUntil` on this specific move (see
 * `licences.validation.ts`); this is the one place that collects it.
 */
export function GrantLicenceModal({ open, licenceId, licenceLabel, onClose }: GrantLicenceModalProps) {
  const toast = useToast();
  const grant = useTransitionLicence();
  const [validUntil, setValidUntil] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setValidUntil("");
    setError(null);
  }, [open]);

  async function submit() {
    if (!licenceId) return;
    if (!validUntil) {
      setError("A validity/expiry date is required");
      return;
    }
    setError(null);
    try {
      await grant.mutateAsync({ id: licenceId, to: "GRANTED", validUntil });
      toast({ message: `${licenceLabel} marked granted` });
      onClose();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not mark this granted");
    }
  }

  return (
    <Modal
      open={open}
      title="Mark licence granted"
      description={licenceLabel}
      size="md"
      onRequestClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} isPending={grant.isPending} pendingLabel="Saving…">
            Mark granted
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
        <label htmlFor="licence-valid-until" className="block text-xs font-medium text-slate-700">
          Valid until<span className="ml-0.5 text-rose-600">*</span>
        </label>
        <input
          id="licence-valid-until"
          type="date"
          className={`mt-1 ${CONTROL_CLASS}`}
          value={validUntil}
          onChange={(event) => setValidUntil(event.target.value)}
        />
      </div>
    </Modal>
  );
}
