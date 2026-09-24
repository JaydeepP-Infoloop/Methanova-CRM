import { z } from "zod";

export const createWorkPackageSchema = z.object({
  notes: z.string().optional(),
}).passthrough();

export const updateWorkPackageSchema = createWorkPackageSchema.partial();

export const transitionWorkPackageSchema = z.object({
  to: z.string().min(1),
});
