import type { Request, Response } from "express";
import * as service from "./notifications.service.js";
import * as validation from "./notifications.validation.js";

export async function list(req: Request, res: Response): Promise<void> {
  res.json(await service.listNotifications());
}

export async function get(req: Request, res: Response): Promise<void> {
  res.json(await service.getNotification(req.params.id));
}

export async function create(req: Request, res: Response): Promise<void> {
  const body = validation.createNotificationSchema.parse(req.body);
  res.status(201).json(await service.createNotification(body, req.user?.id));
}

export async function update(req: Request, res: Response): Promise<void> {
  const body = validation.updateNotificationSchema.parse(req.body);
  res.json(await service.updateNotification(req.params.id, body, req.user?.id));
}

export async function remove(req: Request, res: Response): Promise<void> {
  res.json(await service.softDeleteNotification(req.params.id, req.user?.id));
}


