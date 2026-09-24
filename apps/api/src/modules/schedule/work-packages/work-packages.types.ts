import type { z } from "zod";
import type {
  createWorkPackageSchema,
  transitionWorkPackageSchema,
  updateWorkPackageSchema,
} from "./work-packages.validation.js";

export type WorkPackageId = string;
export type CreateWorkPackageInput = z.infer<typeof createWorkPackageSchema>;
export type UpdateWorkPackageInput = z.infer<typeof updateWorkPackageSchema>;
export type TransitionWorkPackageInput = z.infer<typeof transitionWorkPackageSchema>;

export interface WorkPackageListQuery {
  limit?: number;
}
