import mongoose, { Schema } from "mongoose";
import { applyDomainPlugins } from "../../../db/plugins/index.js";


export interface RoleRecordAttrs {
  [key: string]: unknown;
}

const schema = new Schema({
    key: { type: String, required: true, unique: true },
    label: { type: String, required: true },
    description: { type: String },
}, { collection: "roles" });

applyDomainPlugins(schema);

export const RoleRecordModel = mongoose.models.RoleRecord ?? mongoose.model("RoleRecord", schema);
