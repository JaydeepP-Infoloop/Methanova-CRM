import { z } from "zod";

export const createDocumentRecordSchema = z.object({
  notes: z.string().optional(),
}).passthrough();

export const updateDocumentRecordSchema = createDocumentRecordSchema.partial();


