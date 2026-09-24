import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../../lib/apiClient";
import { createResourceApi } from "../../../lib/apiResource";
import { queryKeys, RESOURCE } from "../../../lib/queryKeys";
import type { QuotationRow } from "../types";

export const quotationsApi = createResourceApi<QuotationRow>("/api/crm/quotations", RESOURCE.quotations);

/** Every revision sharing this quotation's lineage, oldest first — the side-by-side comparison view's data source. */
export function useQuotationRevisions(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.sub(RESOURCE.quotations, id, "revisions"),
    enabled: Boolean(id),
    queryFn: () => apiClient<QuotationRow[]>(`/api/crm/quotations/${id}/revisions`),
  });
}
