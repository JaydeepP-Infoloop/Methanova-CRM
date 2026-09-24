import { createResourceApi } from "../../../lib/apiResource";
import { RESOURCE } from "../../../lib/queryKeys";
import type { LicenceRow } from "../types";

export const licencesApi = createResourceApi<LicenceRow>("/api/compliance/licences", RESOURCE.licences);
