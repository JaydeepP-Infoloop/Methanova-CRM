import { HttpError } from "../../utils/http.js";
import { NotificationModel as TheModel } from "./notifications.model.js";
import { applyActor } from "../../db/plugins/audit.plugin.js";

export async function listNotifications() {
  return TheModel.find().sort({ createdAt: -1 }).limit(100);
}

export async function getNotification(id: string) {
  const doc = await TheModel.findById(id);
  if (!doc) throw new HttpError(404, "Notification not found");
  return doc;
}

export async function createNotification(payload: Record<string, unknown>, actorId?: string) {
  const doc = new TheModel(payload);
  applyActor(doc, actorId, "create");
  return doc.save();
}

export async function updateNotification(id: string, payload: Record<string, unknown>, actorId?: string) {
  const doc = await getNotification(id);
  Object.assign(doc, payload);
  applyActor(doc, actorId, "update");
  return doc.save();
}

export async function softDeleteNotification(id: string, actorId?: string) {
  const doc = await getNotification(id);
  return doc.softDelete(actorId);
}


