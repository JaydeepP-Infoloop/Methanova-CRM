import type { Request, Response } from "express";
import * as service from "./invoices.service.js";
import * as validation from "./invoices.validation.js";

export async function list(req: Request, res: Response): Promise<void> {
  res.json(await service.listInvoices());
}

export async function get(req: Request, res: Response): Promise<void> {
  res.json(await service.getInvoice(req.params.id));
}

export async function create(req: Request, res: Response): Promise<void> {
  const body = validation.createInvoiceSchema.parse(req.body);
  res.status(201).json(await service.createInvoice(body, req.user?.id));
}

export async function update(req: Request, res: Response): Promise<void> {
  const body = validation.updateInvoiceSchema.parse(req.body);
  res.json(await service.updateInvoice(req.params.id, body, req.user?.id));
}

export async function remove(req: Request, res: Response): Promise<void> {
  res.json(await service.softDeleteInvoice(req.params.id, req.user?.id));
}

export async function transition(req: Request, res: Response): Promise<void> {
  const body = validation.transitionInvoiceSchema.parse(req.body);
  res.json(await service.transitionInvoice(req.params.id, body.to, req.user?.id));
}
