import { HttpError } from "../../../utils/http.js";
import { applyStatus } from "../../../core/state-machine/index.js";
import { WorkPackageModel as TheModel } from "./work-packages.model.js";
import { applyActor } from "../../../db/plugins/audit.plugin.js";

export async function listWorkPackages() {
  return TheModel.find().sort({ createdAt: -1 }).limit(100);
}

export async function getWorkPackage(id: string) {
  const doc = await TheModel.findById(id);
  if (!doc) throw new HttpError(404, "WorkPackage not found");
  return doc;
}

export async function createWorkPackage(payload: Record<string, unknown>, actorId?: string) {
  const doc = new TheModel(payload);
  applyActor(doc, actorId, "create");
  return doc.save();
}

export async function updateWorkPackage(id: string, payload: Record<string, unknown>, actorId?: string) {
  const doc = await getWorkPackage(id);
  Object.assign(doc, payload);
  applyActor(doc, actorId, "update");
  return doc.save();
}

export async function softDeleteWorkPackage(id: string, actorId?: string) {
  const doc = await getWorkPackage(id);
  return doc.softDelete(actorId);
}

export async function transitionWorkPackage(id: string, to: string, actorId?: string) {
  const doc = await getWorkPackage(id);
  applyStatus("workPackage", doc as { status: string }, to);
  applyActor(doc, actorId, "status_transition");
  return doc.save();
}
