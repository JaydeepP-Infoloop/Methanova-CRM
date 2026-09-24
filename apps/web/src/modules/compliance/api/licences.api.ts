import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../lib/apiClient";
import { createResourceApi } from "../../../lib/apiResource";
import { RESOURCE } from "../../../lib/queryKeys";
import type { LicenceRow } from "../types";

export const licencesApi = createResourceApi<LicenceRow>("/api/compliance/licences", RESOURCE.licences);

export interface LicenceTransitionPayload {
  id: string;
  to: string;
  /** Only meaningful — and required by the server — when `to` is GRANTED. */
  validUntil?: string;
}

/**
 * A hand-written transition, not `licencesApi.useTransition()`: the generic
 * factory only ever sends `{ to }`, and the GRANTED move needs to carry
 * `validUntil` alongside it — the same reason the lead LOST transition has
 * its own hook rather than using the generic one.
 */
export function useTransitionLicence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: LicenceTransitionPayload) =>
      apiClient(`/api/compliance/licences/${id}/transition`, { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: licencesApi.allKey }),
  });
}
