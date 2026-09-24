import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../lib/apiClient";
import { queryKeys, RESOURCE } from "../../../lib/queryKeys";

const BASE = "/api/admin/reference";

export type GeoLevel = "states" | "districts" | "talukas" | "villages";

export interface LeadSourceRecord {
  _id: string;
  key: string;
  label: string;
  detailLabel?: string | null;
  detailPlaceholder?: string | null;
  detailRequired?: boolean;
  sortOrder: number;
}

/**
 * Every write here changes data the CRM reads through the masters namespace,
 * so the whole namespace is invalidated. Admin edits are rare; refetching a
 * few reference lists costs nothing next to showing a stale cascade.
 */
function useReferenceMutation<TVars>(mutationFn: (vars: TVars) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.resource(RESOURCE.masters) }),
  });
}

export function useCreateGeography() {
  return useReferenceMutation<{ level: GeoLevel; payload: Record<string, string> }>(({ level, payload }) =>
    apiClient(`${BASE}/geography/${level}`, { method: "POST", body: JSON.stringify(payload) }),
  );
}

export function useRenameGeography() {
  return useReferenceMutation<{ level: GeoLevel; id: string; name: string }>(({ level, id, name }) =>
    apiClient(`${BASE}/geography/${level}/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }),
  );
}

export function useDeleteGeography() {
  return useReferenceMutation<{ level: GeoLevel; id: string }>(({ level, id }) =>
    apiClient(`${BASE}/geography/${level}/${id}`, { method: "DELETE" }),
  );
}

export function useCreateLeadSource() {
  return useReferenceMutation<Partial<LeadSourceRecord> & { key: string; label: string }>((payload) =>
    apiClient(`${BASE}/lead-sources`, { method: "POST", body: JSON.stringify(payload) }),
  );
}

export function useUpdateLeadSource() {
  return useReferenceMutation<{ id: string; payload: Partial<LeadSourceRecord> }>(({ id, payload }) =>
    apiClient(`${BASE}/lead-sources/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  );
}

export function useDeleteLeadSource() {
  return useReferenceMutation<string>((id) =>
    apiClient(`${BASE}/lead-sources/${id}`, { method: "DELETE" }),
  );
}

export interface FeedstockTypeRecord {
  _id: string;
  key: string;
  label: string;
  /** Null means "not configured yet" — never render it as zero. */
  yieldFactor: number | null;
  unit: string;
  sortOrder: number;
}

export interface FeedstockUsage {
  leadsByType: Record<string, number>;
  openLeads: number;
  staleOpenLeads: number;
}

/**
 * Lives in the masters namespace so a yield-factor edit invalidates it along
 * with everything else — the stale count is only useful if it moves the moment
 * the thing it counts changes.
 */
export function useFeedstockUsage() {
  return useQuery({
    queryKey: queryKeys.op(RESOURCE.masters, "feedstock-usage"),
    queryFn: () => apiClient<FeedstockUsage>(`${BASE}/feedstock-types/usage`),
  });
}

export function useCreateFeedstockType() {
  return useReferenceMutation<Partial<FeedstockTypeRecord> & { key: string; label: string }>((payload) =>
    apiClient(`${BASE}/feedstock-types`, { method: "POST", body: JSON.stringify(payload) }),
  );
}

export function useUpdateFeedstockType() {
  return useReferenceMutation<{ id: string; payload: Partial<FeedstockTypeRecord> }>(({ id, payload }) =>
    apiClient(`${BASE}/feedstock-types/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  );
}

export function useDeleteFeedstockType() {
  return useReferenceMutation<string>((id) =>
    apiClient(`${BASE}/feedstock-types/${id}`, { method: "DELETE" }),
  );
}

/** Also invalidates leads: their stored estimates are exactly what this rewrites. */
export function useRecalculateExpectedCbg() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiClient<{ scanned: number; updated: number }>(`${BASE}/feedstock-types/recalculate`, {
        method: "POST",
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.resource(RESOURCE.masters) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.resource(RESOURCE.leads) });
    },
  });
}

export interface LicenceTypeRecord {
  _id: string;
  key: string;
  label: string;
  authority: string;
  bundle: "PRE_CTE" | "CTE" | "CTO";
  scope: "METHANOVA" | "CLIENT";
  expectedVisitCount: number;
  sortOrder: number;
}

export function useCreateLicenceType() {
  return useReferenceMutation<Partial<LicenceTypeRecord> & { key: string; label: string }>((payload) =>
    apiClient(`${BASE}/licence-types`, { method: "POST", body: JSON.stringify(payload) }),
  );
}

export function useUpdateLicenceType() {
  return useReferenceMutation<{ id: string; payload: Partial<LicenceTypeRecord> }>(({ id, payload }) =>
    apiClient(`${BASE}/licence-types/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  );
}

export function useDeleteLicenceType() {
  return useReferenceMutation<string>((id) =>
    apiClient(`${BASE}/licence-types/${id}`, { method: "DELETE" }),
  );
}

/**
 * The Director-approval gate's threshold. Writes go straight to
 * `/api/masters/...`, not `${BASE}` (`/api/admin/reference`) — the same
 * exception `qualification-criteria.api.ts`'s `useUpdateQualificationSettings`
 * makes, because this setting is layered onto the masters router with an
 * extra admin/WRITE check rather than living under the reference-admin router.
 */
export function useUpdateMouApprovalSettings() {
  return useReferenceMutation<{ thresholdPaise: number }>((payload) =>
    apiClient("/api/masters/mou-approval-settings", { method: "PATCH", body: JSON.stringify(payload) }),
  );
}
