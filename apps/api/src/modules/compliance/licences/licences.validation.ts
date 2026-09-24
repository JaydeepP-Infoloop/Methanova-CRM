import { LicenceBundle } from "@methanova/shared-types";
import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Must be a valid id");

/** `status` is excluded — a licence only ever moves status through `transitionLicenceSchema`, never a direct field write. */
export const createLicenceSchema = z.object({
  projectId: objectId,
  licenceTypeId: objectId.optional().nullable(),
  bundle: z.enum(Object.values(LicenceBundle) as [string, ...string[]]),
  authority: z.string().trim().min(1),
  targetDate: z.coerce.date().optional().nullable(),
});

export const updateLicenceSchema = createLicenceSchema.partial();

/**
 * `validUntil` only applies to the GRANTED move — required there (see the
 * superRefine below), ignored everywhere else. Same shape as
 * `transitionLeadSchema` carrying `reason`/`competitor` alongside `to` for
 * the one transition they are meaningful on, rather than a separate endpoint.
 */
export const transitionLicenceSchema = z
  .object({
    to: z.string().min(1),
    validUntil: z.coerce.date().optional().nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.to === "GRANTED" && !value.validUntil) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["validUntil"],
        message: "A validity/expiry date is required when marking a licence granted",
      });
    }
  });
