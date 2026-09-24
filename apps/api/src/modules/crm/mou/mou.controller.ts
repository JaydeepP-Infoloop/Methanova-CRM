import type { Request, Response } from "express";
import * as service from "./mou.service.js";
import * as validation from "./mou.validation.js";

export async function list(req: Request, res: Response): Promise<void> {
  res.json(await service.listMous());
}

export async function get(req: Request, res: Response): Promise<void> {
  res.json(await service.getMou(req.params.id));
}

export async function create(req: Request, res: Response): Promise<void> {
  const body = validation.createMouSchema.parse(req.body);
  res.status(201).json(await service.createMou(body, req.user?.id));
}

export async function update(req: Request, res: Response): Promise<void> {
  const body = validation.updateMouSchema.parse(req.body);
  res.json(await service.updateMou(req.params.id, body, req.user?.id));
}

export async function remove(req: Request, res: Response): Promise<void> {
  res.json(await service.softDeleteMou(req.params.id, req.user?.id));
}

export async function transition(req: Request, res: Response): Promise<void> {
  const body = validation.transitionMouSchema.parse(req.body);
  res.json(await service.transitionMou(req.params.id, body.to, req.user?.id, req.user?.role));
}

export async function sign(req: Request, res: Response): Promise<void> {
  res.json(await service.signMou(req.params.id, req.user?.id, req.user?.role));
}
