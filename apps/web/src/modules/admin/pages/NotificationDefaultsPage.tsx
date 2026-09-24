import { useEffect, useState } from "react";
import { Button } from "../../../components/Button";
import { Card } from "../../../components/Card";
import { PageHeader } from "../../../components/PagePrimitives";
import { useToast } from "../../../components/Toast";
import { ApiError } from "../../../lib/apiClient";
import {
  useNotificationDefaults,
  useUpdateNotificationDefaults,
  type NotificationDefaults,
} from "../api/letterhead.api";

const LABELS: Record<keyof NotificationDefaults, string> = {
  inAppEnabled: "In-app channel (when the engine exists)",
  emailEnabled: "Email channel (when the engine exists)",
  taskOverdueToAssignee: "Task overdue → assignee",
  taskOverdueToProjectManager: "Task overdue → Project Manager",
};

export function NotificationDefaultsPage() {
  const { data, isLoading, error } = useNotificationDefaults();
  const update = useUpdateNotificationDefaults();
  const toast = useToast();
  const [draft, setDraft] = useState<NotificationDefaults | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);

  async function save() {
    if (!draft) return;
    setFormError(null);
    try {
      await update.mutateAsync(draft);
      toast({ message: "Notification defaults saved" });
    } catch (caught) {
      setFormError(caught instanceof ApiError ? caught.message : "Could not save.");
    }
  }

  return (
    <div>
      <PageHeader
        title="Notification defaults"
        subtitle="System-level channel defaults only. There is still no event engine — these flags are stored so a later engine has somewhere to read. Projects cannot invent channels."
      />
      {isLoading && <p className="text-sm text-slate-500">Loading…</p>}
      {error && <p className="text-sm text-rose-700">{(error as Error).message}</p>}
      {draft && (
        <Card>
          <ul className="space-y-3">
            {(Object.keys(LABELS) as (keyof NotificationDefaults)[]).map((key) => (
              <li key={key}>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft[key]}
                    onChange={(event) => setDraft({ ...draft, [key]: event.target.checked })}
                  />
                  {LABELS[key]}
                </label>
              </li>
            ))}
          </ul>
          {formError && <p className="mt-3 text-sm text-rose-700">{formError}</p>}
          <div className="mt-4">
            <Button onClick={() => void save()} isPending={update.isPending} pendingLabel="Saving…">
              Save defaults
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
