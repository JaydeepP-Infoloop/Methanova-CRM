import { GstPlaceOfSupply, InvoiceKind } from "@methanova/shared-types";
import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Must be a valid id");
const paise = z.coerce.number().int("Monetary values must be integer paise").nonnegative();

/**
 * `status`, `number` and `totalPaise` are deliberately absent — the first two
 * are server-allocated (see `invoices.service.ts`), and `totalPaise` is not
 * recomputed here the way `quotations.service.ts` derives its own total,
 * because this pass does not touch the GST calculation `signMou()` already
 * does with `gstComponents()`; it only adds `dueDate`.
 */
export const createInvoiceSchema = z.object({
  projectId: objectId,
  mouId: objectId,
  paymentScheduleId: objectId.optional().nullable(),
  kind: z.enum(Object.values(InvoiceKind) as [string, ...string[]]),
  placeOfSupply: z.enum(Object.values(GstPlaceOfSupply) as [string, ...string[]]),
  taxablePaise: paise,
  cgstPaise: paise,
  sgstPaise: paise,
  igstPaise: paise,
  retentionPaise: paise,
  advanceRecoveredPaise: paise,
  totalPaise: paise,
  dueDate: z.coerce.date().optional().nullable(),
});

export const updateInvoiceSchema = createInvoiceSchema.partial();

export const transitionInvoiceSchema = z.object({
  to: z.string().min(1),
});
