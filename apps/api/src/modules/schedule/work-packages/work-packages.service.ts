import {
  DAY_MS,
  TERMINAL_WORK_PACKAGE_STATUSES,
  WorkPackageDelayReason,
  WorkPackageStatus,
  workPackageDelay,
} from "@methanova/shared-types";
import type { HydratedDocument } from "mongoose";
import { HttpError } from "../../../utils/http.js";
import { toObjectIds, wholeDaysExpr } from "../../../utils/query.js";
import { applyStatus } from "../../../core/state-machine/index.js";
import { WorkPackageModel as TheModel } from "./work-packages.model.js";
import { applyActor } from "../../../db/plugins/audit.plugin.js";
import { assertAssignableUser } from "../../admin/users/users.service.js";
import { openProjectScope } from "../../projects/project/project.model.js";

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

/** The Mongo form of `workPackageDelay()`'s `isDelayed` rule (derived.ts) — the two must stay in step. */
export function delayedWorkPackageFilter(now: Date) {
  return {
    status: { $nin: [...TERMINAL_WORK_PACKAGE_STATUSES] },
    plannedEnd: { $lte: new Date(now.getTime() - DAY_MS) },
    $or: [{ percentComplete: { $lt: 100 } }, { percentComplete: null }],
  };
}

export async function listWorkPackages(
  filters: { id?: string; projectId?: string; status?: string; delayed?: boolean; openProjects?: boolean } = {},
) {
  const now = new Date();
  const clauses: Record<string, unknown>[] = [];
  if (filters.openProjects) clauses.push(await openProjectScope());
  if (filters.id) clauses.push({ _id: filters.id });
  if (filters.projectId) clauses.push({ projectId: filters.projectId });
  if (filters.status) clauses.push({ status: filters.status });
  if (filters.delayed) clauses.push(delayedWorkPackageFilter(now));
  const docs = await TheModel.find(clauses.length ? { $and: clauses } : {})
    .sort(filters.delayed ? { plannedEnd: 1 } : { createdAt: -1 })
    .limit(100);
  return docs.map((doc) => toWorkPackageView(doc, now));
}

/**
 * `weightedProgressPct()` (derived.ts) as one `$group` over every project at
 * once. `$floor(x + 0.5)` is `Math.round`, not Mongo's banker's `$round`, so
 * this and the per-project read can't disagree on a .5. Projects with no work
 * packages are absent from the result and read back as `null`.
 */
export async function getProgressByProject(projectIds: unknown[]): Promise<Map<string, number | null>> {
  const pct = {
    $cond: [
      { $in: ["$status", [...TERMINAL_WORK_PACKAGE_STATUSES]] },
      100,
      { $min: [{ $max: [{ $ifNull: ["$percentComplete", 0] }, 0] }, 100] },
    ],
  };
  const amount = { $ifNull: ["$amountPaise", 0] };
  const rows = await TheModel.aggregate<{ _id: unknown; progressPct: number }>([
    { $match: { projectId: { $in: toObjectIds(projectIds) }, deletedAt: null } },
    {
      $group: {
        _id: "$projectId",
        count: { $sum: 1 },
        weight: { $sum: amount },
        weighted: { $sum: { $multiply: [pct, amount] } },
        plain: { $sum: pct },
      },
    },
    {
      $project: {
        progressPct: {
          $floor: {
            $add: [
              { $cond: [{ $gt: ["$weight", 0] }, { $divide: ["$weighted", "$weight"] }, { $divide: ["$plain", "$count"] }] },
              0.5,
            ],
          },
        },
      },
    },
  ]);
  const byId = new Map(rows.map((row) => [String(row._id), row.progressPct]));
  return new Map(projectIds.map((id) => [String(id), byId.get(String(id)) ?? null]));
}

export interface DelayedWorkPackagesSummary {
  totalCount: number;
  rows: {
    _id: unknown;
    projectId: unknown;
    name: string;
    plannedEnd: Date;
    percentComplete: number | null;
    daysDelayed: number;
    delayReason: string | null;
    projectCode: string | null;
    client: string | null;
    responsibleUserName: string | null;
  }[];
  byProject: { _id: unknown; count: number; worstId: unknown; worstLabel: string; worstDays: number }[];
}

/** Delayed work packages across the given projects: the uncapped count, the worst `limit` rows, and a per-project roll-up for risk reasons. */
export async function getDelayedWorkPackagesSummary(
  projectIds: unknown[],
  now: Date,
  limit: number,
): Promise<DelayedWorkPackagesSummary> {
  const [result] = await TheModel.aggregate<{
    total: { n: number }[];
    rows: DelayedWorkPackagesSummary["rows"];
    byProject: DelayedWorkPackagesSummary["byProject"];
  }>([
    { $match: { projectId: { $in: toObjectIds(projectIds) }, deletedAt: null, ...delayedWorkPackageFilter(now) } },
    { $addFields: { daysDelayed: wholeDaysExpr("$plannedEnd", now) } },
    { $sort: { daysDelayed: -1, _id: 1 } },
    {
      $facet: {
        total: [{ $count: "n" }],
        rows: [
          { $limit: limit },
          { $lookup: { from: "projects", localField: "projectId", foreignField: "_id", as: "project" } },
          { $lookup: { from: "users", localField: "responsibleUserId", foreignField: "_id", as: "responsible" } },
          {
            $project: {
              projectId: 1,
              name: 1,
              plannedEnd: 1,
              percentComplete: 1,
              daysDelayed: 1,
              delayReason: 1,
              projectCode: { $first: "$project.code" },
              client: { $first: "$project.name" },
              responsibleUserName: { $first: "$responsible.name" },
            },
          },
        ],
        byProject: [
          {
            $group: {
              _id: "$projectId",
              count: { $sum: 1 },
              worstId: { $first: "$_id" },
              worstLabel: { $first: "$name" },
              worstDays: { $first: "$daysDelayed" },
            },
          },
        ],
      },
    },
  ]);
  return { totalCount: result?.total[0]?.n ?? 0, rows: result?.rows ?? [], byProject: result?.byProject ?? [] };
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
