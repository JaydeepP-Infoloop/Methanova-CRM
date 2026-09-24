import {
  AccessLevel,
  AppModule,
  canAccess,
  ProjectStatus,
  StoredFileKind,
  type Role as RoleType,
} from "@methanova/shared-types";
import mongoose from "mongoose";
import { applyActor, writeAudit } from "../../db/plugins/audit.plugin.js";
import { readStoredFile, storeOwnedBuffer } from "../../core/storage/index.js";
import { sniffRasterImage } from "../../core/storage/image.js";
import { HttpError } from "../../utils/http.js";
import { MasterDataModel } from "../admin/master-data/master-data.model.js";
import { ProjectModel } from "../projects/project/project.model.js";
import { StoredFileModel } from "./files.model.js";

export const ORG_LETTERHEAD_KEY = "org-letterhead";
export const DEFAULT_ORG_LEGAL_NAME = "Methanova Pvt Ltd";

export function publicFile(doc: { toObject?: () => Record<string, unknown> } & Record<string, unknown>) {
  const raw = typeof doc.toObject === "function" ? doc.toObject() : doc;
  const { storageKey: _hidden, ...rest } = raw as { storageKey?: string };
  return rest;
}

export async function getOrgLetterhead() {
  const row = (await MasterDataModel.findOne({ key: ORG_LETTERHEAD_KEY }).lean()) as
    | { payload?: { fileId?: string; legalName?: string } }
    | null;
  const payload = row?.payload ?? {};
  let file = null;
  if (payload.fileId && mongoose.isValidObjectId(payload.fileId)) {
    const doc = await StoredFileModel.findById(payload.fileId);
    file = doc ? publicFile(doc) : null;
  }
  return { fileId: payload.fileId ?? null, legalName: payload.legalName ?? DEFAULT_ORG_LEGAL_NAME, file };
}

export async function patchOrgLetterhead(legalName: string | undefined, actorId?: string) {
  const current = await getOrgLetterhead();
  const next = { fileId: current.fileId, legalName: legalName ?? current.legalName };
  await MasterDataModel.updateOne(
    { key: ORG_LETTERHEAD_KEY },
    { $set: { payload: next }, $setOnInsert: { key: ORG_LETTERHEAD_KEY, label: "Org letterhead" } },
    { upsert: true },
  );
  await writeAudit({
    actorId: actorId ? new mongoose.Types.ObjectId(actorId) : undefined,
    action: "org_letterhead_update",
    entityType: "MasterData",
    entityId: new mongoose.Types.ObjectId("000000000000000000000000"),
    before: current,
    after: next,
  });
  return getOrgLetterhead();
}

export async function uploadLetterhead(
  payload: { kind: StoredFileKind; filename: string; dataBase64: string; projectId?: string },
  actorId: string | undefined,
  actorRole: RoleType | undefined,
) {
  const kind = payload.kind;
  if (kind === StoredFileKind.ORG_LOGO) {
    if (!(actorRole && canAccess(actorRole, AppModule.admin, AccessLevel.FULL))) {
      throw new HttpError(403, "Org letterhead can only be replaced by a Director");
    }
  } else if (kind === StoredFileKind.PROJECT_LETTERHEAD) {
    if (!(actorRole && canAccess(actorRole, AppModule.projects, AccessLevel.FULL))) {
      throw new HttpError(403, "Project letterhead requires projects/FULL");
    }
    if (!payload.projectId) throw new HttpError(400, "projectId is required for a project letterhead");
  } else {
    throw new HttpError(400, "Unsupported file kind");
  }

  const buffer = Buffer.from(payload.dataBase64.replace(/^data:[^;]+;base64,/, ""), "base64");
  const sniffed = sniffRasterImage(buffer);
  const storageKey = await storeOwnedBuffer(kind, buffer, sniffed.extension);
  const doc = new StoredFileModel({
    kind,
    mime: sniffed.mime,
    bytes: buffer.length,
    width: sniffed.width,
    height: sniffed.height,
    originalFilename: payload.filename,
    storageKey,
    createdBy: actorId ?? null,
    projectId: payload.projectId ?? null,
  });
  applyActor(doc, actorId, "create");
  await doc.save();

  if (kind === StoredFileKind.ORG_LOGO) {
    const current = await getOrgLetterhead();
    await MasterDataModel.updateOne(
      { key: ORG_LETTERHEAD_KEY },
      {
        $set: { payload: { fileId: String(doc._id), legalName: current.legalName } },
        $setOnInsert: { key: ORG_LETTERHEAD_KEY, label: "Org letterhead" },
      },
      { upsert: true },
    );
  } else if (payload.projectId) {
    const project = await ProjectModel.findById(payload.projectId);
    if (!project) throw new HttpError(404, "Project not found");
    const before = project.get("letterheadFileId");
    project.set("letterheadFileId", doc._id);
    applyActor(project, actorId, "letterhead_replace");
    await project.save();
    void before;
  }

  return publicFile(doc);
}

export async function getFileMeta(id: string) {
  const doc = await StoredFileModel.findById(id);
  if (!doc) throw new HttpError(404, "File not found");
  return publicFile(doc);
}

export async function getFileBuffer(id: string) {
  const doc = await StoredFileModel.findById(id);
  if (!doc) throw new HttpError(404, "File not found");
  const data = await readStoredFile(String(doc.get("storageKey")));
  return { data, mime: String(doc.get("mime")), filename: String(doc.get("originalFilename")) };
}

export async function clearProjectLetterhead(projectId: string, actorId?: string) {
  const project = await ProjectModel.findById(projectId);
  if (!project) throw new HttpError(404, "Project not found");
  project.set("letterheadFileId", null);
  applyActor(project, actorId, "letterhead_inherit");
  await project.save();
}

export async function resetProjectLetterheadToOrg(projectId: string, actorId?: string) {
  const org = await getOrgLetterhead();
  if (!org.fileId) throw new HttpError(409, "There is no org letterhead to copy");
  const project = await ProjectModel.findById(projectId);
  if (!project) throw new HttpError(404, "Project not found");
  project.set("letterheadFileId", org.fileId);
  applyActor(project, actorId, "letterhead_reset");
  await project.save();
}

export function projectStatusIsClosed(status: string): boolean {
  return status === ProjectStatus.HANDED_OVER || status === ProjectStatus.OM;
}
