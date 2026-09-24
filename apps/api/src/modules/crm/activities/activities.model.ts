import { ActivityOutcomeCategory, ActivityParentType, ActivityType } from "@methanova/shared-types";
import mongoose, { Schema } from "mongoose";
import { applyDomainPlugins } from "../../../db/plugins/index.js";

/**
 * Only populated when type is PLANT_VISIT — a prospect being shown a
 * reference plant is a distinct commercial event with its own follow-up
 * quality signal, which a free-text summary would lose.
 */
const plantVisitSchema = new Schema(
  {
    referencePlantId: { type: Schema.Types.ObjectId, ref: "Project", default: null },
    referencePlantName: { type: String, trim: true, default: null },
    visitorCount: { type: Number, min: 0, default: null },
    visitorDesignations: { type: String, trim: true, default: null },
    travelArrangedBy: { type: String, trim: true, default: null },
    feedbackRating: { type: Number, min: 1, max: 5, default: null },
    feedbackNotes: { type: String, trim: true, default: null },
  },
  { _id: false },
);

/**
 * Only populated when type is SITE_VISIT.
 *
 * NOTE FOR MODULE B: this record is the intended seed for the statutory
 * feasibility survey. When that module is built, the survey should be created
 * from the site visit's coordinates and observations rather than asking an
 * engineer to re-enter what a salesperson already captured on site.
 */
const siteVisitSchema = new Schema(
  {
    gpsLat: { type: Number, min: -90, max: 90, default: null },
    gpsLng: { type: Number, min: -180, max: 180, default: null },
    observations: { type: String, trim: true, default: null },
  },
  { _id: false },
);

const schema = new Schema(
  {
    // Polymorphic parent: leads today, projects once Module B exists. Kept as
    // a pair rather than separate collections so the timeline component and
    // its queries work unchanged when projects start logging activities.
    parentType: {
      type: String,
      required: true,
      enum: Object.values(ActivityParentType),
      default: ActivityParentType.LEAD,
      index: true,
    },
    parentId: { type: Schema.Types.ObjectId, required: true, index: true },

    /** Per-parent running number allocated from the atomic counters service. */
    sequenceNo: { type: Number, required: true },

    type: { type: String, required: true, enum: Object.values(ActivityType), index: true },
    occurredAt: { type: Date, required: true, default: Date.now, index: true },

    /**
     * Who logged the activity — distinct from `internalParticipantIds`, who
     * were on the call or visit itself. Persisted here as a real field rather
     * than left to the audit plugin's `$locals.actorId`, because the Activity
     * Log needs to filter "my activities" directly; the audit trail's copy of
     * the actor is for reconstructing history, not for a list page's WHERE
     * clause.
     */
    loggedByUserId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },

    internalParticipantIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    /**
     * Names rather than refs: the lead's contacts are embedded subdocuments
     * with no stable id of their own, and an activity should keep saying who
     * was spoken to even if that contact is later edited off the lead.
     */
    externalContactNames: [{ type: String, trim: true }],

    summary: { type: String, required: true, trim: true },
    /**
     * `outcomeCategory` is the guardrail: a short pick-list, checked server-side
     * in activities.validation.ts. `outcome` remains free text, but only as
     * elaboration on a chosen category — the validator refuses free text with
     * no category attached, which is what previously let an Excel date serial
     * ("43244") and a bare "120" into production rows with nothing to anchor
     * them.
     */
    outcomeCategory: { type: String, enum: [...Object.values(ActivityOutcomeCategory), null], default: null },
    outcome: { type: String, trim: true, default: null },

    /** Indexed for the flat Activity Log's own hasFollowUp/overdueFollowUp filters. */
    nextFollowUpDate: { type: Date, default: null, index: true },
    nextFollowUpAction: { type: String, trim: true, default: null },

    plantVisit: { type: plantVisitSchema, default: null },
    siteVisit: { type: siteVisitSchema, default: null },
  },
  { collection: "activities" },
);

// The timeline is always "this parent, newest first".
schema.index({ parentType: 1, parentId: 1, occurredAt: -1 });
// Walking "the activity that answered this one's follow-up" needs the same
// parent's activities in creation order, not occurrence order — sequenceNo is
// gapless per parent and never reassigned, so it is the stable order to walk.
schema.index({ parentType: 1, parentId: 1, sequenceNo: 1 });

applyDomainPlugins(schema);

export const ActivityModel = mongoose.models.Activity ?? mongoose.model("Activity", schema);
