import { z } from "zod";

export const createDprSchema = z.object({
  notes: z.string().optional(),
}).passthrough();

export const updateDprSchema = createDprSchema.partial();


