import { HttpError } from "../../../utils/http.js";
import { PaymentScheduleModel as TheModel } from "./payment-schedules.model.js";
import { applyActor } from "../../../db/plugins/audit.plugin.js";

export async function listPaymentSchedules() {
  return TheModel.find().sort({ createdAt: -1 }).limit(100);
}

export async function getPaymentSchedule(id: string) {
  const doc = await TheModel.findById(id);
  if (!doc) throw new HttpError(404, "PaymentSchedule not found");
  return doc;
}

export async function createPaymentSchedule(payload: Record<string, unknown>, actorId?: string) {
  const doc = new TheModel(payload);
  applyActor(doc, actorId, "create");
  return doc.save();
}

export async function updatePaymentSchedule(id: string, payload: Record<string, unknown>, actorId?: string) {
  const doc = await getPaymentSchedule(id);
  Object.assign(doc, payload);
  applyActor(doc, actorId, "update");
  return doc.save();
}

export async function softDeletePaymentSchedule(id: string, actorId?: string) {
  const doc = await getPaymentSchedule(id);
  return doc.softDelete(actorId);
}


