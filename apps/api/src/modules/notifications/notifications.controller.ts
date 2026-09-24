import type { Request, Response } from "express";
import { HttpError } from "../../utils/http.js";
import * as service from "./notifications.service.js";
import * as validation from "./notifications.validation.js";

/** Every handler reads the recipient from the token — a client can never ask to see or change someone else's notifications. */
function requireUserId(req: Request): string {
  if (!req.user) throw new HttpError(401, "Authentication required");
  return req.user.id;
}

export async function list(req: Request, res: Response): Promise<void> {
  const query = validation.listNotificationsQuerySchema.parse(req.query);
  res.json(await service.listForUser(requireUserId(req), query));
}

export async function unreadCount(req: Request, res: Response): Promise<void> {
  res.json({ count: await service.unreadCount(requireUserId(req)) });
}

export async function markRead(req: Request, res: Response): Promise<void> {
  res.json(await service.markRead(req.params.id, requireUserId(req)));
}

export async function markAllRead(req: Request, res: Response): Promise<void> {
  res.json(await service.markAllRead(requireUserId(req)));
}
