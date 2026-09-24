import {
  ActivityOutcomeCategory,
  ActivityParentType,
  ActivityType,
  requiresPlantVisitDetail,
  requiresSiteVisitDetail,
} from "@methanova/shared-types";
import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Must be a valid id");

const optionalText = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((value) => (value ? value : undefined));

const plantVisitSchema = z.object({
  referencePlantId: objectId.optional().nullable(),
  referencePlantName: optionalText,
  visitorCount: z.coerce.number().int().min(0).optional().nullable(),
  visitorDesignations: optionalText,
  travelArrangedBy: optionalText,
  feedbackRating: z.coerce.number().int().min(1).max(5).optional().nullable(),
  feedbackNotes: optionalText,
});

const siteVisitSchema = z.object({
  gpsLat: z.coerce.number().min(-90).max(90).optional().nullable(),
  gpsLng: z.coerce.number().min(-180).max(180).optional().nullable(),
  observations: optionalText,
});

export const createActivitySchema = z
  .object({
    type: z.enum(Object.values(ActivityType) as [string, ...string[]]),
    occurredAt: z.coerce.date().default(() => new Date()),
    internalParticipantIds: z.array(objectId).default([]),
    externalContactNames: z.array(z.string().trim().min(1)).default([]),
    summary: z.string().trim().min(1, "Summary is required"),
    /**
     * The guardrail: `outcomeCategory` is the short pick-list, `outcome` is
     * optional elaboration on it. A raw MongoDB collection has no column
     * types to stop a pasted spreadsheet cell from landing in a free-text
     * field, which is exactly what let an Excel date serial ("43244") and a
     * bare "120" into production rows — so free text is refused outright
     * unless a category is chosen alongside it, in the superRefine below.
     */
    outcomeCategory: z.enum(Object.values(ActivityOutcomeCategory) as [string, ...string[]]).optional().nullable(),
    outcome: optionalText,
    nextFollowUpDate: z.coerce.date().optional().nullable(),
    nextFollowUpAction: optionalText,
    plantVisit: plantVisitSchema.optional().nullable(),
    siteVisit: siteVisitSchema.optional().nullable(),
  })
  .superRefine((value, ctx) => {
    // The structured sub-documents are meaningful only for their own type.
    // Accepting a plantVisit on a CALL would quietly produce data nobody can
    // trust, so it is rejected rather than silently dropped.
    if (value.plantVisit && !requiresPlantVisitDetail(value.type)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["plantVisit"],
        message: "Plant visit details only apply to a plant visit",
      });
    }
    if (value.siteVisit && !requiresSiteVisitDetail(value.type)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["siteVisit"],
        message: "Site visit details only apply to a site visit",
      });
    }
    if (value.occurredAt > new Date()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["occurredAt"],
        message: "An activity cannot have happened in the future",
      });
    }
    if (value.outcome && !value.outcomeCategory) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["outcomeCategory"],
        message: "Pick an outcome category before adding detail",
      });
    }
  });

export const assignLeadSchema = z.object({
  /** Omitted means "assign to me" — the controller substitutes the caller. */
  userId: objectId.optional().nullable(),
});

export const listActivitiesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

const booleanFlag = z
  .enum(["true", "false"])
  .optional()
  .transform((value) => value === "true");

/**
 * The flat Activity Log's own query — real filters and real pagination,
 * replacing the old scaffold's bare `limit`. `type` accepts either a repeated
 * query param (`?type=CALL&type=EMAIL`, what a native multi-select produces)
 * or a comma-separated one, since either is a reasonable way to serialise a
 * multi-value filter into a URL.
 */
export const listFlatActivitiesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  type: z.preprocess(
    (value) => {
      if (value === undefined) return undefined;
      return Array.isArray(value) ? value : String(value).split(",").filter(Boolean);
    },
    z.array(z.enum(Object.values(ActivityType) as [string, ...string[]])).optional(),
  ),
  parentType: z.enum(Object.values(ActivityParentType) as [string, ...string[]]).optional(),
  leadId: objectId.optional(),
  loggedByUserId: objectId.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  hasFollowUp: booleanFlag,
  overdueFollowUp: booleanFlag,
});
