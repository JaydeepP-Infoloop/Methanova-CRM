import mongoose, { Schema } from "mongoose";
import { applyDomainPlugins } from "../../db/plugins/index.js";


export interface DocumentRecordAttrs {
  [key: string]: unknown;
}

const schema = new Schema({
    projectId: { type: Schema.Types.ObjectId, ref: "Project" },
    leadId: { type: Schema.Types.ObjectId, ref: "Lead" },
    kind: { type: String, required: true },
    version: { type: Number, required: true, default: 1 },
    filename: { type: String, required: true },
    storagePath: { type: String, required: true },
}, { collection: "documents" });

applyDomainPlugins(schema);

export const DocumentRecordModel = mongoose.models.DocumentRecord ?? mongoose.model("DocumentRecord", schema);
