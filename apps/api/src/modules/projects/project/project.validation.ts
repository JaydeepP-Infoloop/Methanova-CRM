import { ProjectStatus } from "@methanova/shared-types";
import { z } from "zod";

export const updateProjectSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  shortName: z.string().trim().max(80).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  projectManagerUserId: z.string().nullable().optional(),
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
