import type { z } from "zod";
import type {
  assignLeadSchema,
  createActivitySchema,
  listFlatActivitiesQuerySchema,
} from "./activities.validation.js";

export type ActivityId = string;

export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type AssignLeadInput = z.infer<typeof assignLeadSchema>;
export type ListActivitiesQuery = z.infer<typeof listFlatActivitiesQuerySchema>;
