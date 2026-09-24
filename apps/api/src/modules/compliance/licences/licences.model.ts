import mongoose, { Schema } from "mongoose";
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
    /**
     * Set once GRANTED (required on that transition — see
     * licences.service.ts). Backs the existing GRANTED → EXPIRED transition,
     * which otherwise has no data telling it when to fire.
     */
    validUntil: { type: Date, default: null },
}, { collection: "licences" });

applyDomainPlugins(schema);

export const LicenceModel = mongoose.models.Licence ?? mongoose.model("Licence", schema);
