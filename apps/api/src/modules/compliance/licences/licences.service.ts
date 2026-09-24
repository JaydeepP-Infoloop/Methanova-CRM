import { HttpError } from "../../../utils/http.js";
import { applyStatus } from "../../../core/state-machine/index.js";
import { LicenceModel as TheModel } from "./licences.model.js";
import { applyActor } from "../../../db/plugins/audit.plugin.js";

export async function listLicences() {
  return TheModel.find().sort({ createdAt: -1 }).limit(100);
}

export async function getLicence(id: string) {
  const doc = await TheModel.findById(id);
  if (!doc) throw new HttpError(404, "Licence not found");
  return doc;
}

export async function createLicence(payload: Record<string, unknown>, actorId?: string) {
  const doc = new TheModel(payload);
  applyActor(doc, actorId, "create");
  return doc.save();
}

export async function updateLicence(id: string, payload: Record<string, unknown>, actorId?: string) {
  const doc = await getLicence(id);
  Object.assign(doc, payload);
  applyActor(doc, actorId, "update");
  return doc.save();
}

export async function softDeleteLicence(id: string, actorId?: string) {
  const doc = await getLicence(id);
  return doc.softDelete(actorId);
}

export async function transitionLicence(id: string, to: string, actorId?: string) {
  const doc = await getLicence(id);
  applyStatus("licence", doc as { status: string }, to);
  applyActor(doc, actorId, "status_transition");
  return doc.save();
}
