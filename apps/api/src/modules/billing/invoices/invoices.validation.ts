import { GstPlaceOfSupply, InvoiceKind } from "@methanova/shared-types";
import { z } from "zod";
import { flagParam, listFilterFields } from "../../../utils/query.js";

/** `bucket` is an `AgeingBucket` value, or `none` for outstanding invoices with no due date. */
export const listInvoicesQuerySchema = z.object({
  id: listFilterFields.id,
  projectId: listFilterFields.projectId,
  receivable: listFilterFields.receivable,
  /** Open receivables still holding retention — the Receivables Ageing "Retention held" card. */
  retention: flagParam.optional(),
  overdue: listFilterFields.overdue,
  bucket: z.enum(["CURRENT", "0-30", "31-60", "61-90", "90+", "none"]).optional(),
});

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Must be a valid id");
const paise = z.coerce.number().int("Monetary values must be integer paise").nonnegative();

/**
 * `status`, `number` and `clientName` are deliberately absent — all three
 * are server-set (see `invoices.service.ts`). `totalPaise` is accepted as
 * given rather than recomputed the way `quotations.service.ts` derives its
 * own total, because the GST calculation lives in `signMou()`'s
 * `gstComponents()` and is out of scope here.
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
