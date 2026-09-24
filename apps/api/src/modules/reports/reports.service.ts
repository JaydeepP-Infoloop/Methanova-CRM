import { HttpError } from "../../utils/http.js";
import { ReportSnapshotModel as TheModel } from "./reports.model.js";
import { applyActor } from "../../db/plugins/audit.plugin.js";

export async function listReportSnapshots() {
  return TheModel.find().sort({ createdAt: -1 }).limit(100);
}

export async function getReportSnapshot(id: string) {
  const doc = await TheModel.findById(id);
  if (!doc) throw new HttpError(404, "ReportSnapshot not found");
  return doc;
}

export async function createReportSnapshot(payload: Record<string, unknown>, actorId?: string) {
  const doc = new TheModel(payload);
  applyActor(doc, actorId, "create");
  return doc.save();
}

export async function updateReportSnapshot(id: string, payload: Record<string, unknown>, actorId?: string) {
  const doc = await getReportSnapshot(id);
  Object.assign(doc, payload);
  applyActor(doc, actorId, "update");
  return doc.save();
}

export async function softDeleteReportSnapshot(id: string, actorId?: string) {
  const doc = await getReportSnapshot(id);
  return doc.softDelete(actorId);
}


