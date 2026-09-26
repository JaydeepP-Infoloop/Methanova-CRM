import {
  ACTIVITY_OUTCOME_CATEGORY_LABELS,
  ACTIVITY_OUTCOME_CATEGORY_ORDER,
  ACTIVITY_TYPE_ORDER,
  ActivityType,
  requiresPlantVisitDetail,
  requiresSiteVisitDetail,
} from "@methanova/shared-types";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../../components/Button";
import { Field, CONTROL_CLASS } from "../../../components/Field";
import { Modal } from "../../../components/Modal";
import { useToast } from "../../../components/Toast";
import { ApiError } from "../../../lib/apiClient";
import { useAssignableUsers, useLogActivity } from "../api/activities.api";
import { leadsApi, useLeadList } from "../api/leads.api";

const inputClass = CONTROL_CLASS;

function localDateTimeValue(date: Date): string {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export interface LogActivityModalProps {
  open: boolean;
  leadId?: string;
  leadLabel?: string;
  /**
   * Optional. When the caller already has the lead loaded (the detail
   * workspace) it passes them in; when it does not (an inbox row, whose list
   * payload carries no contacts) the modal fetches them itself, so both entry
   * points offer the same choices.
   */
  contactNames?: string[];
  onClose: () => void;
  onLogged?: () => void;
}

export function LogActivityModal({
  open,
  leadId,
  leadLabel,
  contactNames,
  onClose,
  onLogged,
}: LogActivityModalProps) {
  const toast = useToast();
  // Opened without a lead (the Dashboard's quick action), the modal asks for
  // one first; every other entry point passes it in and never sees the picker.
  const needsLeadPicker = !leadId;
  const [pickedLeadId, setPickedLeadId] = useState("");
  const targetLeadId = leadId ?? (pickedLeadId || undefined);
  const leadOptions = useLeadList({ page: 1, pageSize: 100, sort: "newest" }, { enabled: open && needsLeadPicker });
  const logActivity = useLogActivity(targetLeadId);
  const users = useAssignableUsers();
  const firstFieldRef = useRef<HTMLSelectElement>(null);

  // Only fetched when the caller did not supply contacts and the modal is open.
  const leadQuery = leadsApi.useItem(contactNames === undefined && open ? targetLeadId : undefined);
  const availableContactNames =
    contactNames ??
    ((leadQuery.data as { contacts?: { name: string }[] } | undefined)?.contacts ?? []).map(
      (contact) => contact.name,
    );

  const [type, setType] = useState<string>(ActivityType.CALL);
  const [occurredAt, setOccurredAt] = useState(() => localDateTimeValue(new Date()));
  const [summary, setSummary] = useState("");
  const [outcomeCategory, setOutcomeCategory] = useState("");
  const [outcome, setOutcome] = useState("");
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [externalNames, setExternalNames] = useState<string[]>([]);
  const [nextFollowUpDate, setNextFollowUpDate] = useState("");
  const [nextFollowUpAction, setNextFollowUpAction] = useState("");
  const [plantVisit, setPlantVisit] = useState({
    referencePlantName: "",
    visitorCount: "",
    visitorDesignations: "",
    travelArrangedBy: "",
    feedbackRating: "",
    feedbackNotes: "",
  });
  const [siteVisit, setSiteVisit] = useState({ gpsLat: "", gpsLng: "", observations: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPickedLeadId("");
    setType(ActivityType.CALL);
    setOccurredAt(localDateTimeValue(new Date()));
    setSummary("");
    setOutcomeCategory("");
    setOutcome("");
    setParticipantIds([]);
    setExternalNames([]);
    setNextFollowUpDate("");
    setNextFollowUpAction("");
    setPlantVisit({ referencePlantName: "", visitorCount: "", visitorDesignations: "", travelArrangedBy: "", feedbackRating: "", feedbackNotes: "" });
    setSiteVisit({ gpsLat: "", gpsLng: "", observations: "" });
    setErrors({});
    setBanner(null);
    window.setTimeout(() => firstFieldRef.current?.focus(), 50);
  }, [open]);

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!targetLeadId) next.leadId = "Pick the lead this activity is against";
    if (!summary.trim()) next.summary = "Summary is required";
    if (!occurredAt) next.occurredAt = "When it happened is required";
    else if (new Date(occurredAt) > new Date()) next.occurredAt = "An activity cannot be in the future";
    // The guardrail: free text alone previously let an Excel date serial
    // ("43244") and a bare "120" into production rows. A category is now
    // required before the elaboration field is accepted, mirroring the
    // server's own check.
    if (outcome.trim() && !outcomeCategory) next.outcomeCategory = "Pick an outcome category before adding detail";
    if (nextFollowUpDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (new Date(nextFollowUpDate) < today) next.nextFollowUpDate = "Follow-up cannot be in the past";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit() {
    setBanner(null);
    if (!validate()) return;
    try {
      await logActivity.mutateAsync({
        type,
        occurredAt: new Date(occurredAt).toISOString(),
        internalParticipantIds: participantIds,
        externalContactNames: externalNames,
        summary: summary.trim(),
        outcomeCategory: outcomeCategory || undefined,
        outcome: outcome.trim() || undefined,
        nextFollowUpDate: nextFollowUpDate ? new Date(nextFollowUpDate).toISOString() : null,
        nextFollowUpAction: nextFollowUpAction.trim() || undefined,
        // Only send the sub-document that belongs to the chosen type; the
        // server rejects a mismatched pairing outright.
        plantVisit: requiresPlantVisitDetail(type)
          ? {
              referencePlantName: plantVisit.referencePlantName || undefined,
              visitorCount: plantVisit.visitorCount || undefined,
              visitorDesignations: plantVisit.visitorDesignations || undefined,
              travelArrangedBy: plantVisit.travelArrangedBy || undefined,
              feedbackRating: plantVisit.feedbackRating || undefined,
              feedbackNotes: plantVisit.feedbackNotes || undefined,
            }
          : null,
        siteVisit: requiresSiteVisitDetail(type)
          ? {
              gpsLat: siteVisit.gpsLat || undefined,
              gpsLng: siteVisit.gpsLng || undefined,
              observations: siteVisit.observations || undefined,
            }
          : null,
      });
      toast({ message: `${type.replace(/_/g, " ").toLowerCase()} logged` });
      onLogged?.();
      onClose();
    } catch (caught) {
      if (caught instanceof ApiError && caught.body.fieldErrors) {
        const serverErrors: Record<string, string> = {};
        for (const [path, messages] of Object.entries(caught.body.fieldErrors)) {
          serverErrors[path.split(".")[0]] = messages[0];
        }
        setErrors(serverErrors);
        setBanner(caught.body.error ?? "Please correct the highlighted fields.");
        return;
      }
      setBanner(caught instanceof Error ? caught.message : "Could not log that activity.");
    }
  }

  return (
    <Modal
      open={open}
      title="Log activity"
      description={leadLabel ? `Against ${leadLabel}` : undefined}
      onRequestClose={onClose}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} isPending={logActivity.isPending} pendingLabel="Saving…">
            Log activity
          </Button>
        </div>
      }
    >
      {banner && (
        <p role="alert" className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-600/20">
          {banner}
        </p>
      )}

      {needsLeadPicker && (
        <div className="mb-4">
          <Field label="Lead" htmlFor="activityLead" required error={errors.leadId}>
            <select
              id="activityLead"
              className={inputClass}
              value={pickedLeadId}
              onChange={(e) => {
                setPickedLeadId(e.target.value);
                setExternalNames([]);
              }}
            >
              <option value="">Select a lead…</option>
              {(leadOptions.data?.items ?? []).map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.leadCode} · {lead.companyName}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Type" htmlFor="activityType" required>
          <select id="activityType" ref={firstFieldRef} className={inputClass} value={type} onChange={(e) => setType(e.target.value)}>
            {ACTIVITY_TYPE_ORDER.map((value) => (
              <option key={value} value={value}>{value.replace(/_/g, " ")}</option>
            ))}
          </select>
        </Field>
        <Field label="When" htmlFor="occurredAt" required error={errors.occurredAt}>
          <input id="occurredAt" type="datetime-local" className={inputClass} value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
        </Field>

        <div className="sm:col-span-2">
          <Field label="Summary" htmlFor="summary" required error={errors.summary}>
            <textarea id="summary" rows={2} className={inputClass} placeholder="What was discussed?" value={summary} onChange={(e) => setSummary(e.target.value)} />
          </Field>
        </div>
        {/* The guardrail: a short pick-list first, free text only as
            elaboration on top of it. Unconstrained free text alone had
            already let an Excel date serial ("43244") and a bare "120" into
            production rows. */}
        <Field label="Outcome" htmlFor="outcomeCategory" error={errors.outcomeCategory}>
          <select
            id="outcomeCategory"
            className={inputClass}
            value={outcomeCategory}
            onChange={(e) => {
              // Clearing the category orphans any elaboration already typed —
              // clear it too rather than leaving stale text the guardrail
              // will then refuse at submit time with no visible cause.
              if (!e.target.value) setOutcome("");
              setOutcomeCategory(e.target.value);
            }}
          >
            <option value="">Not recorded</option>
            {ACTIVITY_OUTCOME_CATEGORY_ORDER.map((value) => (
              <option key={value} value={value}>
                {ACTIVITY_OUTCOME_CATEGORY_LABELS[value]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Outcome detail (optional)" htmlFor="outcome" error={errors.outcome}>
          <input
            id="outcome"
            className={inputClass}
            disabled={!outcomeCategory}
            placeholder={outcomeCategory ? "Add detail — what specifically was said?" : "Pick an outcome first"}
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
          />
        </Field>

        {availableContactNames.length > 0 && (
          <div className="sm:col-span-2">
            <Field label="Who did you speak to">
              <div className="flex flex-wrap gap-2">
                {availableContactNames.map((name) => {
                  const selected = externalNames.includes(name);
                  return (
                    <button
                      key={name}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        setExternalNames((current) =>
                          current.includes(name) ? current.filter((n) => n !== name) : [...current, name],
                        )
                      }
                      className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold ${
                        selected ? "bg-methanova-greenTint text-methanova-green ring-methanova-green/30" : "bg-white text-slate-600 ring-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>
        )}

        <div className="sm:col-span-2">
          <Field label="Colleagues involved">
            <div className="flex flex-wrap gap-2">
              {users.data?.map((user) => {
                const selected = participantIds.includes(user._id);
                return (
                  <button
                    key={user._id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() =>
                      setParticipantIds((current) =>
                        current.includes(user._id) ? current.filter((id) => id !== user._id) : [...current, user._id],
                      )
                    }
                    className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold ${
                      selected ? "bg-methanova-greenTint text-methanova-green ring-methanova-green/30" : "bg-white text-slate-600 ring-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {user.name}
                  </button>
                );
              })}
            </div>
          </Field>
        </div>

        {/* Conditionally revealed: these groups only exist for their own type. */}
        {requiresPlantVisitDetail(type) && (
          <fieldset className="sm:col-span-2 rounded-xl p-4 ring-1 ring-slate-200">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Plant visit</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Reference plant" htmlFor="referencePlantName">
                <input id="referencePlantName" className={inputClass} value={plantVisit.referencePlantName} onChange={(e) => setPlantVisit({ ...plantVisit, referencePlantName: e.target.value })} />
              </Field>
              <Field label="Visitor count" htmlFor="visitorCount">
                <input id="visitorCount" type="number" min="0" className={inputClass} value={plantVisit.visitorCount} onChange={(e) => setPlantVisit({ ...plantVisit, visitorCount: e.target.value })} />
              </Field>
              <Field label="Visitor designations" htmlFor="visitorDesignations">
                <input id="visitorDesignations" className={inputClass} placeholder="MD, CFO, 2 engineers" value={plantVisit.visitorDesignations} onChange={(e) => setPlantVisit({ ...plantVisit, visitorDesignations: e.target.value })} />
              </Field>
              <Field label="Travel arranged by" htmlFor="travelArrangedBy">
                <input id="travelArrangedBy" className={inputClass} value={plantVisit.travelArrangedBy} onChange={(e) => setPlantVisit({ ...plantVisit, travelArrangedBy: e.target.value })} />
              </Field>
              <Field label="Feedback rating (1-5)" htmlFor="feedbackRating">
                <input id="feedbackRating" type="number" min="1" max="5" className={inputClass} value={plantVisit.feedbackRating} onChange={(e) => setPlantVisit({ ...plantVisit, feedbackRating: e.target.value })} />
              </Field>
              <Field label="Feedback notes" htmlFor="feedbackNotes">
                <input id="feedbackNotes" className={inputClass} value={plantVisit.feedbackNotes} onChange={(e) => setPlantVisit({ ...plantVisit, feedbackNotes: e.target.value })} />
              </Field>
            </div>
          </fieldset>
        )}

        {requiresSiteVisitDetail(type) && (
          <fieldset className="sm:col-span-2 rounded-xl p-4 ring-1 ring-slate-200">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Site visit</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="GPS latitude" htmlFor="gpsLat">
                <input id="gpsLat" type="number" step="any" className={inputClass} placeholder="23.5937" value={siteVisit.gpsLat} onChange={(e) => setSiteVisit({ ...siteVisit, gpsLat: e.target.value })} />
              </Field>
              <Field label="GPS longitude" htmlFor="gpsLng">
                <input id="gpsLng" type="number" step="any" className={inputClass} placeholder="72.9629" value={siteVisit.gpsLng} onChange={(e) => setSiteVisit({ ...siteVisit, gpsLng: e.target.value })} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Observations" htmlFor="observations">
                  <textarea id="observations" rows={2} className={inputClass} placeholder="Terrain, access, power availability…" value={siteVisit.observations} onChange={(e) => setSiteVisit({ ...siteVisit, observations: e.target.value })} />
                </Field>
              </div>
            </div>
          </fieldset>
        )}

        <Field label="Next follow-up date" htmlFor="nextFollowUpDate" error={errors.nextFollowUpDate}>
          <input id="nextFollowUpDate" type="date" className={inputClass} value={nextFollowUpDate} onChange={(e) => setNextFollowUpDate(e.target.value)} />
        </Field>
        <Field label="Next follow-up action" htmlFor="nextFollowUpAction">
          <input id="nextFollowUpAction" className={inputClass} placeholder="Updates the lead's next action" value={nextFollowUpAction} onChange={(e) => setNextFollowUpAction(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
