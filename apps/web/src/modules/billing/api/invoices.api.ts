import { createResourceApi } from "../../../lib/apiResource";
import { RESOURCE } from "../../../lib/queryKeys";
import type { InvoiceRow } from "../types";

export const invoicesApi = createResourceApi<InvoiceRow>("/api/billing/invoices", RESOURCE.invoices);
