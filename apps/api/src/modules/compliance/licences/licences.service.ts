import type { DashboardComplianceDto } from "@methanova/shared-types";
import { HttpError } from "../../../utils/http.js";
import { applyStatus, LICENCE_CHECKLIST_BUNDLES } from "../../../core/state-machine/index.js";
import { LicenceModel as TheModel } from "./licences.model.js";
import { applyActor } from "../../../db/plugins/audit.plugin.js";

export async function listLicences() {
  return TheModel.find().sort({ createdAt: -1 }).limit(100);
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

export async function transitionLicence(
  id: string,
  to: string,
  actorId?: string,
  validUntil?: Date | null,
) {
  const doc = await getLicence(id);
  applyStatus("licence", doc as { status: string }, to);
  // Only meaningful on the GRANTED move (validation.ts requires it there);
  // ignored on every other target, the same way a lead's LOST-only extras
  // are ignored on a normal stage advance.
  if (to === "GRANTED" && validUntil) {
    doc.set("validUntil", validUntil);
  }
  applyActor(doc, actorId, "status_transition");
  return doc.save();
}
