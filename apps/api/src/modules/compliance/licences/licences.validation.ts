import { LicenceBundle, LicenceStatus, ResponsibleParty } from "@methanova/shared-types";
import { z } from "zod";
import { flagParam, listFilterFields } from "../../../utils/query.js";

export const listLicencesQuerySchema = z.object({
  id: listFilterFields.id,
  projectId: listFilterFields.projectId,
  status: listFilterFields.status,
  overdue: listFilterFields.overdue,
  expiringSoon: listFilterFields.expiringSoon,
  appliedThisWeek: flagParam.optional(),
  openProjects: listFilterFields.openProjects,
});

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Must be a valid id");
const notInFuture = (label: string) =>
  z.coerce.date().refine((date) => date.getTime() <= Date.now(), `${label} cannot be in the future`);

const licenceFields = {
  projectId: objectId,
  licenceTypeId: objectId.optional().nullable(),
  bundle: z.nativeEnum(LicenceBundle).optional(),
  authority: z.string().trim().min(1).optional(),
  scope: z.nativeEnum(ResponsibleParty).optional().nullable(),
  assigneeUserId: objectId.optional().nullable(),
  targetDate: z.coerce.date().optional().nullable(),
  renewalLeadDays: z.coerce.number().int().min(0).max(365).optional().nullable(),
};

/**
 * Excluded on purpose: `status` (moves only through `transitionLicenceSchema`)
 * and the lifecycle dates `appliedDate`/`clearedDate`/`validFrom`/`validUntil`
 * (each stamped by the transition that makes it true). With a
 * `licenceTypeId`, `bundle`/`authority`/`scope` default from that type (see
 * the service); without one, `bundle` and `authority` must be given.
 */
export const createLicenceSchema = z.object(licenceFields).superRefine((value, ctx) => {
  if (value.licenceTypeId) return;
  if (!value.bundle) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["bundle"], message: "Required without a licence type" });
  if (!value.authority) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["authority"], message: "Required without a licence type" });
});

export const updateLicenceSchema = z.object(licenceFields).partial();

/**
 * `validUntil` only applies to the GRANTED move — required there (see the
 * superRefine below), ignored everywhere else. `appliedDate` (SUBMITTED) and
 * `clearedDate`/`validFrom` (GRANTED) are optional backdates for recording a
 * move after the fact — they default to now, and are ignored on any other
 * target. Same shape as `transitionLeadSchema` carrying extras alongside
 * `to` for the one transition they are meaningful on.
 */
export const transitionLicenceSchema = z
  .object({
    to: z.string().min(1),
    validUntil: z.coerce.date().optional().nullable(),
    appliedDate: notInFuture("The applied date").optional().nullable(),
    clearedDate: notInFuture("The grant date").optional().nullable(),
    validFrom: z.coerce.date().optional().nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.to === LicenceStatus.GRANTED && !value.validUntil) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["validUntil"],
        message: "A validity/expiry date is required when marking a licence granted",
      });
    }
    if (value.validFrom && value.validUntil && value.validFrom > value.validUntil) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["validFrom"], message: "Valid-from must be before valid-until" });
    }
  });
