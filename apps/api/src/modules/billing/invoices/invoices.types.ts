import type { z } from "zod";
import type { createInvoiceSchema, updateInvoiceSchema } from "./invoices.validation.js";

export type InvoiceId = string;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;

export interface InvoiceListQuery {
  limit?: number;
}
