import { z } from "zod";

export const createRoleRecordSchema = z.object({
  notes: z.string().optional(),
}).passthrough();

export const updateRoleRecordSchema = createRoleRecordSchema.partial();


