import { createResourceApi } from "../../../lib/apiResource";
import { RESOURCE } from "../../../lib/queryKeys";
import type { WorkPackageRow } from "../types";

export const workPackagesApi = createResourceApi<WorkPackageRow>("/api/schedule/work-packages", RESOURCE.workPackages);
