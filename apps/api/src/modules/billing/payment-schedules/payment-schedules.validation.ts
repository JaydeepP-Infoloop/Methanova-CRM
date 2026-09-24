import { z } from "zod";

export const createPaymentScheduleSchema = z.object({
  notes: z.string().optional(),
}).passthrough();

export const updatePaymentScheduleSchema = createPaymentScheduleSchema.partial();


