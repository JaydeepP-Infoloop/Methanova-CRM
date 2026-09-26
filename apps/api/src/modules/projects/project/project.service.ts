import {
  NotificationEntityType,
  NotificationEventType,
  OPEN_PROJECT_STATUSES,
  PROJECT_PORTFOLIO_STATUS_OF,
  PROJECT_PORTFOLIO_STATUS_ORDER,
  ProjectPortfolioStatus,
  ProjectStatus,
  Role,
  projectStatusesIn,
  type DashboardPortfolioDto,
} from "@methanova/shared-types";
import mongoose from "mongoose";
import { applyActor, AuditLogModel } from "../../../db/plugins/audit.plugin.js";
import { assertTransition } from "../../../core/state-machine/index.js";
import { HttpError } from "../../../utils/http.js";
import { notifyUsers } from "../../notifications/notifications.service.js";
import { getProgressByProject } from "../../schedule/work-packages/work-packages.service.js";
import { UserModel } from "../../admin/users/users.model.js";
import { assertAssignableUser } from "../../admin/users/users.service.js";
import { FeedstockTypeModel } from "../../admin/master-data/geography.model.js";
import { getOrgLetterhead, projectStatusIsClosed, publicFile } from "../../files/files.service.js";
import { StoredFileModel } from "../../files/files.model.js";
import { ProjectModel } from "./project.model.js";

const POPULATE = [
  { path: "projectManagerUserId", select: "name email role" },
  { path: "siteEngineerUserId", select: "name email role" },
  { path: "liaisonOfficerUserId", select: "name email role" },
  { path: "members.userId", select: "name email role" },
  { path: "letterheadFileId", select: "-storageKey" },
];

export async function listProjects(opts: {
  mine?: boolean;
  userId?: string;
  portfolio?: string;
  /** Pre-computed by the caller from the same risk reasons the dashboard shows — see dashboard.service.ts. */
  onlyIds?: string[];
}) {
  const clauses: Record<string, unknown>[] = [];
  if (opts.mine && opts.userId) {
    clauses.push({
      $or: [
        { projectManagerUserId: opts.userId },
        { siteEngineerUserId: opts.userId },
        { liaisonOfficerUserId: opts.userId },
        { "members.userId": opts.userId },
      ],
    });
  }
  if (opts.portfolio) {
    if (!(PROJECT_PORTFOLIO_STATUS_ORDER as string[]).includes(opts.portfolio)) {
      throw new HttpError(400, "Unknown portfolio status");
    }
    clauses.push({ status: { $in: projectStatusesIn(opts.portfolio as ProjectPortfolioStatus) } });
  }
  if (opts.onlyIds) clauses.push({ _id: { $in: opts.onlyIds } });
  const docs = await ProjectModel.find(clauses.length ? { $and: clauses } : {})
    .populate("projectManagerUserId", "name email role")
    .sort({ createdAt: -1 })
    .limit(200);
  const progress = await getProgressByProject(docs.map((doc) => doc._id));
  return docs.map((doc) => ({
    ...doc.toObject(),
    id: String(doc._id),
    progressPct: progress.get(String(doc._id)) ?? null,
  }));
}

