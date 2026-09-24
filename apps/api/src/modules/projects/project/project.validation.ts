import { ProjectStatus, ResponsibleParty } from "@methanova/shared-types";
import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Must be a valid id");

/**
 * Projects are normally created by `signMou()`, which copies the contractual
 * fields from the MOU. This schema only stops the raw `POST /api/projects`
 * route from writing arbitrary fields. Excluded on purpose: `status` (moves
 * only through transitions) and `actualCommissioningDate` (stamped by the
 * HANDED_OVER transition).
 */
export const createProjectSchema = z.object({
  leadId: objectId,
  mouId: objectId,
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(200),
  shortName: z.string().trim().max(80).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  siteAddress: z.string().trim().max(500).nullable().optional(),
  capacityTpd: z.coerce.number().positive().nullable().optional(),
  feedstockBasis: z.string().trim().max(500).nullable().optional(),
  feedstockTypeIds: z.array(objectId).max(20).optional(),
  civilScope: z.nativeEnum(ResponsibleParty).nullable().optional(),
  contractValuePaise: z.coerce.number().int("Monetary values must be integer paise").nonnegative().nullable().optional(),
  targetCommissioningDate: z.coerce.date().nullable().optional(),
});

/**
 * Deliberately absent: `targetCommissioningDate` (the MOU's promise — set
 * once, never overwritten; slippage goes in `revisedTargetDate`) and
 * `contractValuePaise`/`civilScope`/`capacityTpd` (contract terms — they
 * change only through a superseding MOU, not a project edit).
 */
export const updateProjectSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  shortName: z.string().trim().max(80).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  projectManagerUserId: objectId.nullable().optional(),
  siteEngineerUserId: objectId.nullable().optional(),
  liaisonOfficerUserId: objectId.nullable().optional(),
  revisedTargetDate: z.coerce.date().nullable().optional(),
  feedstockTypeIds: z.array(objectId).max(20).optional(),
});

export const transitionProjectSchema = z.object({
  to: z.enum([
    ProjectStatus.ACTIVE,
    ProjectStatus.ON_HOLD,
    ProjectStatus.COMMISSIONING,
    ProjectStatus.HANDED_OVER,
    ProjectStatus.OM,
  ]),
});

export const replaceMembersSchema = z.object({
  userIds: z.array(z.string()).max(50),
});

export const uploadProjectLetterheadSchema = z.object({
  filename: z.string().min(1).max(200),
  dataBase64: z.string().min(1),
});
