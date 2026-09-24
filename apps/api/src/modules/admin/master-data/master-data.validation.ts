import { z } from "zod";

export const createMasterDataSchema = z.object({
  notes: z.string().optional(),
}).passthrough();

export const updateMasterDataSchema = createMasterDataSchema.partial();


