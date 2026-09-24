import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../../lib/apiClient";
import { queryKeys, RESOURCE } from "../../../lib/queryKeys";
import { useLeadWriteMutation } from "./leads.api";

export interface QualificationCriterion {
  _id: string;
  key: string;
  label: string;
  description?: string;
  weight: number;
}

export function useQualificationCriteria() {
  return useQuery({
    queryKey: queryKeys.op(RESOURCE.masters, "qualification-criteria"),
    queryFn: () => apiClient<QualificationCriterion[]>("/api/masters/qualification-criteria"),
  });
}

export interface QualifyPayload {
  scores: { criterionKey: string; score: number; note?: string }[];
  decision: "QUALIFIED" | "DISQUALIFIED";
  disqualificationReason?: string;
  /** Integer paise, or null when that end of the band is unknown. */
  budgetMinPaise?: number | null;
  budgetMaxPaise?: number | null;
}

export function useQualifyLead(leadId?: string) {
  return useLeadWriteMutation<QualifyPayload>(
    (payload) =>
      apiClient(`/api/crm/leads/${leadId}/qualify`, { method: "POST", body: JSON.stringify(payload) }),
  );
}

/**
 * `competitor` and `reengageOn` are only read by the server on the LOST move.
 * They ride on the transition rather than a separate "mark dead" call because
 * moving the rail to LOST *is* the dead exit — a second endpoint would be two
 * ways to record one event.
 */
export interface TransitionPayload {
  to: string;
  reason?: string;
  competitor?: string;
  reengageOn?: string;
}

export function useTransitionLeadStage(leadId?: string) {
  return useLeadWriteMutation<TransitionPayload>(
    (payload) =>
      apiClient(`/api/crm/leads/${leadId}/transition`, { method: "POST", body: JSON.stringify(payload) }),
  );
}

/** Same endpoint, id in the variables — the inbox board moves many cards. */
export function useTransitionLead() {
  return useLeadWriteMutation<{ leadId: string } & TransitionPayload>(({ leadId, ...payload }) =>
    apiClient(`/api/crm/leads/${leadId}/transition`, { method: "POST", body: JSON.stringify(payload) }),
  );
}
