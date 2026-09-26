import {
  CLEARED_LICENCE_STATUSES,
  DAY_MS,
  DEFAULT_LICENCE_EXPIRY_WINDOW_DAYS,
  LICENCE_STATUS_ORDER,
  LicenceStatus,
  licenceOverdue,
  type DashboardComplianceDto,
} from "@methanova/shared-types";
import type { HydratedDocument } from "mongoose";
import { HttpError } from "../../../utils/http.js";
import { toObjectIds, wholeDaysExpr } from "../../../utils/query.js";
import { MasterDataModel } from "../../admin/master-data/master-data.model.js";
import { openProjectScope } from "../../projects/project/project.model.js";
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

/**
 * Master-data key for the licence expiry-warning window, `{ days: number }`.
 * Editable through the existing admin master-data CRUD; a licence's own
 * `renewalLeadDays` overrides it per licence.
 */
export const LICENCE_EXPIRY_SETTINGS_KEY = "licence-expiry-settings";

export async function getLicenceExpiryWindowDays(): Promise<number> {
  const row = (await MasterDataModel.findOne({ key: LICENCE_EXPIRY_SETTINGS_KEY }).lean()) as {
    payload?: { days?: number };
  } | null;
  const days = row?.payload?.days;
  return typeof days === "number" && Number.isFinite(days) && days >= 0 ? days : DEFAULT_LICENCE_EXPIRY_WINDOW_DAYS;
}

/** The Mongo form of `licenceOverdue()`'s rule (derived.ts) — the two must stay in step. */
export function overdueLicenceFilter(now: Date) {
  return {
    targetDate: { $lte: new Date(now.getTime() - DAY_MS) },
    clearedDate: null,
    status: { $nin: [...CLEARED_LICENCE_STATUSES] },
  };
}

/** The Mongo form of `licenceExpiringSoon()` (derived.ts) — the two must stay in step. */
export function expiringSoonLicenceFilter(now: Date, defaultWindowDays: number) {
  return {
    status: LicenceStatus.GRANTED,
    validUntil: { $gte: now },
    $expr: {
      $lte: [
        "$validUntil",
        { $add: [now, { $multiply: [{ $ifNull: ["$renewalLeadDays", defaultWindowDays] }, DAY_MS] }] },
      ],
    },
  };
}

export async function listLicences(
  filters: {
    id?: string;
    projectId?: string;
    status?: string;
    overdue?: boolean;
    expiringSoon?: boolean;
    openProjects?: boolean;
  } = {},
) {
  const now = new Date();
  const clauses: Record<string, unknown>[] = [];
  if (filters.openProjects) clauses.push(await openProjectScope());
  if (filters.id) clauses.push({ _id: filters.id });
  if (filters.projectId) clauses.push({ projectId: filters.projectId });
  if (filters.status) clauses.push({ status: filters.status });
  if (filters.overdue) clauses.push(overdueLicenceFilter(now));
  if (filters.expiringSoon) clauses.push(expiringSoonLicenceFilter(now, await getLicenceExpiryWindowDays()));
  const docs = await TheModel.find(clauses.length ? { $and: clauses } : {})
    .sort(filters.overdue ? { targetDate: 1 } : filters.expiringSoon ? { validUntil: 1 } : { createdAt: -1 })
    .limit(100);
  return docs.map((doc) => toLicenceView(doc, now));
}

const IN_PROGRESS_LICENCE_STATUSES: string[] = [
  LicenceStatus.DRAFT,
  LicenceStatus.SUBMITTED,
  LicenceStatus.QUERY_PENDING,
  LicenceStatus.AUTHORITY_VISIT,
];

export interface ComplianceHealth {
  summary: DashboardComplianceDto;
  overdueByProject: { _id: unknown; count: number; worstId: unknown; worstLabel: string; worstDays: number }[];
  overdueTop: { _id: unknown; projectId: unknown; label: string; daysOverdue: number; projectCode: string | null; client: string | null }[];
}

/**
 * The Dashboard's Compliance Health section over the given (open) projects'
 * licences, as one `$facet`: status/bundle counts, the overdue and
 * expiring-soon counts, a per-project breakdown, and the overdue roll-up the
 * risk reasons and critical alerts are built from.
 */
