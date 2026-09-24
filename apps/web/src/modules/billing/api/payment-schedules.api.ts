import { createResourceApi } from "../../../lib/apiResource";
import { RESOURCE } from "../../../lib/queryKeys";
import type { PaymentScheduleRow } from "../types";

export const paymentSchedulesApi = createResourceApi<PaymentScheduleRow>("/api/billing/payment-schedules", RESOURCE.paymentSchedules);
