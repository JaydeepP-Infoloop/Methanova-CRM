import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../lib/apiClient";
import { createResourceApi } from "../../../lib/apiResource";
import { RESOURCE } from "../../../lib/queryKeys";
import type { WorkPackageRow } from "../types";

export const workPackagesApi = createResourceApi<WorkPackageRow>("/api/schedule/work-packages", RESOURCE.workPackages);

export interface WorkPackageTransitionPayload {
  id: string;
  to: string;
  /** Only meaningful — and required by the server — when `to` is ON_HOLD. */
  delayReason?: string;
}

/**
 * A hand-written transition, not `workPackagesApi.useTransition()`: the
 * generic factory only ever sends `{ to }`, and the ON_HOLD move needs to
 * carry `delayReason` alongside it — the same reason the licence GRANTED
 * transition has its own hook rather than using the generic one.
 */
export function useTransitionWorkPackage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: WorkPackageTransitionPayload) =>
      apiClient(`/api/schedule/work-packages/${id}/transition`, { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workPackagesApi.allKey }),
  });
}
