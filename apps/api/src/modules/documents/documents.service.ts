import { HttpError } from "../../utils/http.js";
import { DocumentRecordModel as TheModel } from "./documents.model.js";
import { applyActor } from "../../db/plugins/audit.plugin.js";

export async function listDocumentRecords() {
  return TheModel.find().sort({ createdAt: -1 }).limit(100);
}

export async function getDocumentRecord(id: string) {
  const doc = await TheModel.findById(id);
  if (!doc) throw new HttpError(404, "DocumentRecord not found");
  return doc;
}

export async function createDocumentRecord(payload: Record<string, unknown>, actorId?: string) {
  const doc = new TheModel(payload);
  applyActor(doc, actorId, "create");
  return doc.save();
}

export async function updateDocumentRecord(id: string, payload: Record<string, unknown>, actorId?: string) {
  const doc = await getDocumentRecord(id);
  Object.assign(doc, payload);
  applyActor(doc, actorId, "update");
  return doc.save();
}

export async function softDeleteDocumentRecord(id: string, actorId?: string) {
  const doc = await getDocumentRecord(id);
  return doc.softDelete(actorId);
}


