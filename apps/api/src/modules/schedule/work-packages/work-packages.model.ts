import mongoose, { Schema } from "mongoose";
import { applyDomainPlugins } from "../../../db/plugins/index.js";
import { paiseField } from "../../../utils/http.js";

export interface WorkPackageAttrs {
  [key: string]: unknown;
}

const schema = new Schema({
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    name: { type: String, required: true },
    sequence: { type: Number, required: true, default: 1 },
    status: { type: String, required: true, default: "PLANNED" },
    plannedStart: { type: Date },
    plannedEnd: { type: Date },
    amountPaise: paiseField(),
}, { collection: "work_packages" });

applyDomainPlugins(schema);

export const WorkPackageModel = mongoose.models.WorkPackage ?? mongoose.model("WorkPackage", schema);
