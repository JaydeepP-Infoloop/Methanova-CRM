import { createResourceApi } from "../../../lib/apiResource";
import { RESOURCE } from "../../../lib/queryKeys";
import type { ProgressUpdateRow } from "../types";

export const progressUpdatesApi = createResourceApi<ProgressUpdateRow>("/api/schedule/progress-updates", RESOURCE.progressUpdates);
