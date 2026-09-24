import type { ActivityDto, ActivityListResponseDto } from "@methanova/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../lib/apiClient";
import { createResourceApi } from "../../../lib/apiResource";
import { queryKeys, RESOURCE } from "../../../lib/queryKeys";
import { leadKeys } from "./leads.api";
import type { ActivityRow } from "../types";

const BASE = "/api/crm/activities";

/**
 * Kept only for `allKey` — the invalidation target every lead-write mutation
 * below reaches for. `.useList()` itself is unused now: the Activity Log page
 * fetches through `useActivityList`, which speaks the paginated shape the
 * server actually returns. Both share the same "activities" namespace, so
 * invalidating one reaches the other.
 */
export const activitiesApi = createResourceApi<ActivityRow>(BASE, RESOURCE.activities);

export interface ActivityListFilters {
  page: number;
  pageSize: number;
  type?: string[];
  parentType?: string;
  leadId?: string;
  loggedByUserId?: string;
  dateFrom?: string;
  dateTo?: string;
  hasFollowUp?: boolean;
  overdueFollowUp?: boolean;
}

function toQueryString(filters: ActivityListFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === "" || value === false) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      params.set(key, value.join(","));
      continue;
    }
    params.set(key, String(value));
  }
  return params.toString();
}

/**
 * The flat Activity Log's own list — real filters and real pagination,
 * replacing the old scaffold's unpaginated `activitiesApi.useList()`, which
 * silently truncated at whatever the server's default limit happened to be.
 */
export function useActivityList(filters: ActivityListFilters) {
  return useQuery({
    queryKey: queryKeys.list(RESOURCE.activities, filters),
    queryFn: () => apiClient<ActivityListResponseDto>(`${BASE}?${toQueryString(filters)}`),
  });
}

export interface ActivityRecord extends Omit<ActivityDto, "internalParticipants"> {
  _id: string;
  internalParticipantIds: { _id: string; name: string; email?: string }[];
}

export interface AssignableUser {
  _id: string;
  name: string;
  email?: string;
  role: string;
}

export function useAssignableUsers() {
  return useQuery({
    queryKey: queryKeys.op(RESOURCE.masters, "users"),
    queryFn: () => apiClient<AssignableUser[]>("/api/masters/users"),
  });
}

export function useLeadActivities(leadId: string | undefined) {
  return useQuery({
    queryKey: leadKeys.activities(leadId),
    enabled: Boolean(leadId),
    queryFn: () => apiClient<ActivityRecord[]>(`/api/crm/leads/${leadId}/activities`),
  });
}

/**
 * Logging an activity or assigning an owner changes the lead itself
 * (firstResponseAt, nextAction, ownerUserId), so the whole lead namespace is
 * invalidated — list, detail, summary counts and the activity sub-collection
 * all live under it. The flat activities list is a separate namespace and is
 * refreshed alongside. My Day is a third: logging the follow-up a My Day row
 * exists for is exactly what should make that row disappear from the queue,
 * and without this it would keep showing a commitment that was just kept.
 */
function useLeadMutation<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: leadKeys.all });
      void queryClient.invalidateQueries({ queryKey: activitiesApi.allKey });
      void queryClient.invalidateQueries({ queryKey: queryKeys.resource(RESOURCE.myDay) });
    },
  });
}

export interface CreateActivityPayload {
  type: string;
  occurredAt: string;
  internalParticipantIds: string[];
  externalContactNames: string[];
  summary: string;
  /** The pick-list guardrail — required if `outcome` free text is given, optional otherwise. */
  outcomeCategory?: string | null;
  outcome?: string;
  nextFollowUpDate?: string | null;
  nextFollowUpAction?: string;
  plantVisit?: Record<string, unknown> | null;
  siteVisit?: Record<string, unknown> | null;
}

export function useLogActivity(leadId: string | undefined) {
  return useLeadMutation<CreateActivityPayload, ActivityRecord>(
    (payload) =>
      apiClient<ActivityRecord>(`/api/crm/leads/${leadId}/activities`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  );
}

/** Omitting userId means "assign to me" — the server substitutes the caller. */
export function useAssignLead() {
  return useLeadMutation<{ leadId: string; userId?: string | null }, unknown>(
    ({ leadId: targetId, userId }) =>
      apiClient(`/api/crm/leads/${targetId}/assign`, {
        method: "POST",
        body: JSON.stringify(userId ? { userId } : {}),
      }),
  );
}
