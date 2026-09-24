import { z } from "zod";
import { ExecutionScope, WorkPackageDelayReason, WorkPackageStatus } from "@methanova/shared-types";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Must be a valid id");
const paise = z.coerce.number().int("Monetary values must be integer paise").nonnegative();

/**
 * Excluded on purpose: `status` (moves only through `transitionWorkPackageSchema`),
 * `actualStart`/`actualEnd` (stamped by the transitions), `percentComplete`
 * (mirrors the progress log) and `delayReason` (set by the ON_HOLD move).
 * Each has exactly one sanctioned writer, so none can drift from the event
 * it records.
 */
export const createWorkPackageSchema = z.object({
  projectId: objectId,
  name: z.string().trim().min(1),
  sequence: z.coerce.number().int().min(1),
  plannedStart: z.coerce.date().optional().nullable(),
  plannedEnd: z.coerce.date().optional().nullable(),
  amountPaise: paise,
  responsibleUserId: objectId.optional().nullable(),
  executionScope: z.nativeEnum(ExecutionScope).optional().nullable(),
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
    delayReason: z.nativeEnum(WorkPackageDelayReason).optional().nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.to === WorkPackageStatus.ON_HOLD && !value.delayReason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["delayReason"],
        message: "A delay reason is required when putting a work package on hold",
      });
    }
  });
