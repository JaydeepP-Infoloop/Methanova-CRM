import { z } from "zod";

export const createReceiptSchema = z.object({
  notes: z.string().optional(),
}).passthrough();

export const updateReceiptSchema = createReceiptSchema.partial();


