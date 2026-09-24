import mongoose, { Schema } from "mongoose";
import { applyDomainPlugins } from "../../db/plugins/index.js";


export interface ReportSnapshotAttrs {
  [key: string]: unknown;
}

const schema = new Schema({
    name: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, required: true, default: {} },
    generatedAt: { type: Date, required: true, default: Date.now },
}, { collection: "report_snapshots" });

applyDomainPlugins(schema);

export const ReportSnapshotModel = mongoose.models.ReportSnapshot ?? mongoose.model("ReportSnapshot", schema);
