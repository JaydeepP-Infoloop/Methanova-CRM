import { HttpError } from "../../../utils/http.js";
import { DprModel as TheModel } from "./drp.model.js";
import { applyActor } from "../../../db/plugins/audit.plugin.js";

export async function listDprs() {
  return TheModel.find().sort({ createdAt: -1 }).limit(100);
}

export async function getDpr(id: string) {
  const doc = await TheModel.findById(id);
  if (!doc) throw new HttpError(404, "Dpr not found");
  return doc;
}

export async function createDpr(payload: Record<string, unknown>, actorId?: string) {
  const doc = new TheModel(payload);
  applyActor(doc, actorId, "create");
  return doc.save();
}

export async function updateDpr(id: string, payload: Record<string, unknown>, actorId?: string) {
  const doc = await getDpr(id);
  Object.assign(doc, payload);
  applyActor(doc, actorId, "update");
  return doc.save();
}

export async function softDeleteDpr(id: string, actorId?: string) {
  const doc = await getDpr(id);
  return doc.softDelete(actorId);
}


