import { z } from "zod";

export const createInvoiceSchema = z.object({
  notes: z.string().optional(),
}).passthrough();

export const updateInvoiceSchema = createInvoiceSchema.partial();

export const transitionInvoiceSchema = z.object({
  to: z.string().min(1),
});
