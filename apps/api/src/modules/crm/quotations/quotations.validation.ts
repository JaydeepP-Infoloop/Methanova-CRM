import { QuotationStatus } from "@methanova/shared-types";
import { z } from "zod";
import { flagParam, statusListParam } from "../../../utils/query.js";

/** `?open=1` is every non-terminal status — the same rule as the dashboard's Open Quotations KPI. */
export const listQuotationsQuerySchema = z.object({
  status: statusListParam(QuotationStatus).optional(),
  open: flagParam.optional(),
});

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Must be a valid id");

const priceLineSchema = z.object({
  description: z.string().trim().min(1, "Description is required"),
  amountPaise: z.coerce.number().int("Must be an integer number of paise").nonnegative(),
  hsnSac: z.string().trim().min(1, "HSN/SAC code is required"),
});

const paymentMilestoneSchema = z.object({
  description: z.string().trim().min(1, "Description is required"),
  percentage: z.coerce.number().min(0).max(100),
  dueOnMilestone: z.string().trim().optional(),
});

/** Percentages must total exactly 100 — checked once here rather than per line, since it's a property of the whole set. */
const paymentTermsTemplateSchema = z
  .object({
    name: z.string().trim().min(1, "Template name is required"),
    milestones: z.array(paymentMilestoneSchema).min(1, "At least one milestone is required"),
  })
  .superRefine((value, ctx) => {
    const total = value.milestones.reduce((sum, milestone) => sum + milestone.percentage, 0);
    // Rounded to avoid rejecting 33.33 + 33.33 + 33.34 over a float sliver.
    if (Math.round(total * 100) !== 10000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["milestones"],
        message: `Milestone percentages must sum to 100 (currently ${total})`,
      });
    }
  });

const baseQuotationSchema = z.object({
  leadId: objectId,
  parentQuotationId: objectId.optional(),
  revisionReason: z.string().trim().min(1).optional(),
  capacityTpd: z.coerce.number().positive("Capacity must be greater than zero"),
  feedstockBasis: z.string().trim().min(1, "Feedstock basis is required"),
  expectedCbgTpd: z.coerce.number().nonnegative(),
  priceLines: z.array(priceLineSchema).min(1, "At least one price line is required"),
  scopeInclusions: z.array(z.string().trim().min(1)).default([]),
  scopeExclusions: z.array(z.string().trim().min(1)).default([]),
  paymentTermsTemplate: paymentTermsTemplateSchema,
  notes: z.string().trim().optional(),
});

export const createQuotationSchema = baseQuotationSchema.superRefine((value, ctx) => {
  if (value.parentQuotationId && !value.revisionReason) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["revisionReason"],
      message: "A reason is required when revising a quotation",
    });
  }
});

/** DRAFT-only edits go through this — see quotations.service.ts's updateQuotation guard. */
export const updateQuotationSchema = baseQuotationSchema.partial();

export const transitionQuotationSchema = z.object({
  to: z.string().min(1),
});
