import type { LeadInboxSummaryDto, LeadListItemDto } from "@methanova/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../lib/apiClient";
import { createResourceApi } from "../../../lib/apiResource";
import { queryKeys, RESOURCE } from "../../../lib/queryKeys";
import type { LeadRow } from "../types";

const BASE = "/api/crm/leads";

/** Kept for the transition/kanban surface built in D3, which still speaks the generic shape. */
export const leadsApi = createResourceApi<LeadRow>(BASE, RESOURCE.leads);

export interface LeadListFilters {
  page: number;
  pageSize: number;
  search?: string;
  stage?: string;
  districtId?: string;
  leadSourceId?: string;
  temperature?: string;
  ownerUserId?: string;
  unassigned?: boolean;
  noFirstResponse?: boolean;
  overdueNextAction?: boolean;
  arrivedToday?: boolean;
  sort?: string;
}

export interface LeadListResponse {
  items: LeadListItemDto[];
  total: number;
  page: number;
  pageSize: number;
}

function toQueryString(filters: LeadListFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    // Only send the boolean filters when they are on; `unassigned=false`
    // would otherwise read as an explicit filter server-side.
    if (value === undefined || value === "" || value === false) continue;
    params.set(key, String(value));
  }
  return params.toString();
}

/** All lead query keys come from the shared factory, so one namespace covers them. */
export const leadKeys = {
  all: queryKeys.resource(RESOURCE.leads),
  list: (filters: LeadListFilters) => queryKeys.list(RESOURCE.leads, filters),
  detail: (id: string | undefined) => queryKeys.detail(RESOURCE.leads, id),
  /** Keyed by the filters: two of the five figures describe the filtered set, so they are not one cached value. */
  summary: (filters: LeadListFilters) => queryKeys.op(RESOURCE.leads, "summary", filters),
  sourceMix: () => queryKeys.op(RESOURCE.leads, "source-mix"),
  criteriaTally: () => queryKeys.op(RESOURCE.leads, "criteria-tally"),
  duplicates: (name: string) => queryKeys.op(RESOURCE.leads, "duplicates", name),
  expectedCbg: (ids: string[], qty: number) => queryKeys.op(RESOURCE.leads, "expected-cbg", { ids, qty }),
  activities: (id: string | undefined) => queryKeys.sub(RESOURCE.leads, id, "activities"),
};

export function useLeadList(filters: LeadListFilters, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: leadKeys.list(filters),
    enabled: options?.enabled ?? true,
    queryFn: () => apiClient<LeadListResponse>(`${BASE}?${toQueryString(filters)}`),
  });
}

/** Takes the same filters as the list so the value and slowest-waiting figures match the rows on screen. */
export function useLeadSummary(filters: LeadListFilters, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: leadKeys.summary(filters),
    enabled: options?.enabled ?? true,
    queryFn: () => apiClient<LeadInboxSummaryDto>(`${BASE}/summary?${toQueryString(filters)}`),
  });
}

export interface LeadSourceMix {
  windowDays: number;
  totalLeads: number;
  items: { leadSourceId: string; label: string; count: number }[];
}

export interface QualificationTally {
  leadsScored: number;
  items: { criterionKey: string; label: string; assessedCount: number; averageScore: number }[];
}

export function useLeadSourceMix() {
  return useQuery({
    queryKey: leadKeys.sourceMix(),
    queryFn: () => apiClient<LeadSourceMix>(`${BASE}/reports/source-mix`),
  });
}

export function useQualificationTally() {
  return useQuery({
    queryKey: leadKeys.criteriaTally(),
    queryFn: () => apiClient<QualificationTally>(`${BASE}/reports/criteria-tally`),
  });
}

export interface DuplicateLead {
  _id: string;
  leadCode: string;
  companyName: string;
  stage: string;
}

export function useDuplicateCheck(companyName: string) {
  const trimmed = companyName.trim();
  return useQuery({
    queryKey: leadKeys.duplicates(trimmed),
    // Two characters is short enough to catch real typing, long enough to
    // avoid firing on every first keystroke.
    enabled: trimmed.length >= 2,
    queryFn: () =>
      apiClient<DuplicateLead[]>(`${BASE}/duplicates?companyName=${encodeURIComponent(trimmed)}`),
  });
}

