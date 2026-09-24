import mongoose, { Schema } from "mongoose";
import { applyDomainPlugins } from "../../../db/plugins/index.js";


export interface FeasibilitySurveyAttrs {
  [key: string]: unknown;
}

const schema = new Schema({
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    version: { type: Number, required: true, default: 1 },
    findings: { type: String },
    statutoryNotes: { type: String },
}, { collection: "feasibility_surveys" });

applyDomainPlugins(schema);

export const FeasibilitySurveyModel = mongoose.models.FeasibilitySurvey ?? mongoose.model("FeasibilitySurvey", schema);
