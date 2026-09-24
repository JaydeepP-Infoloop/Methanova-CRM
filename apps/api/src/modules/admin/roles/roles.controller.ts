import type { Request, Response } from "express";
import * as service from "./roles.service.js";
import * as validation from "./roles.validation.js";

export async function list(req: Request, res: Response): Promise<void> {
  res.json(await service.listRoleRecords());
}

export async function get(req: Request, res: Response): Promise<void> {
  res.json(await service.getRoleRecord(req.params.id));
}

export async function create(req: Request, res: Response): Promise<void> {
  const body = validation.createRoleRecordSchema.parse(req.body);
  res.status(201).json(await service.createRoleRecord(body, req.user?.id));
}

export async function update(req: Request, res: Response): Promise<void> {
  const body = validation.updateRoleRecordSchema.parse(req.body);
  res.json(await service.updateRoleRecord(req.params.id, body, req.user?.id));
}

export async function remove(req: Request, res: Response): Promise<void> {
  res.json(await service.softDeleteRoleRecord(req.params.id, req.user?.id));
}


