import { QuotationStatus } from "@methanova/shared-types";
import mongoose, { Schema } from "mongoose";
import { applyDomainPlugins } from "../../../db/plugins/index.js";
import { paiseField } from "../../../utils/http.js";

const priceLineSchema = new Schema(
  {
    description: { type: String, required: true, trim: true },
    amountPaise: paiseField(),
    hsnSac: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const paymentMilestoneSchema = new Schema(
  {
    description: { type: String, required: true, trim: true },
    percentage: { type: Number, required: true, min: 0, max: 100 },
    dueOnMilestone: { type: String, trim: true, default: null },
  },
  { _id: false },
);

/**
 * The template this quotation proposes. Not a separate master collection —
 * unlike a licence type, a payment structure is specific to one deal's
 * negotiation, not a reusable reference row every quotation picks from. It
 * rides on the quotation itself, and locks onto the MOU via
 * `acceptedQuotationId` the moment that quotation is accepted.
 */
const paymentTermsTemplateSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    milestones: {
      type: [paymentMilestoneSchema],
      required: true,
      validate: {
        validator: (lines: unknown[]) => lines.length > 0,
        message: "At least one payment milestone is required",
      },
    },
  },
  { _id: false },
);

const schema = new Schema(
  {
    leadId: { type: Schema.Types.ObjectId, ref: "Lead", required: true, index: true },
    revision: { type: Number, required: true, default: 1 },
    parentQuotationId: { type: Schema.Types.ObjectId, ref: "Quotation", default: null },
    /**
     * Shared by every revision in one lineage — set to its own id on revision
     * 1, inherited from the parent on every later one. Lets the
     * revision-comparison endpoint find the whole family in a single indexed
     * query instead of walking `parentQuotationId` links one at a time.
     */
    rootQuotationId: { type: Schema.Types.ObjectId, ref: "Quotation", required: true, index: true },
    /** Required on every revision after the first — see quotations.validation.ts. */
    revisionReason: { type: String, trim: true, default: null },
    status: {
      type: String,
      required: true,
      enum: Object.values(QuotationStatus),
      default: QuotationStatus.DRAFT,
    },
    capacityTpd: { type: Number, required: true, min: 0 },
    feedstockBasis: { type: String, required: true, trim: true },
    expectedCbgTpd: { type: Number, required: true, min: 0 },
    priceLines: {
      type: [priceLineSchema],
      required: true,
      validate: {
        validator: (lines: unknown[]) => lines.length > 0,
        message: "At least one price line is required",
      },
    },
    scopeInclusions: { type: [String], default: [] },
    scopeExclusions: { type: [String], default: [] },
    paymentTermsTemplate: { type: paymentTermsTemplateSchema, required: true },
    notes: { type: String, trim: true, default: null },
    /** Derived server-side as the sum of `priceLines` — never accepted from the client. */
    totalPaise: paiseField(),
  },
  { collection: "quotations" },
);

applyDomainPlugins(schema);

export const QuotationModel = mongoose.models.Quotation ?? mongoose.model("Quotation", schema);
