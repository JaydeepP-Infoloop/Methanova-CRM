import mongoose, { Schema } from "mongoose";
import { applyDomainPlugins } from "../../../db/plugins/index.js";


export interface MasterDataAttrs {
  [key: string]: unknown;
}

const schema = new Schema({
    key: { type: String, required: true, unique: true },
    label: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, required: true, default: {} },
}, { collection: "master_data" });

applyDomainPlugins(schema);

export const MasterDataModel = mongoose.models.MasterData ?? mongoose.model("MasterData", schema);
