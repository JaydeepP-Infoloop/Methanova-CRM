import { z } from "zod";

export const createReportSnapshotSchema = z.object({
  notes: z.string().optional(),
}).passthrough();

export const updateReportSnapshotSchema = createReportSnapshotSchema.partial();


