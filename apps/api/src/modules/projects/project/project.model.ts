import { OPEN_PROJECT_STATUSES, ProjectStatus, ResponsibleParty } from "@methanova/shared-types";
import mongoose, { Schema } from "mongoose";
import { applyDomainPlugins } from "../../../db/plugins/index.js";
import { optionalPaiseField } from "../../../utils/http.js";

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
    /** Copied from the lead at MOU signing; the structured counterpart of the free-text `feedstockBasis`. */
    feedstockTypeIds: { type: [{ type: Schema.Types.ObjectId, ref: "FeedstockType" }], default: [] },
    civilScope: { type: String, enum: [...Object.values(ResponsibleParty), null], default: null },
    /** Copied from the signed MOU. Null on projects signed before this field existed. */
    contractValuePaise: optionalPaiseField(),
    /** The MOU's committed date — set once at signing and never overwritten; not in the update schema. Slippage goes in `revisedTargetDate`, so the original promise stays measurable. */
    targetCommissioningDate: { type: Date, default: null },
    revisedTargetDate: { type: Date, default: null },
    /** Stamped by the COMMISSIONING → HANDED_OVER transition — never typed in by hand. */
    actualCommissioningDate: { type: Date, default: null },
    projectManagerUserId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    siteEngineerUserId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    liaisonOfficerUserId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    members: { type: [memberSchema], default: [] },
    /** Null means inherit the org letterhead. */
    letterheadFileId: { type: Schema.Types.ObjectId, ref: "StoredFile", default: null },
  },
  { collection: "projects" },
);

applyDomainPlugins(schema);

export const ProjectModel = mongoose.models.Project ?? mongoose.model("Project", schema);

/** `{ projectId: { $in: [...] } }` over every open (not Completed), non-deleted project — the scope the dashboard's live-risk figures use, so their drill-down lists can match them exactly. */
export async function openProjectScope(): Promise<Record<string, unknown>> {
  const rows = await ProjectModel.find({ status: { $in: OPEN_PROJECT_STATUSES } }).select("_id").lean();
  return { projectId: { $in: rows.map((row) => row._id) } };
}

/**
 * "Assigned to me" — the one definition behind `/api/projects?mine=true`,
 * the work-package list's `?mine=1`, and the Project Manager's KPI row: the
 * user is the project's PM, site engineer, liaison officer, or a team member.
 */
export function assignedToUserFilter(userId: string): Record<string, unknown> {
  const id = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : null;
  return {
    $or: [
      { projectManagerUserId: id },
      { siteEngineerUserId: id },
      { liaisonOfficerUserId: id },
      { "members.userId": id },
    ],
  };
}

/** Open projects assigned to the user, with status — scoped exactly like the dashboard's other live-risk figures. */
export async function listMyOpenProjects(userId: string): Promise<{ _id: mongoose.Types.ObjectId; status: string }[]> {
  return ProjectModel.find({ ...assignedToUserFilter(userId), status: { $in: OPEN_PROJECT_STATUSES } })
    .select("_id status")
    .lean<{ _id: mongoose.Types.ObjectId; status: string }[]>();
}
