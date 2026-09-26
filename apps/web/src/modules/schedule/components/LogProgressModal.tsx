import { TERMINAL_WORK_PACKAGE_STATUSES } from "@methanova/shared-types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "../../../components/Button";
import { CONTROL_CLASS, Field } from "../../../components/Field";
import { Modal } from "../../../components/Modal";
import { useToast } from "../../../components/Toast";
import { ApiError, apiClient } from "../../../lib/apiClient";
import { queryKeys, RESOURCE } from "../../../lib/queryKeys";
import { workPackagesApi } from "../api/work-packages.api";

export interface LogProgressModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Records a percent-complete entry. The server re-syncs the work package's
 * own `percentComplete` from it in the same transaction, so the work
 * package, project progress and dashboard caches are all refreshed here.
 */
export function LogProgressModal({ open, onClose }: LogProgressModalProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const workPackages = workPackagesApi.useList();
  const [workPackageId, setWorkPackageId] = useState("");
  const [percent, setPercent] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: (payload: { workPackageId: string; percentComplete: number; notes?: string }) =>
      apiClient("/api/schedule/progress-updates", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () =>
      Promise.all(
        [RESOURCE.progressUpdates, RESOURCE.workPackages, RESOURCE.projects, RESOURCE.dashboard].map((resource) =>
          queryClient.invalidateQueries({ queryKey: queryKeys.resource(resource) }),
        ),
      ),
  });

  useEffect(() => {
    if (!open) return;
    setWorkPackageId("");
    setPercent("");
    setNotes("");
    setError(null);
  }, [open]);

  const open_ = (workPackages.data ?? []).filter((row) => !TERMINAL_WORK_PACKAGE_STATUSES.includes(row.status));

  async function submit() {
    const value = Number(percent);
    if (!workPackageId) return setError("Pick a work package");
    if (percent.trim() === "" || !Number.isFinite(value) || value < 0 || value > 100) {
      return setError("Percent complete must be between 0 and 100");
    }
    setError(null);
    try {
      await create.mutateAsync({ workPackageId, percentComplete: value, notes: notes.trim() || undefined });
      toast({ message: "Progress recorded" });
      onClose();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not record that progress update");
    }
  }

  return (
    <Modal
      open={open}
      title="New progress update"
      size="md"
      onRequestClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} isPending={create.isPending} pendingLabel="Saving…">
            Record progress
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
        <Field label="Work package" htmlFor="progress-work-package" required>
          <select
            id="progress-work-package"
            className={CONTROL_CLASS}
            value={workPackageId}
            onChange={(event) => setWorkPackageId(event.target.value)}
          >
            <option value="">Select a work package…</option>
            {open_.map((row) => (
              <option key={row._id} value={row._id}>
                #{row.sequence} · {row.name} ({row.percentComplete ?? 0}% so far)
              </option>
            ))}
          </select>
        </Field>
        <Field label="Percent complete" htmlFor="progress-percent" required hint="0–100, as of today">
          <input
            id="progress-percent"
            type="number"
            min={0}
            max={100}
            className={CONTROL_CLASS}
            value={percent}
            onChange={(event) => setPercent(event.target.value)}
          />
        </Field>
        <Field label="Note" htmlFor="progress-notes">
          <textarea
            id="progress-notes"
            rows={2}
            className={CONTROL_CLASS}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}
