import { LicenceStatus, licenceOverdue, type DashboardComplianceDto } from "@methanova/shared-types";
import type { HydratedDocument } from "mongoose";
import { HttpError } from "../../../utils/http.js";
import { applyStatus, LICENCE_CHECKLIST_BUNDLES } from "../../../core/state-machine/index.js";
import { LicenceModel as TheModel } from "./licences.model.js";
import { LicenceTypeModel } from "../../admin/master-data/geography.model.js";
import { applyActor } from "../../../db/plugins/audit.plugin.js";
import { assertAssignableUser } from "../../admin/users/users.service.js";

/** Stored fields plus the read-time `isOverdue`/`daysOverdue` — computed on every read, never stored. */
function toLicenceView(doc: HydratedDocument<Record<string, unknown>>, now = new Date()) {
  const plain = doc.toObject() as Record<string, unknown>;
  const overdue = licenceOverdue(
    {
      status: String(plain.status),
      targetDate: plain.targetDate as Date | null,
      clearedDate: plain.clearedDate as Date | null,
    },
    now,
  );
  return { ...plain, id: String(plain._id), ...overdue };
}

async function findLicence(id: string) {
  const doc = await TheModel.findById(id);
  if (!doc) throw new HttpError(404, "Licence not found");
  return doc;
}

export async function listLicences() {
  const docs = await TheModel.find().sort({ createdAt: -1 }).limit(100);
  const now = new Date();
  return docs.map((doc) => toLicenceView(doc, now));
}

/** The Dashboard Compliance card: granted/total overall and per bundle (Pre-CTE/CTE/CTO), always present even at 0. */
export async function getComplianceSummary(): Promise<DashboardComplianceDto> {
  const rows = await TheModel.aggregate<{ _id: string; total: number; granted: number }>([
    { $match: { deletedAt: null } },
    {
      $group: {
        _id: "$bundle",
        total: { $sum: 1 },
        granted: { $sum: { $cond: [{ $eq: ["$status", "GRANTED"] }, 1, 0] } },
      },
    },
  ]);
  const byBundleRow = new Map(rows.map((row) => [row._id, row]));

  const byBundle = LICENCE_CHECKLIST_BUNDLES.map((bundle) => ({
    bundle,
    grantedCount: byBundleRow.get(bundle)?.granted ?? 0,
    totalCount: byBundleRow.get(bundle)?.total ?? 0,
  }));

  return {
    grantedCount: byBundle.reduce((sum, row) => sum + row.grantedCount, 0),
    totalCount: byBundle.reduce((sum, row) => sum + row.totalCount, 0),
    byBundle,
  };
}

export async function getLicence(id: string) {
  return toLicenceView(await findLicence(id));
}

async function assertAssignee(payload: Record<string, unknown>) {
  if (typeof payload.assigneeUserId === "string") {
    await assertAssignableUser(payload.assigneeUserId, "Licence assignee");
  }
}

/** Same instantiation rule as signMou(): a licence of a known type takes that type's bundle/authority/scope unless the caller overrides them. */
export async function createLicence(payload: Record<string, unknown>, actorId?: string) {
  await assertAssignee(payload);
  let fromType: Record<string, unknown> = {};
  if (payload.licenceTypeId) {
    const type = await LicenceTypeModel.findById(payload.licenceTypeId);
    if (!type) throw new HttpError(400, "That licence type does not exist");
    fromType = { bundle: type.get("bundle"), authority: type.get("authority"), scope: type.get("scope") ?? null };
  }
  const defined = Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
  const doc = new TheModel({ ...fromType, ...defined });
  applyActor(doc, actorId, "create");
  await doc.save();
  return toLicenceView(doc);
}

export async function updateLicence(id: string, payload: Record<string, unknown>, actorId?: string) {
  await assertAssignee(payload);
  const doc = await findLicence(id);
  Object.assign(doc, payload);
  applyActor(doc, actorId, "update");
  await doc.save();
  return toLicenceView(doc);
}

export async function softDeleteLicence(id: string, actorId?: string) {
  const doc = await findLicence(id);
  return doc.softDelete(actorId);
}

export async function transitionLicence(
  id: string,
  to: string,
  actorId?: string,
  dates: {
    validUntil?: Date | null;
    appliedDate?: Date | null;
    clearedDate?: Date | null;
    validFrom?: Date | null;
  } = {},
) {
  const doc = await findLicence(id);
  const from = String(doc.get("status"));
  applyStatus("licence", doc as { status: string }, to);
  // Each lifecycle date is written only by the move that makes it true; the
  // extras are ignored on every other target, the same way a lead's
  // LOST-only extras are ignored on a normal stage advance.
  if (to === LicenceStatus.SUBMITTED && !doc.get("appliedDate")) {
    doc.set("appliedDate", dates.appliedDate ?? new Date());
  }
  if (to === LicenceStatus.GRANTED) {
    const clearedDate = dates.clearedDate ?? new Date();
    doc.set("clearedDate", clearedDate);
    doc.set("validFrom", dates.validFrom ?? clearedDate);
    if (dates.validUntil) doc.set("validUntil", dates.validUntil);
  }
  // EXPIRED → DRAFT starts a renewal cycle: the previous cycle's dates stay
  // in the audit log, and clearing them lets the overdue rule see the
  // renewal as outstanding again.
  if (from === LicenceStatus.EXPIRED && to === LicenceStatus.DRAFT) {
    doc.set("appliedDate", null);
    doc.set("clearedDate", null);
    doc.set("validFrom", null);
  }
  applyActor(doc, actorId, "status_transition");
  await doc.save();
  return toLicenceView(doc);
}