/** Project counts per SoW portfolio status, as a `$group` over the real lifecycle status. TERMINATED is null — nothing maps to it. */
export async function getPortfolioCounts(): Promise<Pick<DashboardPortfolioDto, "byStatus" | "openCount">> {
  const rows = await ProjectModel.aggregate<{ _id: ProjectStatus; count: number }>([
    { $match: { deletedAt: null } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const counts = new Map<ProjectPortfolioStatus, number>();
  let openCount = 0;
  for (const row of rows) {
    const portfolio = PROJECT_PORTFOLIO_STATUS_OF[row._id];
    if (!portfolio) continue;
    counts.set(portfolio, (counts.get(portfolio) ?? 0) + row.count);
    if (OPEN_PROJECT_STATUSES.includes(row._id)) openCount += row.count;
  }
  return {
    byStatus: PROJECT_PORTFOLIO_STATUS_ORDER.map((status) => ({
      status,
      count: projectStatusesIn(status).length === 0 ? null : (counts.get(status) ?? 0),
    })),
    openCount,
  };
}

export interface OpenProjectRow {
  _id: mongoose.Types.ObjectId;
  code: string;
  name: string;
  status: ProjectStatus;
  targetCommissioningDate: Date | null;
  revisedTargetDate: Date | null;
  projectManagerName: string | null;
}

/** Every open (not Completed) project, with its PM's name joined in — the population every live-risk section is scoped to. */
export async function listOpenProjects(): Promise<OpenProjectRow[]> {
  return ProjectModel.aggregate<OpenProjectRow>([
    { $match: { deletedAt: null, status: { $in: OPEN_PROJECT_STATUSES } } },
    { $sort: { code: 1 } },
    { $lookup: { from: "users", localField: "projectManagerUserId", foreignField: "_id", as: "pm" } },
    {
      $project: {
        code: 1,
        name: 1,
        status: 1,
        targetCommissioningDate: { $ifNull: ["$targetCommissioningDate", null] },
        revisedTargetDate: { $ifNull: ["$revisedTargetDate", null] },
        projectManagerName: { $ifNull: [{ $first: "$pm.name" }, null] },
      },
    },
  ]);
}

async function loadProject(id: string) {
  const doc = await ProjectModel.findById(id).populate(POPULATE);
  if (!doc) throw new HttpError(404, "Project not found");
  return doc;
}

export async function getProject(id: string) {
  const doc = await loadProject(id);
  const org = await getOrgLetterhead();
  const override = doc.get("letterheadFileId");
  const letterheadSource = override ? "project" : org.fileId ? "org" : "none";
  const resolvedFileId = override
    ? String((override as { _id?: unknown })._id ?? override)
    : org.fileId;
  const progress = await getProgressByProject([doc._id]);
  return {
    ...doc.toObject(),
    id: String(doc._id),
    progressPct: progress.get(String(doc._id)) ?? null,
    letterhead: {
      source: letterheadSource,
      fileId: resolvedFileId,
      orgFileId: org.fileId,
      orgLegalName: org.legalName,
    },
    setup: setupChecklist(doc.toObject() as Record<string, unknown>, Boolean(resolvedFileId)),
  };
}

function setupChecklist(project: Record<string, unknown>, hasLetterhead: boolean) {
  const pm = project.projectManagerUserId;
  return {
    mouSigned: true,
    projectManagerAssigned: Boolean(pm),
    letterheadReady: hasLetterhead,
    teamAssigned: Array.isArray(project.members) && (project.members as unknown[]).length > 0,
  };
}

async function assertFeedstockTypes(ids: string[] | undefined) {
  if (!ids?.length) return;
  const unique = [...new Set(ids)];
  const found = await FeedstockTypeModel.countDocuments({ _id: { $in: unique }, deletedAt: null });
  if (found !== unique.length) throw new HttpError(400, "One or more feedstock types were not found");
}

export async function createProject(payload: Record<string, unknown>, actorId?: string) {
  await assertFeedstockTypes(payload.feedstockTypeIds as string[] | undefined);
  const doc = new ProjectModel(payload);
  applyActor(doc, actorId, "create");
  await doc.save();
  return getProject(String(doc._id));
}

export async function updateProject(
  id: string,
  payload: {
    name?: string;
    shortName?: string | null;
    description?: string | null;
    projectManagerUserId?: string | null;
    siteEngineerUserId?: string | null;
    liaisonOfficerUserId?: string | null;
    revisedTargetDate?: Date | null;
    feedstockTypeIds?: string[];
  },
  actorId?: string,
) {
  const doc = await ProjectModel.findById(id);
  if (!doc) throw new HttpError(404, "Project not found");
  const status = String(doc.get("status"));
  const identityTouched =
    payload.name !== undefined ||
    payload.shortName !== undefined ||
    payload.description !== undefined ||
    payload.revisedTargetDate !== undefined ||
    payload.feedstockTypeIds !== undefined;
  if (identityTouched && projectStatusIsClosed(status)) {
    throw new HttpError(409, "Project details are read-only after handover");
  }
  if (payload.name !== undefined) doc.set("name", payload.name);
  if (payload.shortName !== undefined) doc.set("shortName", payload.shortName);
  if (payload.description !== undefined) doc.set("description", payload.description);
  if (payload.revisedTargetDate !== undefined) doc.set("revisedTargetDate", payload.revisedTargetDate);
  if (payload.feedstockTypeIds !== undefined) {
    await assertFeedstockTypes(payload.feedstockTypeIds);
    doc.set("feedstockTypeIds", [...new Set(payload.feedstockTypeIds)]);
  }
  if (payload.siteEngineerUserId) {
    await assertAssignableUser(payload.siteEngineerUserId, "Site Engineer", [Role.SITE_ENGINEER, Role.DIRECTOR]);
  }
  if (payload.siteEngineerUserId !== undefined) doc.set("siteEngineerUserId", payload.siteEngineerUserId);
  if (payload.liaisonOfficerUserId) {
    await assertAssignableUser(payload.liaisonOfficerUserId, "Liaison Officer", [
      Role.LIAISON_COMPLIANCE_OFFICER,
      Role.DIRECTOR,
    ]);
  }
  if (payload.liaisonOfficerUserId !== undefined) doc.set("liaisonOfficerUserId", payload.liaisonOfficerUserId);
  const previousPmId = doc.get("projectManagerUserId") ? String(doc.get("projectManagerUserId")) : null;
  let newlyAssignedPmId: string | null = null;
  if (payload.projectManagerUserId !== undefined) {
    if (payload.projectManagerUserId === null) {
      if (doc.get("projectManagerUserId")) {
        throw new HttpError(409, "Reassign the Project Manager before clearing the seat");
      }
    } else {
      await assertEligibleManager(payload.projectManagerUserId);
      doc.set("projectManagerUserId", payload.projectManagerUserId);
      // This is the real-world trigger point — signMou() never sets this
      // field at creation, so notifying only from there would never fire.
      // Skip re-notifying when the PATCH just re-saves the same PM, and skip
      // notifying someone about assigning themselves.
      if (payload.projectManagerUserId !== previousPmId && payload.projectManagerUserId !== actorId) {
        newlyAssignedPmId = payload.projectManagerUserId;
      }
    }
  }
  applyActor(doc, actorId, "update");
  await doc.save();

  if (newlyAssignedPmId) {
    await notifyUsers([newlyAssignedPmId], {
      eventType: NotificationEventType.PROJECT_MANAGER_ASSIGNED,
      entityType: NotificationEntityType.PROJECT,
      entityId: id,
      actorUserId: actorId ?? null,
      title: "You were assigned as Project Manager",
      message: String(doc.get("name")),
    });
  }

  return getProject(id);
}

export async function transitionProject(id: string, to: string, actorId?: string) {
  const doc = await ProjectModel.findById(id);
  if (!doc) throw new HttpError(404, "Project not found");
  assertTransition("project", String(doc.get("status")), to);
  doc.set("status", to);
  // COMMISSIONING → HANDED_OVER is the only way in (transitions.ts), so this
  // stamp is the moment the plant was actually commissioned and handed over.
  if (to === ProjectStatus.HANDED_OVER && !doc.get("actualCommissioningDate")) {
    doc.set("actualCommissioningDate", new Date());
  }
  applyActor(doc, actorId, "status_transition");
  await doc.save();
  return getProject(id);
}

export async function replaceMembers(id: string, userIds: string[], actorId?: string) {
  const unique = [...new Set(userIds)];
  if (unique.length) {
    const found = await UserModel.find({ _id: { $in: unique } }).select("_id");
    if (found.length !== unique.length) throw new HttpError(400, "One or more users were not found");
  }
  const doc = await ProjectModel.findById(id);
  if (!doc) throw new HttpError(404, "Project not found");
  const existing = new Map(
    ((doc.get("members") as { userId: mongoose.Types.ObjectId; addedAt?: Date; addedBy?: mongoose.Types.ObjectId }[]) ?? []).map(
      (row) => [String(row.userId), row],
    ),
  );
  doc.set(
    "members",
    unique.map((userId) => {
      const prior = existing.get(userId);
      return {
        userId,
        addedAt: prior?.addedAt ?? new Date(),
        addedBy: prior?.addedBy ?? (actorId ? new mongoose.Types.ObjectId(actorId) : null),
      };
    }),
  );
  applyActor(doc, actorId, "members_replace");
  await doc.save();
  return getProject(id);
}

export async function listProjectAudit(id: string) {
  const exists = await ProjectModel.findById(id).select("_id");
  if (!exists) throw new HttpError(404, "Project not found");
  return AuditLogModel.find({ entityType: "Project", entityId: id })
    .sort({ at: -1 })
    .limit(100)
    .populate("actorId", "name email")
    .lean();
}

export async function softDeleteProject(id: string, actorId?: string) {
  const doc = await ProjectModel.findById(id);
  if (!doc) throw new HttpError(404, "Project not found");
  return doc.softDelete(actorId);
}

async function assertEligibleManager(userId: string) {
  await assertAssignableUser(userId, "Project Manager", [Role.PROJECT_MANAGER, Role.DIRECTOR]);
}

export { StoredFileModel, publicFile, ProjectStatus };
