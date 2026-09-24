import { HttpError } from "../../../utils/http.js";
import { RoleRecordModel as TheModel } from "./roles.model.js";
import { applyActor } from "../../../db/plugins/audit.plugin.js";

export async function listRoleRecords() {
  return TheModel.find().sort({ createdAt: -1 }).limit(100);
}

export async function getRoleRecord(id: string) {
  const doc = await TheModel.findById(id);
  if (!doc) throw new HttpError(404, "RoleRecord not found");
  return doc;
}

export async function createRoleRecord(payload: Record<string, unknown>, actorId?: string) {
  const doc = new TheModel(payload);
  applyActor(doc, actorId, "create");
  return doc.save();
}

export async function updateRoleRecord(id: string, payload: Record<string, unknown>, actorId?: string) {
  const doc = await getRoleRecord(id);
  Object.assign(doc, payload);
  applyActor(doc, actorId, "update");
  return doc.save();
}

export async function softDeleteRoleRecord(id: string, actorId?: string) {
  const doc = await getRoleRecord(id);
  return doc.softDelete(actorId);
}


