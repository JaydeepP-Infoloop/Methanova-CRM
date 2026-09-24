import { HttpError } from "../../../utils/http.js";
import { ReceiptModel as TheModel } from "./receipts.model.js";
import { applyActor } from "../../../db/plugins/audit.plugin.js";

export async function listReceipts() {
  return TheModel.find().sort({ createdAt: -1 }).limit(100);
}

export async function getReceipt(id: string) {
  const doc = await TheModel.findById(id);
  if (!doc) throw new HttpError(404, "Receipt not found");
  return doc;
}

export async function createReceipt(payload: Record<string, unknown>, actorId?: string) {
  const doc = new TheModel(payload);
  applyActor(doc, actorId, "create");
  return doc.save();
}

export async function updateReceipt(id: string, payload: Record<string, unknown>, actorId?: string) {
  const doc = await getReceipt(id);
  Object.assign(doc, payload);
  applyActor(doc, actorId, "update");
  return doc.save();
}

export async function softDeleteReceipt(id: string, actorId?: string) {
  const doc = await getReceipt(id);
  return doc.softDelete(actorId);
}


