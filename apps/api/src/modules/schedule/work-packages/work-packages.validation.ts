import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Must be a valid id");
const paise = z.coerce.number().int("Monetary values must be integer paise").nonnegative();

/** `status` and `actualEnd` are excluded — status only ever moves through `transitionWorkPackageSchema`, and `actualEnd` is stamped automatically, never accepted from a client. */
export const createWorkPackageSchema = z.object({
  projectId: objectId,
  name: z.string().trim().min(1),
  sequence: z.coerce.number().int().min(1),
  plannedStart: z.coerce.date().optional().nullable(),
  plannedEnd: z.coerce.date().optional().nullable(),
  amountPaise: paise,
});

export const updateWorkPackageSchema = createWorkPackageSchema.partial();

/**
 * `delayReason` only applies to the ON_HOLD move — required there (the same
 * `superRefine` shape `transitionLicenceSchema`'s GRANTED/`validUntil` rule
 * already uses), ignored everywhere else.
 */
export const transitionWorkPackageSchema = z
  .object({
    to: z.string().min(1),
    delayReason: z.string().trim().optional().nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.to === "ON_HOLD" && !value.delayReason?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["delayReason"],
        message: "A reason is required when putting a work package on hold",
      });
    }
  });
