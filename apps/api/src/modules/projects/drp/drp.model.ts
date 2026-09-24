import mongoose, { Schema } from "mongoose";
import { applyDomainPlugins } from "../../../db/plugins/index.js";


export interface DprAttrs {
  [key: string]: unknown;
}

const schema = new Schema({
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    version: { type: Number, required: true, default: 1 },
    summary: { type: String },
    capacityNm3: { type: Number, integer: true },
}, { collection: "dprs" });

applyDomainPlugins(schema);

export const DprModel = mongoose.models.Dpr ?? mongoose.model("Dpr", schema);
