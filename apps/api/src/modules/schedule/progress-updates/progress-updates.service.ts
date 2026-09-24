import { HttpError } from "../../../utils/http.js";
import { ProgressUpdateModel as TheModel } from "./progress-updates.model.js";
import { applyActor } from "../../../db/plugins/audit.plugin.js";

export async function listProgressUpdates() {
  return TheModel.find().sort({ createdAt: -1 }).limit(100);
}

export async function getProgressUpdate(id: string) {
  const doc = await TheModel.findById(id);
  if (!doc) throw new HttpError(404, "ProgressUpdate not found");
  return doc;
}

export async function createProgressUpdate(payload: Record<string, unknown>, actorId?: string) {
  const doc = new TheModel(payload);
  applyActor(doc, actorId, "create");
  return doc.save();
}

export async function updateProgressUpdate(id: string, payload: Record<string, unknown>, actorId?: string) {
  const doc = await getProgressUpdate(id);
  Object.assign(doc, payload);
  applyActor(doc, actorId, "update");
  return doc.save();
}

export async function softDeleteProgressUpdate(id: string, actorId?: string) {
  const doc = await getProgressUpdate(id);
  return doc.softDelete(actorId);
}


