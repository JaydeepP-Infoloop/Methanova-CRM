import { MouStatus } from "@methanova/shared-types";
import { z } from "zod";
import { statusListParam } from "../../../utils/query.js";

/** `?status=` is one status or a comma list (`DRAFT,SENT` is the dashboard's "in progress"). */
export const listMousQuerySchema = z.object({
  status: statusListParam(MouStatus).optional(),
});

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Must be a valid id");

const baseMouSchema = z.object({
  leadId: objectId,
  mouDate: z.coerce.date().optional(),
  acceptedQuotationId: objectId,
  feePaise: z.coerce.number().int("Must be an integer number of paise").nonnegative(),
  /**
   * Optional on create: defaults to the accepted quotation's own total in
   * mou.service.ts. Accepted here too because final commercial terms can
   * differ slightly from the quotation after the last round of negotiation.
   */
  contractValuePaise: z.coerce.number().int("Must be an integer number of paise").nonnegative().optional(),
  feeAdjustable: z.coerce.boolean().default(false),
  civilScope: z.enum(["METHANOVA", "CLIENT"]),
  targetCommissioningDate: z.coerce.date(),
  signedDocumentId: objectId.optional(),
  supersedesMouId: objectId.optional(),
});

export const createMouSchema = baseMouSchema;
export const updateMouSchema = baseMouSchema.partial();

export const transitionMouSchema = z.object({
  to: z.string().min(1),
});
