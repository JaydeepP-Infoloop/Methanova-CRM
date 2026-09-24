import { createResourceApi } from "../../../lib/apiResource";
import { RESOURCE } from "../../../lib/queryKeys";
import type { DocumentRecordRow } from "../types";

export const documentsApi = createResourceApi<DocumentRecordRow>("/api/documents", RESOURCE.documents);
