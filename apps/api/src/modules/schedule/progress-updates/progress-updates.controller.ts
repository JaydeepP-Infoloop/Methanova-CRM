import type { Request, Response } from "express";
import * as service from "./progress-updates.service.js";
import * as validation from "./progress-updates.validation.js";

export async function list(req: Request, res: Response): Promise<void> {
  res.json(await service.listProgressUpdates());
}

export async function get(req: Request, res: Response): Promise<void> {
  res.json(await service.getProgressUpdate(req.params.id));
}

export async function create(req: Request, res: Response): Promise<void> {
  const body = validation.createProgressUpdateSchema.parse(req.body);
  res.status(201).json(await service.createProgressUpdate(body, req.user?.id));
}

export async function update(req: Request, res: Response): Promise<void> {
  const body = validation.updateProgressUpdateSchema.parse(req.body);
  res.json(await service.updateProgressUpdate(req.params.id, body, req.user?.id));
}

export async function remove(req: Request, res: Response): Promise<void> {
  res.json(await service.softDeleteProgressUpdate(req.params.id, req.user?.id));
}


