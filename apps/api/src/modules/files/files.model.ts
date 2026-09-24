import { StoredFileKind } from "@methanova/shared-types";
import mongoose, { Schema } from "mongoose";
import { applyDomainPlugins } from "../../db/plugins/index.js";

const schema = new Schema(
  {
    kind: { type: String, required: true, enum: Object.values(StoredFileKind), index: true },
    mime: { type: String, required: true },
    bytes: { type: Number, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    originalFilename: { type: String, required: true },
    storageKey: { type: String, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", default: null },
  },
  { collection: "files" },
);

applyDomainPlugins(schema);

export const StoredFileModel = mongoose.models.StoredFile ?? mongoose.model("StoredFile", schema);
