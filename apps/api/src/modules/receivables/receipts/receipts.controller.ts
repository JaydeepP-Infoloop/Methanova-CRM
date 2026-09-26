import type { Request, Response } from "express";
import * as service from "./receipts.service.js";
import * as validation from "./receipts.validation.js";

export async function list(req: Request, res: Response): Promise<void> {
  res.json(await service.listReceipts(validation.listReceiptsQuerySchema.parse(req.query)));
}

export async function get(req: Request, res: Response): Promise<void> {
  res.json(await service.getReceipt(req.params.id));
}

export async function create(req: Request, res: Response): Promise<void> {
  const body = validation.createReceiptSchema.parse(req.body);
  res.status(201).json(await service.createReceipt(body, req.user?.id));
}

export async function update(req: Request, res: Response): Promise<void> {
  const body = validation.updateReceiptSchema.parse(req.body);
  res.json(await service.updateReceipt(req.params.id, body, req.user?.id));
}

export async function remove(req: Request, res: Response): Promise<void> {
  res.json(await service.softDeleteReceipt(req.params.id, req.user?.id));
}


