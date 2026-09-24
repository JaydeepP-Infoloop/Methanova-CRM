import type { Request, Response } from "express";
import * as service from "./quotations.service.js";
import * as validation from "./quotations.validation.js";

export async function list(req: Request, res: Response): Promise<void> {
  res.json(await service.listQuotations());
}

export async function get(req: Request, res: Response): Promise<void> {
  res.json(await service.getQuotation(req.params.id));
}

export async function create(req: Request, res: Response): Promise<void> {
  const body = validation.createQuotationSchema.parse(req.body);
  res.status(201).json(await service.createQuotation(body, req.user?.id));
}

export async function update(req: Request, res: Response): Promise<void> {
  const body = validation.updateQuotationSchema.parse(req.body);
  res.json(await service.updateQuotation(req.params.id, body, req.user?.id));
}

export async function remove(req: Request, res: Response): Promise<void> {
  res.json(await service.softDeleteQuotation(req.params.id, req.user?.id));
}

export async function transition(req: Request, res: Response): Promise<void> {
  const body = validation.transitionQuotationSchema.parse(req.body);
  res.json(await service.transitionQuotation(req.params.id, body.to, req.user?.id));
}

export async function revisions(req: Request, res: Response): Promise<void> {
  res.json(await service.listRevisions(req.params.id));
}
