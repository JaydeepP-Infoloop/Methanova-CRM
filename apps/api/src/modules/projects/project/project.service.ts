import {
  NotificationEntityType,
  NotificationEventType,
  ProjectStatus,
  Role,
  WorkPackageStatus,
  weightedProgressPct,
  type DashboardActiveProjectDto,
} from "@methanova/shared-types";
import mongoose from "mongoose";
import { applyActor, AuditLogModel } from "../../../db/plugins/audit.plugin.js";
import { assertTransition } from "../../../core/state-machine/index.js";
import { HttpError } from "../../../utils/http.js";
import { MouModel } from "../../crm/mou/mou.model.js";
import { notifyUsers } from "../../notifications/notifications.service.js";
import { WorkPackageModel } from "../../schedule/work-packages/work-packages.model.js";
import { UserModel } from "../../admin/users/users.model.js";
import { assertAssignableUser } from "../../admin/users/users.service.js";
import { FeedstockTypeModel } from "../../admin/master-data/geography.model.js";
import { getOrgLetterhead, projectStatusIsClosed, publicFile } from "../../files/files.service.js";
import { StoredFileModel } from "../../files/files.model.js";
import { ProjectModel } from "./project.model.js";

const TERMINAL_WORK_PACKAGE_STATUSES: string[] = [WorkPackageStatus.COMPLETED, WorkPackageStatus.HANDED_OVER];

const POPULATE = [
  { path: "projectManagerUserId", select: "name email role" },
  { path: "siteEngineerUserId", select: "name email role" },
  { path: "liaisonOfficerUserId", select: "name email role" },
  { path: "members.userId", select: "name email role" },
  { path: "letterheadFileId", select: "-storageKey" },
];

/**
 * `progressPct` per project, derived on every read from the live work
 * packages — never stored, so it can't lag a progress update. One query for
 * any number of projects.
 */
async function progressByProject(projectIds: unknown[]): Promise<Map<string, number | null>> {
  const workPackages = await WorkPackageModel.find({ projectId: { $in: projectIds } })
    .select("projectId status percentComplete amountPaise")
    .lean();
  const grouped = new Map<string, { status: string; percentComplete: number; amountPaise: number }[]>();
  for (const workPackage of workPackages) {
    const key = String(workPackage.projectId);
    const list = grouped.get(key) ?? [];
    list.push({
      status: String(workPackage.status),
      percentComplete: Number(workPackage.percentComplete ?? 0),
      amountPaise: Number(workPackage.amountPaise ?? 0),
    });
    grouped.set(key, list);
  }
  return new Map(projectIds.map((id) => [String(id), weightedProgressPct(grouped.get(String(id)) ?? [])]));
}

export async function listProjects(opts: { mine?: boolean; userId?: string }) {
  const filter: Record<string, unknown> = {};
  if (opts.mine && opts.userId) {
    filter.$or = [
      { projectManagerUserId: opts.userId },
      { siteEngineerUserId: opts.userId },
      { liaisonOfficerUserId: opts.userId },
      { "members.userId": opts.userId },
    ];
  }
  const docs = await ProjectModel.find(filter)
    .populate("projectManagerUserId", "name email role")
    .sort({ createdAt: -1 })
    .limit(200);
  const progress = await progressByProject(docs.map((doc) => doc._id));
  return docs.map((doc) => ({
    ...doc.toObject(),
    id: String(doc._id),
    progressPct: progress.get(String(doc._id)) ?? null,
  }));
}

/**
 * The Dashboard's Active Projects card. "Current work package" is the first
 * one not yet COMPLETED/HANDED_OVER, ordered by `sequence` — nothing
 * auto-creates work packages at MOU-sign (they're built out afterwards, by
 * the PM, per the SoW's own process), so a freshly signed project honestly
 * has none yet and falls back to its own `targetCommissioningDate` for
 * `plannedEnd` rather than showing a blank cell with no date to point to at
 * all. `valuePaise` is the accepted MOU's `contractValuePaise`, not
 * recomputed here — `mou.service.ts` already owns that number.
 */
export async function getActiveProjectsSummary(limit = 20): Promise<DashboardActiveProjectDto[]> {
  const projects = await ProjectModel.find({ deletedAt: null }).sort({ createdAt: -1 }).limit(limit).lean();
  if (projects.length === 0) return [];

  const projectIds = projects.map((project) => project._id);
  const mouIds = projects.map((project) => project.mouId);

  const [workPackages, mous] = await Promise.all([
    WorkPackageModel.find({ projectId: { $in: projectIds }, deletedAt: null })
      .sort({ sequence: 1 })
      .select("projectId name status sequence plannedEnd")
      .lean(),
    MouModel.find({ _id: { $in: mouIds } }).select("contractValuePaise").lean(),
  ]);

  const mouById = new Map(mous.map((mou) => [String(mou._id), mou]));
  const workPackagesByProject = new Map<string, typeof workPackages>();
  for (const workPackage of workPackages) {
    const key = String(workPackage.projectId);
    const list = workPackagesByProject.get(key) ?? [];
    list.push(workPackage);
    workPackagesByProject.set(key, list);
  }

  return projects.map((project) => {
    const ownWorkPackages = workPackagesByProject.get(String(project._id)) ?? [];
    const current = ownWorkPackages.find(
      (workPackage) => !TERMINAL_WORK_PACKAGE_STATUSES.includes(String(workPackage.status)),
    );
    return {
      id: String(project._id),
      code: String(project.code),
      client: String(project.name),
      status: String(project.status),
      workPackageName: current ? String(current.name) : null,
      plannedEnd: current?.plannedEnd
        ? new Date(current.plannedEnd).toISOString()
        : project.targetCommissioningDate
          ? new Date(project.targetCommissioningDate as Date).toISOString()
          : null,
      valuePaise: mouById.get(String(project.mouId))?.contractValuePaise ?? 0,
    };
  });
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
  const progress = await progressByProject([doc._id]);
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
