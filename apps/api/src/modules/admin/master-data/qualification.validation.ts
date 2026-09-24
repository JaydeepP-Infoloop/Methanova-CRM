import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((value) => (value ? value : undefined));

export const createCriterionSchema = z.object({
  /** Uppercase snake, matching every other enum-ish key in the system. */
  key: z
    .string()
    .trim()
    .min(2)
    .regex(/^[A-Z][A-Z0-9_]*$/, "Key must be UPPER_SNAKE_CASE"),
  label: z.string().trim().min(1, "Label is required"),
  description: optionalText,
  weight: z.coerce.number().min(0, "Weight cannot be negative"),
  sortOrder: z.coerce.number().int().default(0),
});

/** Key is immutable: stored lead scores reference it, and renaming would orphan them. */
export const updateCriterionSchema = z.object({
  label: z.string().trim().min(1).optional(),
  description: optionalText,
  weight: z.coerce.number().min(0).optional(),
  sortOrder: z.coerce.number().int().optional(),
});

export const qualificationSettingsSchema = z.object({
  recommendThreshold: z.coerce
    .number()
    .int()
    .min(0, "Threshold cannot be below 0")
    .max(100, "Threshold cannot exceed 100"),
});

export const mouApprovalSettingsSchema = z.object({
  thresholdPaise: z.coerce
    .number()
    .int("Must be an integer number of paise")
    .nonnegative("Threshold cannot be negative"),
});

/** Channel defaults only — projects may mute later; they cannot invent channels. */
export const notificationDefaultsSchema = z.object({
  inAppEnabled: z.boolean(),
  emailEnabled: z.boolean(),
  taskOverdueToAssignee: z.boolean(),
  taskOverdueToProjectManager: z.boolean(),
});