export async function getComplianceHealth(
  projectIds: unknown[],
  now: Date,
  windowDays: number,
  overdueLimit: number,
): Promise<ComplianceHealth> {
  const overdue = overdueLicenceFilter(now);
  const expiring = expiringSoonLicenceFilter(now, windowDays);
  const isOverdue = {
    $and: [
      { $ne: ["$targetDate", null] },
      { $lte: ["$targetDate", new Date(now.getTime() - DAY_MS)] },
      { $eq: [{ $ifNull: ["$clearedDate", null] }, null] },
      { $not: [{ $in: ["$status", [...CLEARED_LICENCE_STATUSES]] }] },
    ],
  };
  const isExpiring = {
    $and: [
      { $eq: ["$status", LicenceStatus.GRANTED] },
      { $ne: [{ $ifNull: ["$validUntil", null] }, null] },
      { $gte: ["$validUntil", now] },
      expiring.$expr,
    ],
  };
  const count = (cond: unknown) => ({ $sum: { $cond: [cond, 1, 0] } });

  const [result] = await TheModel.aggregate<{
    byStatus: { _id: string; count: number }[];
    byBundle: { _id: string; total: number; granted: number }[];
    overdueCount: { n: number }[];
    expiringCount: { n: number }[];
    byProject: {
      _id: unknown;
      code: string | null;
      client: string | null;
      total: number;
      granted: number;
      inProgress: number;
      notStarted: number;
      overdue: number;
      expiringSoon: number;
    }[];
    overdueByProject: ComplianceHealth["overdueByProject"];
    overdueTop: ComplianceHealth["overdueTop"];
  }>([
    { $match: { projectId: { $in: toObjectIds(projectIds) }, deletedAt: null } },
    {
      $facet: {
        byStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
        byBundle: [
          {
            $group: {
              _id: "$bundle",
              total: { $sum: 1 },
              granted: count({ $eq: ["$status", LicenceStatus.GRANTED] }),
            },
          },
        ],
        overdueCount: [{ $match: overdue }, { $count: "n" }],
        expiringCount: [{ $match: expiring }, { $count: "n" }],
        byProject: [
          {
            $group: {
              _id: "$projectId",
              total: { $sum: 1 },
              granted: count({ $eq: ["$status", LicenceStatus.GRANTED] }),
              inProgress: count({ $in: ["$status", IN_PROGRESS_LICENCE_STATUSES] }),
              notStarted: count({ $eq: ["$status", LicenceStatus.NOT_STARTED] }),
              overdue: count(isOverdue),
              expiringSoon: count(isExpiring),
            },
          },
          { $lookup: { from: "projects", localField: "_id", foreignField: "_id", as: "project" } },
          {
            $project: {
              total: 1,
              granted: 1,
              inProgress: 1,
              notStarted: 1,
              overdue: 1,
              expiringSoon: 1,
              code: { $first: "$project.code" },
              client: { $first: "$project.name" },
            },
          },
          { $sort: { overdue: -1, expiringSoon: -1, code: 1 } },
        ],
        overdueByProject: [
          { $match: overdue },
          { $addFields: { daysOverdue: wholeDaysExpr("$targetDate", now) } },
          { $sort: { daysOverdue: -1, _id: 1 } },
          { $lookup: { from: "licence_types", localField: "licenceTypeId", foreignField: "_id", as: "type" } },
          {
            $group: {
              _id: "$projectId",
              count: { $sum: 1 },
              worstId: { $first: "$_id" },
              worstLabel: { $first: { $ifNull: [{ $first: "$type.label" }, "$bundle"] } },
              worstDays: { $first: "$daysOverdue" },
            },
          },
        ],
        overdueTop: [
          { $match: overdue },
          { $addFields: { daysOverdue: wholeDaysExpr("$targetDate", now) } },
          { $sort: { daysOverdue: -1, _id: 1 } },
          { $limit: overdueLimit },
          { $lookup: { from: "licence_types", localField: "licenceTypeId", foreignField: "_id", as: "type" } },
          { $lookup: { from: "projects", localField: "projectId", foreignField: "_id", as: "project" } },
          {
            $project: {
              projectId: 1,
              daysOverdue: 1,
              label: { $ifNull: [{ $first: "$type.label" }, "$bundle"] },
              projectCode: { $first: "$project.code" },
              client: { $first: "$project.name" },
            },
          },
        ],
      },
    },
  ]);

  const statusCount = new Map((result?.byStatus ?? []).map((row) => [row._id, row.count]));
  const bundleRow = new Map((result?.byBundle ?? []).map((row) => [row._id, row]));
  const byBundle = LICENCE_CHECKLIST_BUNDLES.map((bundle) => ({
    bundle,
    grantedCount: bundleRow.get(bundle)?.granted ?? 0,
    totalCount: bundleRow.get(bundle)?.total ?? 0,
  }));
  const byStatus = LICENCE_STATUS_ORDER.map((status) => ({ status, count: statusCount.get(status) ?? 0 }));

  return {
    summary: {
      grantedCount: statusCount.get(LicenceStatus.GRANTED) ?? 0,
      totalCount: byStatus.reduce((sum, row) => sum + row.count, 0),
      byStatus,
      byBundle,
      overdueCount: result?.overdueCount[0]?.n ?? 0,
      expiringSoonCount: result?.expiringCount[0]?.n ?? 0,
      expiringWindowDays: windowDays,
      byProject: (result?.byProject ?? []).map((row) => ({
        projectId: String(row._id),
        code: row.code ?? "—",
        client: row.client ?? "—",
        totalCount: row.total,
        grantedCount: row.granted,
        inProgressCount: row.inProgress,
        notStartedCount: row.notStarted,
        overdueCount: row.overdue,
        expiringSoonCount: row.expiringSoon,
      })),
    },
    overdueByProject: result?.overdueByProject ?? [],
    overdueTop: result?.overdueTop ?? [],
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
