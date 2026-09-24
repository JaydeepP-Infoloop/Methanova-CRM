import { ProjectStatus, ResponsibleParty } from "@methanova/shared-types";
import mongoose, { Schema } from "mongoose";
import { applyDomainPlugins } from "../../../db/plugins/index.js";

const memberSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    addedAt: { type: Date, default: Date.now },
    addedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { _id: false },
);

const schema = new Schema(
  {
    leadId: { type: Schema.Types.ObjectId, ref: "Lead", required: true },
    mouId: { type: Schema.Types.ObjectId, ref: "Mou", required: true },
    code: { type: String, required: true, unique: true },
    /** Named after the client, not the project code — see signMou(). */
    name: { type: String, required: true },
    shortName: { type: String, trim: true, default: null },
    description: { type: String, trim: true, default: null },
    status: { type: String, required: true, default: ProjectStatus.ACTIVE, enum: Object.values(ProjectStatus) },
    siteAddress: { type: String, trim: true, default: null },
    stateId: { type: Schema.Types.ObjectId, ref: "GeoState", default: null },
    districtId: { type: Schema.Types.ObjectId, ref: "GeoDistrict", default: null },
    talukaId: { type: Schema.Types.ObjectId, ref: "GeoTaluka", default: null },
    villageId: { type: Schema.Types.ObjectId, ref: "GeoVillage", default: null },
    capacityTpd: { type: Number, default: null },
    feedstockBasis: { type: String, trim: true, default: null },
    civilScope: { type: String, enum: [...Object.values(ResponsibleParty), null], default: null },
    targetCommissioningDate: { type: Date, default: null },
    projectManagerUserId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    members: { type: [memberSchema], default: [] },
    /** Null means inherit the org letterhead. */
    letterheadFileId: { type: Schema.Types.ObjectId, ref: "StoredFile", default: null },
  },
  { collection: "projects" },
);

applyDomainPlugins(schema);

export const ProjectModel = mongoose.models.Project ?? mongoose.model("Project", schema);
