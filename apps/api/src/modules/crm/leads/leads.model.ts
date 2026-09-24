import {
  DEFAULT_LEAD_TEMPERATURE,
  EntityType,
  FeedstockTieupStatus,
  LeadTemperature,
  NEW_LEAD_STAGE,
  QualificationDecision,
} from "@methanova/shared-types";
import mongoose, { Schema } from "mongoose";
import { applyDomainPlugins } from "../../../db/plugins/index.js";
import { optionalPaiseField } from "../../../utils/http.js";

/**
 * Contacts are embedded rather than a separate collection: they have no life
 * of their own outside the lead, are always read with it, and are small in
 * number. Exactly one must be primary — enforced in leads.validation.ts and
 * re-checked in the service, because a schema-level rule cannot see the whole
 * array on a partial update.
 */
const contactSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    designation: { type: String, trim: true },
    mobile: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    isPrimary: { type: Boolean, default: false },
    isDecisionMaker: { type: Boolean, default: false },
  },
  { _id: false },
);

/**
 * One qualification per lead, always read with it, so it is embedded rather
 * than a collection. `totalScore` is derived server-side from `scores` and the
 * criteria weights — the client never supplies it.
 */
const qualificationSchema = new Schema(
  {
    scores: [
      {
        _id: false,
        criterionKey: { type: String, required: true },
        score: { type: Number, required: true, min: 0, max: 5 },
        note: { type: String, trim: true, default: null },
      },
    ],
    totalScore: { type: Number, required: true, default: 0 },
    decision: { type: String, enum: [...Object.values(QualificationDecision), null], default: null },
    decidedAt: { type: Date, default: null },
    decidedByUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    disqualificationReason: { type: String, trim: true, default: null },
    /**
     * The budget band the client indicated during screening. It lives inside
     * the qualification sub-document rather than at the lead root because the
     * SoW ties budget to the Qualified stage: it is an output of screening,
     * recorded with the assessment that produced it and carrying that
     * assessment's date and author, not a property the lead had all along.
     * `indicativeValuePaise` at the root is the different thing — what we
     * think the deal is worth, known from the enquiry onwards.
     */
    budgetMinPaise: optionalPaiseField(),
    budgetMaxPaise: optionalPaiseField(),
  },
  { _id: false },
);

/**
 * Parking is orthogonal to the stage, not a stage of its own. A lead the
 * client has asked us to revisit after the monsoon is still a NEGOTIATION
 * lead — it has simply gone quiet — and the SoW requires it to resume from
 * exactly where it was. Modelling "parked" as a stage would destroy that
 * position and would also have to be bolted into TRANSITION_MAP as a state
 * every other stage can reach and return from, which is not a lifecycle so
 * much as a flag pretending to be one.
 *
 * `parkedFromStage` therefore records where the lead stood when it was
 * shelved. The stage field itself is never touched, so unparking is just
 * clearing this sub-document.
 */
const parkedSchema = new Schema(
  {
    isParked: { type: Boolean, required: true, default: false },
    reason: { type: String, trim: true, default: null },
    /**
     * My Day surfaces a parked lead on this date — indexed for exactly that
     * query, the same reason `reengageOn` and `nextActionDate` are.
     */
    revisitDate: { type: Date, default: null, index: true },
    parkedFromStage: { type: String, default: null },
    parkedAt: { type: Date, default: null },
  },
  { _id: false },
);

