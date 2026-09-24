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
    /** Stamped automatically the moment this reaches COMPLETED (see work-packages.service.ts) — never typed in by hand, so it can't disagree with the transition that actually closed it out. */
    actualEnd: { type: Date, default: null },
    /** Required when moving to ON_HOLD (see work-packages.validation.ts); irrelevant, and left alone, on every other transition. */
    delayReason: { type: String, trim: true, default: null },
}, { collection: "work_packages" });

applyDomainPlugins(schema);

export const WorkPackageModel = mongoose.models.WorkPackage ?? mongoose.model("WorkPackage", schema);
