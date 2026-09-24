import { createResourceApi } from "../../../lib/apiResource";
import { RESOURCE } from "../../../lib/queryKeys";
import type { ReceiptRow } from "../types";

export const receiptsApi = createResourceApi<ReceiptRow>("/api/receivables/receipts", RESOURCE.receipts);
