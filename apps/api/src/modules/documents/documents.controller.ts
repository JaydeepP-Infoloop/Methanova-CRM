import type { Request, Response } from "express";
import * as service from "./documents.service.js";
import * as validation from "./documents.validation.js";

export async function list(req: Request, res: Response): Promise<void> {
  res.json(await service.listDocumentRecords());
}

export async function get(req: Request, res: Response): Promise<void> {
  res.json(await service.getDocumentRecord(req.params.id));
}

export async function create(req: Request, res: Response): Promise<void> {
  const body = validation.createDocumentRecordSchema.parse(req.body);
  res.status(201).json(await service.createDocumentRecord(body, req.user?.id));
}

export async function update(req: Request, res: Response): Promise<void> {
  const body = validation.updateDocumentRecordSchema.parse(req.body);
  res.json(await service.updateDocumentRecord(req.params.id, body, req.user?.id));
}

export async function remove(req: Request, res: Response): Promise<void> {
  res.json(await service.softDeleteDocumentRecord(req.params.id, req.user?.id));
}


