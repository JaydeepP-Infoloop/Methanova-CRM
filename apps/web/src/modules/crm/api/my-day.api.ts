import type { MyDayResponseDto } from "@methanova/shared-types";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../../lib/apiClient";
import { queryKeys, RESOURCE } from "../../../lib/queryKeys";

const BASE = "/api/crm/my-day";

/**
 * `scope=team` is advisory — the server re-derives whether the caller is
 * actually allowed a team view (Sales Head / Director) and silently
 * downgrades to "mine" otherwise, exactly like every other hidden-toggle
 * permission check in this app. The toggle here just requests the view; it
 * is never the thing that grants it.
 */
export function useMyDay(scope: "mine" | "team", options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.op(RESOURCE.myDay, "queue", { scope }),
    enabled: options?.enabled ?? true,
    queryFn: () => apiClient<MyDayResponseDto>(`${BASE}?scope=${scope}`),
  });
}
