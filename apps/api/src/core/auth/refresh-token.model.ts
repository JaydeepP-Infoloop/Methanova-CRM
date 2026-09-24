import mongoose, { Schema } from "mongoose";

export interface RefreshTokenAttrs {
  userId: mongoose.Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

/**
 * Deliberately not run through applyDomainPlugins: refresh tokens are
 * ephemeral security artifacts, not audited business records, and rotation
 * already replaces them (see auth.service.ts) rather than needing soft delete.
 */
const schema = new Schema<RefreshTokenAttrs>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
  },
  { collection: "refresh_tokens", timestamps: true },
);

export const RefreshTokenModel =
  mongoose.models.RefreshToken ?? mongoose.model<RefreshTokenAttrs>("RefreshToken", schema);
