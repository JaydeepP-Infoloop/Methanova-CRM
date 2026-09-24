import { WorkPackageDelayReason, WorkPackageStatus, workPackageDelay } from "@methanova/shared-types";
import type { HydratedDocument } from "mongoose";
import { HttpError } from "../../../utils/http.js";
import { applyStatus } from "../../../core/state-machine/index.js";
import { WorkPackageModel as TheModel } from "./work-packages.model.js";
import { applyActor } from "../../../db/plugins/audit.plugin.js";
import { assertAssignableUser } from "../../admin/users/users.service.js";

/** Stored fields plus the read-time `isDelayed`/`daysDelayed` — computed on every read, never stored. */
export function toWorkPackageView(doc: HydratedDocument<Record<string, unknown>>, now = new Date()) {
  const plain = doc.toObject() as Record<string, unknown>;
  const delay = workPackageDelay(
    {
      status: String(plain.status),
      plannedEnd: plain.plannedEnd as Date | null,
      percentComplete: plain.percentComplete as number | null,
    },
    now,
  );
  return { ...plain, id: String(plain._id), ...delay };
}

async function findWorkPackage(id: string) {
  const doc = await TheModel.findById(id);
  if (!doc) throw new HttpError(404, "WorkPackage not found");
  return doc;
}

export async function listWorkPackages() {
  const docs = await TheModel.find().sort({ createdAt: -1 }).limit(100);
  const now = new Date();
  return docs.map((doc) => toWorkPackageView(doc, now));
}

export async function getWorkPackage(id: string) {
  return toWorkPackageView(await findWorkPackage(id));
}

async function assertResponsible(payload: Record<string, unknown>) {
  if (typeof payload.responsibleUserId === "string") {
    await assertAssignableUser(payload.responsibleUserId, "Responsible person");
  }
}

export async function createWorkPackage(payload: Record<string, unknown>, actorId?: string) {
  await assertResponsible(payload);
  const doc = new TheModel(payload);
  applyActor(doc, actorId, "create");
  await doc.save();
  return toWorkPackageView(doc);
}

export async function updateWorkPackage(id: string, payload: Record<string, unknown>, actorId?: string) {
  await assertResponsible(payload);
  const doc = await findWorkPackage(id);
  Object.assign(doc, payload);
  applyActor(doc, actorId, "update");
  await doc.save();
  return toWorkPackageView(doc);
}

export async function softDeleteWorkPackage(id: string, actorId?: string) {
  const doc = await findWorkPackage(id);
  return doc.softDelete(actorId);
}

const DELAY_REASONS: string[] = Object.values(WorkPackageDelayReason);

export async function transitionWorkPackage(
  id: string,
  to: string,
  actorId?: string,
  delayReason?: string | null,
) {
  // Checked here as well as in validation.ts so the rule holds for any
  // caller of this service, not only the HTTP route — and before the state
  // machine runs, so a missing reason never half-applies a move.
  if (to === WorkPackageStatus.ON_HOLD && (!delayReason || !DELAY_REASONS.includes(delayReason))) {
    throw new HttpError(400, "A delay reason from the fixed list is required when putting a work package on hold");
  }
  const doc = await findWorkPackage(id);
  applyStatus("workPackage", doc as { status: string }, to);
  // The stamps below are set here, never accepted from a client, so each can
  // only ever reflect the moment the transition actually happened.
  if (to === WorkPackageStatus.IN_PROGRESS && !doc.get("actualStart")) {
    doc.set("actualStart", new Date());
  }
  if (to === WorkPackageStatus.COMPLETED) {
    doc.set("actualEnd", new Date());
    doc.set("percentComplete", 100);
  }
  if (to === WorkPackageStatus.ON_HOLD) {
    doc.set("delayReason", delayReason);
  }
  applyActor(doc, actorId, "status_transition");
  await doc.save();
  return toWorkPackageView(doc);
}
