import { createResourceApi } from "../../../lib/apiResource";
import { RESOURCE } from "../../../lib/queryKeys";
import type { RoleRecordRow } from "../types";

export const rolesApi = createResourceApi<RoleRecordRow>("/api/admin/roles", RESOURCE.roles);