const schema = new Schema(
  {
    // System-set on creation; the client never sends these.
    leadCode: { type: String, required: true, unique: true },
    stage: { type: String, required: true, default: NEW_LEAD_STAGE },
    stageSince: { type: Date, required: true, default: Date.now },
    temperature: {
      type: String,
      required: true,
      enum: Object.values(LeadTemperature),
      default: DEFAULT_LEAD_TEMPERATURE,
    },
    /** Null means unassigned — the inbox's "Unassigned" count is derived from this. */
    ownerUserId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    /** Null means nobody has responded yet — drives the "No first response" count. */
    firstResponseAt: { type: Date, default: null, index: true },

    // Company identity
    companyName: { type: String, required: true, trim: true, index: true },
    entityType: { type: String, enum: [...Object.values(EntityType), null], default: null },
    gstin: { type: String, trim: true, uppercase: true, default: null },
    pan: { type: String, trim: true, uppercase: true, default: null },
    cin: { type: String, trim: true, uppercase: true, default: null },

    contacts: { type: [contactSchema], required: true },

    // Geography — references into the master collections, each validated
    // against its stated parent in the service before save.
    stateId: { type: Schema.Types.ObjectId, ref: "GeoState", required: true, index: true },
    districtId: { type: Schema.Types.ObjectId, ref: "GeoDistrict", required: true, index: true },
    talukaId: { type: Schema.Types.ObjectId, ref: "GeoTaluka", required: true },
    villageId: { type: Schema.Types.ObjectId, ref: "GeoVillage", default: null },

    registeredAddress: { type: String, trim: true, default: null },
    siteAddress: { type: String, trim: true, default: null },

    leadSourceId: { type: Schema.Types.ObjectId, ref: "LeadSource", required: true, index: true },
    sourceDetail: { type: String, trim: true, default: null },

    feedstockTypeIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "FeedstockType" }],
      default: [],
    },
    feedstockQtyTpd: { type: Number, required: true, min: 0 },
    feedstockTieupStatus: {
      type: String,
      enum: [...Object.values(FeedstockTieupStatus), null],
      default: null,
    },
    /**
     * Derived, never client-supplied: sum(yieldFactor) × feedstockQtyTpd,
     * recomputed by the service whenever either input changes. Stored so the
     * inbox can sort and filter on it without joining feedstock masters.
     */
    expectedCbgTpd: { type: Number, required: true, default: 0 },

    /**
     * What we think this deal is worth, in integer paise (hard rule #1 — never
     * a float, never rupees). Optional and nullable: at enquiry nobody knows,
     * and null must stay distinguishable from a genuine zero so the inbox can
     * show an em dash instead of implying a worthless deal. Summed across the
     * filtered result set by the inbox summary.
     */
    indicativeValuePaise: optionalPaiseField(),

    nextAction: { type: String, required: true, trim: true },
    nextActionDate: { type: Date, required: true, index: true },
    /**
     * Provenance for the commitment above. All three are null on a lead whose
     * `nextAction` still comes from intake — `AddLeadWizard` sets it with no
     * activity behind it, so "which activity promised this" cannot be derived
     * by querying the latest activity; it has to be recorded at the moment the
     * commitment is made. `createLeadActivity` in activities.service.ts is the
     * only writer once the first follow-up is logged, and every write after
     * that replaces all three together, so they can never point at different
     * moments.
     */
    nextActionSourceActivityId: { type: Schema.Types.ObjectId, ref: "Activity", default: null },
    nextActionPromisedAt: { type: Date, default: null },
    nextActionPromisedByUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },

    qualification: { type: qualificationSchema, default: null },
    /**
     * Surfaced on the lead rather than left in the audit trail: "why did we
     * lose this" is a question the team asks constantly, and it should not
     * require querying audit_logs to answer.
     */
    lostReason: { type: String, trim: true, default: null },
    /**
     * Both optional, both only meaningful alongside `lostReason`. "Who did we
     * lose to" is the single most useful thing to aggregate across lost leads,
     * and "when might this come back" is a commitment worth keeping on the
     * record rather than in someone's calendar. Neither is required, because
     * plenty of leads die without a competitor and without a second chance.
     * `reengageOn` is indexed for the same reason `nextActionDate` is — My Day
     * reads it directly to surface a lost lead on the day it said to try again.
     */
    competitor: { type: String, trim: true, default: null },
    reengageOn: { type: Date, default: null, index: true },

    parked: { type: parkedSchema, default: null },
  },
  { collection: "leads" },
);

// The inbox's default ordering is longest-waiting-first, and its text search
// hits these two fields only.
schema.index({ createdAt: 1 });
schema.index({ companyName: "text", leadCode: "text" });

applyDomainPlugins(schema);

export const LeadModel = mongoose.models.Lead ?? mongoose.model("Lead", schema);
