import { Role } from "@methanova/shared-types";
import mongoose, { Schema } from "mongoose";
import { applyDomainPlugins } from "../../../db/plugins/index.js";

export interface UserAttrs {
  email: string;
  name: string;
  role: Role;
  passwordHash: string;
}

const schema = new Schema<UserAttrs>({
  email: { type: String, required: true, unique: true, lowercase: true },
  name: { type: String, required: true },
  role: { type: String, required: true, enum: Object.values(Role) },
  passwordHash: { type: String, required: true },
});

applyDomainPlugins(schema);

export const UserModel = mongoose.models.User ?? mongoose.model<UserAttrs>("User", schema);
