import { createHash, randomBytes } from "node:crypto";
import { Role } from "@methanova/shared-types";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { config } from "../../config/index.js";
import { UserModel } from "../../modules/admin/users/users.model.js";
import { HttpError } from "../../utils/http.js";
import { RefreshTokenModel } from "./refresh-token.model.js";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export interface AuthUserDto {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: AuthUserDto;
}

function toUserDto(user: { _id: unknown; email: string; name: string; role: Role }): AuthUserDto {
  return { id: String(user._id), email: user.email, name: user.name, role: user.role };
}

export function signAccessToken(user: AuthUserDto): string {
  const options: jwt.SignOptions = { expiresIn: config.accessTokenTtl as jwt.SignOptions["expiresIn"] };
  return jwt.sign({ sub: user.id, email: user.email, role: user.role }, config.jwtSecret, options);
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function issueRefreshToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await RefreshTokenModel.create({
    userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + config.refreshTokenTtlMs),
  });
  return token;
}

/**
 * Reads the user from the database rather than echoing the JWT payload: the
 * token carries only id/email/role, so a client that reloads the page would
 * otherwise lose the display name until its next login.
 */
export async function getAuthUser(id: string): Promise<AuthUserDto> {
  const user = await UserModel.findById(id);
  if (!user) {
    throw new HttpError(401, "User no longer exists");
  }
  return toUserDto(user);
}

export async function login(email: string, password: string): Promise<AuthTokens> {
  const user = await UserModel.findOne({ email: email.toLowerCase() });
  if (!user) {
    throw new HttpError(401, "Invalid credentials");
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    throw new HttpError(401, "Invalid credentials");
  }
  const dto = toUserDto(user);
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(dto),
    issueRefreshToken(dto.id),
  ]);
  return { accessToken, refreshToken, user: dto };
}

/** Rotates the refresh token on every use: the presented token is revoked and a new one issued. */
export async function refreshSession(presentedToken: string): Promise<AuthTokens> {
  const record = await RefreshTokenModel.findOne({ tokenHash: hashToken(presentedToken) });
  if (!record || record.revokedAt || record.expiresAt.getTime() < Date.now()) {
    throw new HttpError(401, "Invalid or expired refresh token");
  }
  const user = await UserModel.findById(record.userId);
  if (!user) {
    throw new HttpError(401, "Invalid refresh token");
  }

  record.revokedAt = new Date();
  await record.save();

  const dto = toUserDto(user);
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(dto),
    issueRefreshToken(dto.id),
  ]);
  return { accessToken, refreshToken, user: dto };
}

export async function revokeRefreshToken(presentedToken: string): Promise<void> {
  await RefreshTokenModel.updateOne(
    { tokenHash: hashToken(presentedToken), revokedAt: null },
    { revokedAt: new Date() },
  );
}
