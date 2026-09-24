import { createResourceApi } from "../../../lib/apiResource";
import { RESOURCE } from "../../../lib/queryKeys";
import type { MouRow } from "../types";

export const mouApi = createResourceApi<MouRow>("/api/crm/mou", RESOURCE.mous);
