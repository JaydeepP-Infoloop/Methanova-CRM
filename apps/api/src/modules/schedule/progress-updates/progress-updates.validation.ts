import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Must be a valid id");

export const createProgressUpdateSchema = z.object({
  workPackageId: objectId,
  percentComplete: z.coerce.number().min(0).max(100),
  notes: z.string().trim().optional().nullable(),
  at: z.coerce.date().optional(),
});

/** An update can't move to a different work package — that would silently rewrite two packages' progress at once. */
export const updateProgressUpdateSchema = createProgressUpdateSchema.omit({ workPackageId: true }).partial();
