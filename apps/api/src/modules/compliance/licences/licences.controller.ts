import type { Request, Response } from "express";
import * as service from "./licences.service.js";
import * as validation from "./licences.validation.js";

export async function list(req: Request, res: Response): Promise<void> {
  res.json(await service.listLicences());
}

export async function get(req: Request, res: Response): Promise<void> {
  res.json(await service.getLicence(req.params.id));
}

export async function create(req: Request, res: Response): Promise<void> {
  const body = validation.createLicenceSchema.parse(req.body);
  res.status(201).json(await service.createLicence(body, req.user?.id));
}

export async function update(req: Request, res: Response): Promise<void> {
  const body = validation.updateLicenceSchema.parse(req.body);
  res.json(await service.updateLicence(req.params.id, body, req.user?.id));
}

export async function remove(req: Request, res: Response): Promise<void> {
  res.json(await service.softDeleteLicence(req.params.id, req.user?.id));
}

export async function transition(req: Request, res: Response): Promise<void> {
  const body = validation.transitionLicenceSchema.parse(req.body);
  res.json(await service.transitionLicence(req.params.id, body.to, req.user?.id, body.validUntil));
}
