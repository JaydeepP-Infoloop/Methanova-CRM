import type { Request, Response } from "express";
import * as service from "./drp.service.js";
import * as validation from "./drp.validation.js";

export async function list(req: Request, res: Response): Promise<void> {
  res.json(await service.listDprs());
}

export async function get(req: Request, res: Response): Promise<void> {
  res.json(await service.getDpr(req.params.id));
}

export async function create(req: Request, res: Response): Promise<void> {
  const body = validation.createDprSchema.parse(req.body);
  res.status(201).json(await service.createDpr(body, req.user?.id));
}

export async function update(req: Request, res: Response): Promise<void> {
  const body = validation.updateDprSchema.parse(req.body);
  res.json(await service.updateDpr(req.params.id, body, req.user?.id));
}

export async function remove(req: Request, res: Response): Promise<void> {
  res.json(await service.softDeleteDpr(req.params.id, req.user?.id));
}


