import type { z } from "zod";
import type { createLicenceSchema, transitionLicenceSchema, updateLicenceSchema } from "./licences.validation.js";

export type LicenceId = string;
export type CreateLicenceInput = z.infer<typeof createLicenceSchema>;
export type UpdateLicenceInput = z.infer<typeof updateLicenceSchema>;
export type TransitionLicenceInput = z.infer<typeof transitionLicenceSchema>;

export interface LicenceListQuery {
  limit?: number;
}
