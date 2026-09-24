import { HttpError } from "../../../utils/http.js";
import { FeasibilitySurveyModel as TheModel } from "./feasibility.model.js";
import { applyActor } from "../../../db/plugins/audit.plugin.js";

export async function listFeasibilitySurveys() {
  return TheModel.find().sort({ createdAt: -1 }).limit(100);
}

export async function getFeasibilitySurvey(id: string) {
  const doc = await TheModel.findById(id);
  if (!doc) throw new HttpError(404, "FeasibilitySurvey not found");
  return doc;
}

export async function createFeasibilitySurvey(payload: Record<string, unknown>, actorId?: string) {
  const doc = new TheModel(payload);
  applyActor(doc, actorId, "create");
  return doc.save();
}

export async function updateFeasibilitySurvey(id: string, payload: Record<string, unknown>, actorId?: string) {
  const doc = await getFeasibilitySurvey(id);
  Object.assign(doc, payload);
  applyActor(doc, actorId, "update");
  return doc.save();
}

export async function softDeleteFeasibilitySurvey(id: string, actorId?: string) {
  const doc = await getFeasibilitySurvey(id);
  return doc.softDelete(actorId);
}


