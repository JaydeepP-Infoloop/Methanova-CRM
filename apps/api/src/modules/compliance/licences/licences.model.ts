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
}, { collection: "licences" });

applyDomainPlugins(schema);

export const LicenceModel = mongoose.models.Licence ?? mongoose.model("Licence", schema);
