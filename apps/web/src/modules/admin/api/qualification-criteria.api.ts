import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../lib/apiClient";
import { queryKeys, RESOURCE } from "../../../lib/queryKeys";

const BASE = "/api/masters";

export interface QualificationCriterionRecord {
  _id: string;
  key: string;
  label: string;
  description?: string | null;
  weight: number;
  sortOrder: number;
}

export interface QualificationSettings {
  recommendThreshold: number;
}

export const criteriaKeys = {
  list: () => queryKeys.op(RESOURCE.masters, "qualification-criteria"),
  settings: () => queryKeys.op(RESOURCE.masters, "qualification-settings"),
};

export function useCriteriaAdminList() {
  return useQuery({
    queryKey: criteriaKeys.list(),
    queryFn: () => apiClient<QualificationCriterionRecord[]>(`${BASE}/qualification-criteria`),
  });
}

export function useQualificationSettings() {
  return useQuery({
    queryKey: criteriaKeys.settings(),
    queryFn: () => apiClient<QualificationSettings>(`${BASE}/qualification-settings`),
  });
}

/**
 * Invalidates the whole masters namespace: the criteria list, the threshold
 * and the qualify modal all read from it, and an admin edit is rare enough
 * that refetching the other reference lists costs nothing.
 */
function useMastersMutation<TVars>(mutationFn: (vars: TVars) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.resource(RESOURCE.masters) }),
  });
}

export function useCreateCriterion() {
  return useMastersMutation<{ key: string; label: string; description?: string; weight: number; sortOrder?: number }>(
    (payload) =>
      apiClient(`${BASE}/qualification-criteria`, { method: "POST", body: JSON.stringify(payload) }),
  );
}

export function useUpdateCriterion() {
  return useMastersMutation<{ id: string; payload: Partial<QualificationCriterionRecord> }>(({ id, payload }) =>
    apiClient(`${BASE}/qualification-criteria/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  );
}

export function useDeleteCriterion() {
  return useMastersMutation<string>((id) =>
    apiClient(`${BASE}/qualification-criteria/${id}`, { method: "DELETE" }),
  );
}

export function useUpdateQualificationSettings() {
  return useMastersMutation<QualificationSettings>((payload) =>
    apiClient(`${BASE}/qualification-settings`, { method: "PATCH", body: JSON.stringify(payload) }),
  );
}
