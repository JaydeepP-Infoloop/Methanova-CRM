import { z } from "zod";

export const listReceiptsQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Month must be YYYY-MM").optional(),
});

export const createReceiptSchema = z.object({
  notes: z.string().optional(),
}).passthrough();

export const updateReceiptSchema = createReceiptSchema.partial();


