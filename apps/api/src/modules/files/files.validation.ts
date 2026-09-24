import { StoredFileKind } from "@methanova/shared-types";
import { z } from "zod";

export const uploadFileSchema = z.object({
  kind: z.enum([StoredFileKind.ORG_LOGO, StoredFileKind.PROJECT_LETTERHEAD]),
  filename: z.string().min(1).max(200),
  dataBase64: z.string().min(1),
  projectId: z.string().optional(),
});

export const orgLetterheadPatchSchema = z.object({
  legalName: z.string().min(1).max(200).optional(),
});
