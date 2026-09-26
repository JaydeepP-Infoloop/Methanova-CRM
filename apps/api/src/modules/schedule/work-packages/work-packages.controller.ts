import type { Request, Response } from "express";
import * as service from "./work-packages.service.js";
import * as validation from "./work-packages.validation.js";

export async function list(req: Request, res: Response): Promise<void> {
  const { mine, ...filters } = validation.listWorkPackagesQuerySchema.parse(req.query);
  res.json(await service.listWorkPackages({ ...filters, assignedToUserId: mine ? req.user?.id : undefined }));
}

export async function get(req: Request, res: Response): Promise<void> {
  res.json(await service.getWorkPackage(req.params.id));
}

export async function create(req: Request, res: Response): Promise<void> {
  const body = validation.createWorkPackageSchema.parse(req.body);
  res.status(201).json(await service.createWorkPackage(body, req.user?.id));
}

export async function update(req: Request, res: Response): Promise<void> {
  const body = validation.updateWorkPackageSchema.parse(req.body);
  res.json(await service.updateWorkPackage(req.params.id, body, req.user?.id));
}

export async function remove(req: Request, res: Response): Promise<void> {
  res.json(await service.softDeleteWorkPackage(req.params.id, req.user?.id));
}

export async function transition(req: Request, res: Response): Promise<void> {
  const body = validation.transitionWorkPackageSchema.parse(req.body);
  res.json(await service.transitionWorkPackage(req.params.id, body.to, req.user?.id, body.delayReason));
}
