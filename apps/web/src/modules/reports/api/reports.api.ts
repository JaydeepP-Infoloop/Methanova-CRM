import { createResourceApi } from "../../../lib/apiResource";
import { RESOURCE } from "../../../lib/queryKeys";
import type { ReportSnapshotRow } from "../types";

export const reportsApi = createResourceApi<ReportSnapshotRow>("/api/reports", RESOURCE.reports);
