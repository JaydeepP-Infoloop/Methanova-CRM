import { createResourceApi } from "../../../lib/apiResource";
import { RESOURCE } from "../../../lib/queryKeys";
import type { MasterDataRow } from "../types";

export const masterDataApi = createResourceApi<MasterDataRow>("/api/admin/master-data", RESOURCE.masterData);
