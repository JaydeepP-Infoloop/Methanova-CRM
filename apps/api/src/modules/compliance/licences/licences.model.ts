import mongoose, { Schema } from "mongoose";
import { ResponsibleParty } from "@methanova/shared-types";
import { applyDomainPlugins } from "../../../db/plugins/index.js";

export interface LicenceAttrs {
  [key: string]: unknown;
}

const schema = new Schema({
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    /** The master row this checklist entry was instantiated from — see signMou(). Denormalises bundle/authority below at creation time. */
    licenceTypeId: { type: Schema.Types.ObjectId, ref: "LicenceType", default: null },
    bundle: { type: String, required: true, enum: ["PRE_CTE", "CTE", "CTO"] },
    authority: { type: String, default: "SPCB" },
    status: { type: String, required: true, default: "NOT_STARTED" },
    visits: [{ at: Date, notes: String, officer: String }],
    queries: [{ at: Date, question: String, response: String, status: String }],
    /**
     * When this licence is expected to be granted by — defaulted at creation
     * (see `signMou()`) from the MOU's own `targetCommissioningDate`, on the
     * grounds that every statutory approval should ideally be in hand before
     * commissioning. Not an invented per-licence offset; it is that same real
     * date, unmodified.
     */
    targetDate: { type: Date, default: null },
    /** Copied from the licence type at creation (see signMou()); editable, because a deal can move a licence into the client's scope. */
    scope: { type: String, enum: [...Object.values(ResponsibleParty), null], default: null, index: true },
    assigneeUserId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    /** Stamped by the first move to SUBMITTED (a query-response resubmission keeps the original). */
    appliedDate: { type: Date, default: null },
    /** Both stamped by the GRANTED transition — the grant date, which a caller may backdate to the letter's date but never set outside that move. */
    clearedDate: { type: Date, default: null },
    validFrom: { type: Date, default: null },
    /**
     * Set once GRANTED (required on that transition — see
     * licences.service.ts). Backs the existing GRANTED → EXPIRED transition,
     * which otherwise has no data telling it when to fire.
     */
    validUntil: { type: Date, default: null },
    /** How many days before `validUntil` renewal work should start. Null = no reminder policy set for this licence. */
    renewalLeadDays: { type: Number, min: 0, default: null },
}, { collection: "licences" });

applyDomainPlugins(schema);

export const LicenceModel = mongoose.models.Licence ?? mongoose.model("Licence", schema);
