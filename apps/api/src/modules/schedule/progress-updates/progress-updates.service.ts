import mongoose, { type ClientSession } from "mongoose";
import { WorkPackageStatus } from "@methanova/shared-types";
import { HttpError } from "../../../utils/http.js";
import { ProgressUpdateModel as TheModel } from "./progress-updates.model.js";
import { WorkPackageModel } from "../work-packages/work-packages.model.js";
import { applyActor } from "../../../db/plugins/audit.plugin.js";

const TERMINAL: string[] = [WorkPackageStatus.COMPLETED, WorkPackageStatus.HANDED_OVER];

/**
 * `WorkPackage.percentComplete` is a mirror of the latest (by `at`) live
 * progress update — kept on the work package so the delay rule and project
 * progress can be read without replaying the log. Re-derived inside the same
 * transaction as every create/update/delete here, so the two cannot diverge.
 * A COMPLETED/HANDED_OVER package stays at 100 whatever the log says.
 */
async function syncWorkPackagePercent(workPackageId: unknown, actorId: string | undefined, session: ClientSession) {
  const workPackage = await WorkPackageModel.findById(workPackageId).session(session);
  if (!workPackage) throw new HttpError(404, "WorkPackage not found");
  const latest = await TheModel.findOne({ workPackageId })
    .sort({ at: -1, createdAt: -1 })
    .select("percentComplete")
    .session(session);
  const next = TERMINAL.includes(String(workPackage.get("status")))
    ? 100
    : Number(latest?.get("percentComplete") ?? 0);
  if (workPackage.get("percentComplete") !== next) {
    workPackage.set("percentComplete", next);
    applyActor(workPackage, actorId, "progress_sync");
    await workPackage.save();
  }
}

async function inTransaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result as T;
  } finally {
    await session.endSession();
  }
}

export async function listProgressUpdates() {
  return TheModel.find().sort({ createdAt: -1 }).limit(100);
}

export async function getProgressUpdate(id: string) {
  const doc = await TheModel.findById(id);
  if (!doc) throw new HttpError(404, "ProgressUpdate not found");
  return doc;
}

export async function createProgressUpdate(payload: Record<string, unknown>, actorId?: string) {
  return inTransaction(async (session) => {
    const doc = new TheModel(payload);
    applyActor(doc, actorId, "create");
    await doc.save({ session });
    await syncWorkPackagePercent(doc.get("workPackageId"), actorId, session);
    return doc;
  });
}

export async function updateProgressUpdate(id: string, payload: Record<string, unknown>, actorId?: string) {
  return inTransaction(async (session) => {
    const doc = await TheModel.findById(id).session(session);
    if (!doc) throw new HttpError(404, "ProgressUpdate not found");
    Object.assign(doc, payload);
    applyActor(doc, actorId, "update");
    await doc.save();
    await syncWorkPackagePercent(doc.get("workPackageId"), actorId, session);
    return doc;
  });
}

export async function softDeleteProgressUpdate(id: string, actorId?: string) {
  return inTransaction(async (session) => {
    const doc = await TheModel.findById(id).session(session);
    if (!doc) throw new HttpError(404, "ProgressUpdate not found");
    const deleted = await doc.softDelete(actorId);
    await syncWorkPackagePercent(doc.get("workPackageId"), actorId, session);
    return deleted;
  });
}
