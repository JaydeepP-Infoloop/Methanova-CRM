import { createResourceApi } from "../../../lib/apiResource";
import { RESOURCE } from "../../../lib/queryKeys";
import type { DprRow } from "../types";

export const drpApi = createResourceApi<DprRow>("/api/projects/dpr", RESOURCE.dprs);
