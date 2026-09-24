import mongoose, { Schema } from "mongoose";
import { applyDomainPlugins } from "../../../db/plugins/index.js";


export interface ProgressUpdateAttrs {
  [key: string]: unknown;
}

const schema = new Schema({
    workPackageId: { type: Schema.Types.ObjectId, ref: "WorkPackage", required: true },
    percentComplete: { type: Number, required: true, min: 0, max: 100 },
    notes: { type: String },
    at: { type: Date, required: true, default: Date.now },
}, { collection: "progress_updates" });

applyDomainPlugins(schema);

export const ProgressUpdateModel = mongoose.models.ProgressUpdate ?? mongoose.model("ProgressUpdate", schema);
