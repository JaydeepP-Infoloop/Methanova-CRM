import { z } from "zod";

export const createFeasibilitySurveySchema = z.object({
  notes: z.string().optional(),
}).passthrough();

export const updateFeasibilitySurveySchema = createFeasibilitySurveySchema.partial();