export interface ExpectedCbgResponse {
  expectedCbgTpd: number;
  unconfiguredTypes: { id: string; label: string }[];
}

export function useExpectedCbg(feedstockTypeIds: string[], feedstockQtyTpd: number) {
  return useQuery({
    queryKey: leadKeys.expectedCbg(feedstockTypeIds, feedstockQtyTpd),
    enabled: feedstockTypeIds.length > 0 && feedstockQtyTpd > 0,
    queryFn: () =>
      apiClient<ExpectedCbgResponse>(`${BASE}/expected-cbg`, {
        method: "POST",
        body: JSON.stringify({ feedstockTypeIds, feedstockQtyTpd }),
      }),
  });
}

/** Thrown-through shape of the API's 400 response so the wizard can place messages per field. */
export interface ApiFieldErrors {
  error: string;
  fieldErrors?: Record<string, string[]>;
}

export function useCreateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiClient<{ _id: string; leadCode: string }>(BASE, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      // Both the list and the two derived counts are stale the instant a lead lands.
      void queryClient.invalidateQueries({ queryKey: leadKeys.all });
    },
  });
}

/**
 * Any write to a lead invalidates the whole lead namespace — list, detail,
 * summary counts and sub-collections all live under it, and a change to one
 * routinely moves another (a stage move changes the detail *and* the inbox
 * counts). It lives here beside `leadKeys` rather than in a feature file so
 * every lead mutation reaches for the same one. My Day is invalidated
 * alongside: a reschedule, a park, an unpark or a stage transition can each
 * add, remove or change a row in that queue (a reschedule moves which bucket
 * a lead sits in; a park adds a `PARKED_REVISIT` row; a LOST transition with
 * `reengageOn` adds a `REENGAGE` row), and none of those go through the
 * activity-logging path that `useLeadMutation` in activities.api.ts covers.
 */
export function useLeadWriteMutation<TVars>(mutationFn: (vars: TVars) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: leadKeys.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.resource(RESOURCE.myDay) });
    },
  });
}

export interface ContactPayload {
  name: string;
  designation?: string;
  mobile: string;
  email?: string;
  isPrimary: boolean;
  isDecisionMaker: boolean;
}

/** Sends the finished array, not a per-row patch — the server re-checks the one-primary rule against it. */
export function useUpdateLeadContacts(leadId?: string) {
  return useLeadWriteMutation<ContactPayload[]>((contacts) =>
    apiClient(`${BASE}/${leadId}/contacts`, {
      method: "PATCH",
      body: JSON.stringify({ contacts }),
    }),
  );
}

export function useParkLead(leadId?: string) {
  return useLeadWriteMutation<{ reason: string; revisitDate: string }>((payload) =>
    apiClient(`${BASE}/${leadId}/park`, { method: "POST", body: JSON.stringify(payload) }),
  );
}

export function useUnparkLead(leadId?: string) {
  return useLeadWriteMutation<void>(() =>
    apiClient(`${BASE}/${leadId}/unpark`, { method: "POST" }),
  );
}

/**
 * A manual reschedule through the general PATCH, not a new activity — it
 * changes the commitment without claiming a follow-up happened. The server
 * clears the promise's provenance when either field moves through this route,
 * since a manually-typed date is no longer "promised at follow-up N".
 */
export function useRescheduleNextAction(leadId?: string) {
  return useLeadWriteMutation<{ nextAction: string; nextActionDate: string }>((payload) =>
    apiClient(`${BASE}/${leadId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  );
}

/**
 * Legal field edits that are not a lifecycle move — temperature, value, and
 * the same next-action PATCH `useRescheduleNextAction` already uses. Stage
 * still has to go through `/transition`.
 */
export function usePatchLead(leadId?: string) {
  return useLeadWriteMutation<Record<string, unknown>>((payload) =>
    apiClient(`${BASE}/${leadId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  );
}
