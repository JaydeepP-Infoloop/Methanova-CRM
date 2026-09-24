import { createResourceApi } from "../../../lib/apiResource";
import { RESOURCE } from "../../../lib/queryKeys";
import type { UserRow } from "../types";

export const usersApi = createResourceApi<UserRow>("/api/admin/users", RESOURCE.users);
