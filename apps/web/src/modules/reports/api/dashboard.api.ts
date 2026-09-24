import type { DashboardDto } from "@methanova/shared-types";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../../lib/apiClient";
import { queryKeys, RESOURCE } from "../../../lib/queryKeys";

/**
 * The Dashboard's own aggregation endpoint (`/api/crm/dashboard`) — not the
 * unrelated `reportsApi` in `reports.api.ts`, which is generic CRUD over the
 * `ReportSnapshot` scaffold for a future Reports feature. Deliberately
 * separate files so the two are never conflated.
 */
export function useDashboard(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.resource(RESOURCE.dashboard),
    enabled: options?.enabled ?? true,
    queryFn: () => apiClient<DashboardDto>("/api/crm/dashboard"),
  });
}
