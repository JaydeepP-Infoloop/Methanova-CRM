import type { CookieOptions, Request, Response } from "express";
import { config } from "../../config/index.js";
import { getAuthUser, login, loginSchema, refreshSession, revokeRefreshToken } from "./auth.service.js";

const REFRESH_COOKIE = "refreshToken";

const refreshCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: config.nodeEnv === "production",
  sameSite: "lax",
  path: "/auth",
  maxAge: config.refreshTokenTtlMs,
};

export async function loginHandler(req: Request, res: Response): Promise<void> {
  const body = loginSchema.parse(req.body);
  const { accessToken, refreshToken, user } = await login(body.email, body.password);
  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions);
  res.json({ accessToken, user });
}

export async function meHandler(req: Request, res: Response): Promise<void> {
  // requireAuth runs first, so req.user is always populated here.
  res.json({ user: await getAuthUser(req.user!.id) });
}

export async function refreshHandler(req: Request, res: Response): Promise<void> {
  const presented = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  if (!presented) {
    res.status(401).json({ error: "No refresh token" });
    return;
  }
  const { accessToken, refreshToken, user } = await refreshSession(presented);
  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions);
  res.json({ accessToken, user });
}

export async function logoutHandler(req: Request, res: Response): Promise<void> {
  const presented = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  if (presented) {
    await revokeRefreshToken(presented);
  }
  res.clearCookie(REFRESH_COOKIE, { path: "/auth" });
  res.json({ ok: true });
}
