import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../../lib/apiClient";
import { queryKeys, RESOURCE } from "../../../lib/queryKeys";

const BASE = "/api/masters";

export interface GeoOption {
  _id: string;
  name: string;
}

export interface LeadSourceOption {
  _id: string;
  key: string;
  label: string;
  detailLabel?: string;
  detailPlaceholder?: string;
  detailRequired?: boolean;
  /** Drives the order of the options in the intake form's source list. */
  sortOrder: number;
}

export interface FeedstockTypeOption {
  _id: string;
  key: string;
  label: string;
  /** Null means "not configured" — the estimate must show an em dash, not zero. */
  yieldFactor: number | null;
  /** The unit the quantity is quoted in; "TPD" everywhere so far. */
  unit: string;
  sortOrder: number;
}

export interface LicenceTypeOption {
  _id: string;
  key: string;
  label: string;
  authority: string;
  bundle: "PRE_CTE" | "CTE" | "CTO";
  scope: "METHANOVA" | "CLIENT";
  expectedVisitCount: number;
  sortOrder: number;
}

export function useStates() {
  return useQuery({
    queryKey: queryKeys.op(RESOURCE.masters, "states"),
    queryFn: () => apiClient<GeoOption[]>(`${BASE}/states`),
  });
}

/** Each level stays disabled until its parent is chosen, so the query is simply disabled too. */
export function useDistricts(stateId: string) {
  return useQuery({
    queryKey: queryKeys.op(RESOURCE.masters, "districts", stateId),
    enabled: Boolean(stateId),
    queryFn: () => apiClient<GeoOption[]>(`${BASE}/districts?stateId=${stateId}`),
  });
}

export function useTalukas(districtId: string) {
  return useQuery({
    queryKey: queryKeys.op(RESOURCE.masters, "talukas", districtId),
    enabled: Boolean(districtId),
    queryFn: () => apiClient<GeoOption[]>(`${BASE}/talukas?districtId=${districtId}`),
  });
}

export function useVillages(talukaId: string) {
  return useQuery({
    queryKey: queryKeys.op(RESOURCE.masters, "villages", talukaId),
    enabled: Boolean(talukaId),
    queryFn: () => apiClient<GeoOption[]>(`${BASE}/villages?talukaId=${talukaId}`),
  });
}

export function useLeadSources() {
  return useQuery({
    queryKey: queryKeys.op(RESOURCE.masters, "lead-sources"),
    queryFn: () => apiClient<LeadSourceOption[]>(`${BASE}/lead-sources`),
  });
}

export function useFeedstockTypes() {
  return useQuery({
    queryKey: queryKeys.op(RESOURCE.masters, "feedstock-types"),
    queryFn: () => apiClient<FeedstockTypeOption[]>(`${BASE}/feedstock-types`),
  });
}

export function useLicenceTypes() {
  return useQuery({
    queryKey: queryKeys.op(RESOURCE.masters, "licence-types"),
    queryFn: () => apiClient<LicenceTypeOption[]>(`${BASE}/licence-types`),
  });
}

export interface MouApprovalSettings {
  thresholdPaise: number;
}

export function useMouApprovalSettings() {
  return useQuery({
    queryKey: queryKeys.op(RESOURCE.masters, "mou-approval-settings"),
    queryFn: () => apiClient<MouApprovalSettings>(`${BASE}/mou-approval-settings`),
  });
}
