import type { Request, Response } from "express";
import * as service from "./master-data.service.js";
import * as validation from "./master-data.validation.js";

export async function list(req: Request, res: Response): Promise<void> {
  res.json(await service.listMasterDatas());
}

export async function get(req: Request, res: Response): Promise<void> {
  res.json(await service.getMasterData(req.params.id));
}

export async function create(req: Request, res: Response): Promise<void> {
  const body = validation.createMasterDataSchema.parse(req.body);
  res.status(201).json(await service.createMasterData(body, req.user?.id));
}

export async function update(req: Request, res: Response): Promise<void> {
  const body = validation.updateMasterDataSchema.parse(req.body);
  res.json(await service.updateMasterData(req.params.id, body, req.user?.id));
}

export async function remove(req: Request, res: Response): Promise<void> {
  res.json(await service.softDeleteMasterData(req.params.id, req.user?.id));
}


