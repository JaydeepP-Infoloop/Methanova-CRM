import mongoose, { Schema } from "mongoose";
import { ExecutionScope, WorkPackageDelayReason } from "@methanova/shared-types";
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
    /** Mirrors the latest progress update (see progress-updates.service.ts) and is forced to 100 on COMPLETED — never written directly, so it can't disagree with the progress log. */
    percentComplete: { type: Number, min: 0, max: 100, default: 0 },
    /** Stamped automatically by the first move to IN_PROGRESS — never typed in by hand. */
    actualStart: { type: Date, default: null },
    /** Stamped automatically the moment this reaches COMPLETED (see work-packages.service.ts) — never typed in by hand, so it can't disagree with the transition that actually closed it out. */
    actualEnd: { type: Date, default: null },
    responsibleUserId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    executionScope: { type: String, enum: [...Object.values(ExecutionScope), null], default: null, index: true },
    /** The SoW's fixed list. Required when moving to ON_HOLD (validation.ts and the service both check); left alone on every other transition. */
    delayReason: { type: String, enum: [...Object.values(WorkPackageDelayReason), null], default: null },
}, { collection: "work_packages" });

schema.index({ projectId: 1, sequence: 1 });

applyDomainPlugins(schema);

export const WorkPackageModel = mongoose.models.WorkPackage ?? mongoose.model("WorkPackage", schema);
