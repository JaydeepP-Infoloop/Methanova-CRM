import bcrypt from "bcryptjs";
import { applyActor } from "../../../db/plugins/audit.plugin.js";
import { HttpError } from "../../../utils/http.js";
import { ProjectModel } from "../../projects/project/project.model.js";
import { UserModel } from "./users.model.js";

export async function listUsers() {
  return UserModel.find().select("-passwordHash").sort({ createdAt: -1 }).limit(100);
}

export async function getUser(id: string) {
  const doc = await UserModel.findById(id).select("-passwordHash");
  if (!doc) throw new HttpError(404, "User not found");
  return doc;
}

export async function createUser(payload: Record<string, unknown>, actorId?: string) {
  const password = String(payload.password ?? "");
  if (password.length < 8) {
    throw new HttpError(400, "Password must be at least 8 characters");
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const { password: _p, ...rest } = payload;
  const doc = new UserModel({ ...rest, passwordHash });
  applyActor(doc, actorId, "create");
  await doc.save();
  return getUser(String(doc._id));
}

export async function updateUser(id: string, payload: Record<string, unknown>, actorId?: string) {
  const { password, ...rest } = payload;
  const doc = await UserModel.findById(id);
  if (!doc) throw new HttpError(404, "User not found");
  Object.assign(doc, rest);
  if (typeof password === "string" && password.length >= 8) {
    doc.passwordHash = await bcrypt.hash(password, 10);
  }
  applyActor(doc, actorId, "update");
  await doc.save();
  return getUser(id);
}

export async function softDeleteUser(id: string, actorId?: string) {
  const assigned = await ProjectModel.findOne({ projectManagerUserId: id }).select("code name");
  if (assigned) {
    throw new HttpError(
      409,
      `Reassign the Project Manager on ${assigned.get("code")} (${assigned.get("name")}) before deactivating this user`,
    );
  }
  const doc = await UserModel.findById(id);
  if (!doc) throw new HttpError(404, "User not found");
  return doc.softDelete(actorId);
}
