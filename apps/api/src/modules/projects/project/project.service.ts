import { ProjectStatus, Role } from "@methanova/shared-types";
import mongoose from "mongoose";
import { applyActor, AuditLogModel } from "../../../db/plugins/audit.plugin.js";
import { assertTransition } from "../../../core/state-machine/index.js";
import { HttpError } from "../../../utils/http.js";
import { UserModel } from "../../admin/users/users.model.js";
import { getOrgLetterhead, projectStatusIsClosed, publicFile } from "../../files/files.service.js";
import { StoredFileModel } from "../../files/files.model.js";
import { ProjectModel } from "./project.model.js";

const POPULATE = [
  { path: "projectManagerUserId", select: "name email role" },
  { path: "members.userId", select: "name email role" },
  { path: "letterheadFileId", select: "-storageKey" },
];

export async function listProjects(opts: { mine?: boolean; userId?: string }) {
  const filter: Record<string, unknown> = {};
  if (opts.mine && opts.userId) {
    filter.$or = [{ projectManagerUserId: opts.userId }, { "members.userId": opts.userId }];
  }
  return ProjectModel.find(filter)
    .populate("projectManagerUserId", "name email role")
    .sort({ createdAt: -1 })
    .limit(200);
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
  return {
    ...doc.toObject(),
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

export async function createProject(payload: Record<string, unknown>, actorId?: string) {
  const doc = new ProjectModel(payload);
  applyActor(doc, actorId, "create");
  return doc.save();
}

export async function updateProject(
  id: string,
  payload: {
    name?: string;
    shortName?: string | null;
    description?: string | null;
    projectManagerUserId?: string | null;
  },
  actorId?: string,
) {
  const doc = await ProjectModel.findById(id);
  if (!doc) throw new HttpError(404, "Project not found");
  const status = String(doc.get("status"));
  const identityTouched =
    payload.name !== undefined || payload.shortName !== undefined || payload.description !== undefined;
  if (identityTouched && projectStatusIsClosed(status)) {
    throw new HttpError(409, "Identity is read-only after handover");
  }
  if (payload.name !== undefined) doc.set("name", payload.name);
  if (payload.shortName !== undefined) doc.set("shortName", payload.shortName);
  if (payload.description !== undefined) doc.set("description", payload.description);
  if (payload.projectManagerUserId !== undefined) {
    if (payload.projectManagerUserId === null) {
      if (doc.get("projectManagerUserId")) {
        throw new HttpError(409, "Reassign the Project Manager before clearing the seat");
      }
    } else {
      await assertEligibleManager(payload.projectManagerUserId);
      doc.set("projectManagerUserId", payload.projectManagerUserId);
    }
  }
  applyActor(doc, actorId, "update");
  await doc.save();
  return getProject(id);
}

export async function transitionProject(id: string, to: string, actorId?: string) {
  const doc = await ProjectModel.findById(id);
  if (!doc) throw new HttpError(404, "Project not found");
  assertTransition("project", String(doc.get("status")), to);
  doc.set("status", to);
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
  const user = await UserModel.findById(userId).select("role name");
  if (!user) throw new HttpError(400, "That user does not exist");
  const role = String(user.get("role"));
  if (role !== Role.PROJECT_MANAGER && role !== Role.DIRECTOR) {
    throw new HttpError(400, "The Project Manager must hold the Project Manager or Director role");
  }
}

export { StoredFileModel, publicFile, ProjectStatus };
