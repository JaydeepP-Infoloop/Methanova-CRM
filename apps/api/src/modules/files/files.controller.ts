import type { Request, Response } from "express";
import * as service from "./files.service.js";
import * as validation from "./files.validation.js";

export async function orgLetterhead(_req: Request, res: Response): Promise<void> {
  res.json(await service.getOrgLetterhead());
}

export async function patchOrgLetterhead(req: Request, res: Response): Promise<void> {
  const body = validation.orgLetterheadPatchSchema.parse(req.body);
  res.json(await service.patchOrgLetterhead(body.legalName, req.user?.id));
}

export async function upload(req: Request, res: Response): Promise<void> {
  const body = validation.uploadFileSchema.parse(req.body);
  res.status(201).json(await service.uploadLetterhead(body, req.user?.id, req.user?.role));
}

export async function getMeta(req: Request, res: Response): Promise<void> {
  res.json(await service.getFileMeta(req.params.id));
}

export async function getContent(req: Request, res: Response): Promise<void> {
  const file = await service.getFileBuffer(req.params.id);
  res.setHeader("Content-Type", file.mime);
  res.setHeader("Content-Disposition", `inline; filename="${file.filename.replace(/"/g, "")}"`);
  res.setHeader("Cache-Control", "private, max-age=300");
  res.send(file.data);
}
