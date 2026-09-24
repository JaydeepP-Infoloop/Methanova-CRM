import { z } from "zod";

export const createLicenceSchema = z.object({
  notes: z.string().optional(),
}).passthrough();

export const updateLicenceSchema = createLicenceSchema.partial();

export const transitionLicenceSchema = z.object({
  to: z.string().min(1),
});
