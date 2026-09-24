import { z } from "zod";

export const createProgressUpdateSchema = z.object({
  notes: z.string().optional(),
}).passthrough();

export const updateProgressUpdateSchema = createProgressUpdateSchema.partial();


