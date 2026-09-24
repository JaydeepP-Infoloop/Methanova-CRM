import type { Request, Response } from "express";
import * as service from "./feasibility.service.js";
import * as validation from "./feasibility.validation.js";

export async function list(req: Request, res: Response): Promise<void> {
  res.json(await service.listFeasibilitySurveys());
}

export async function get(req: Request, res: Response): Promise<void> {
  res.json(await service.getFeasibilitySurvey(req.params.id));
}

export async function create(req: Request, res: Response): Promise<void> {
  const body = validation.createFeasibilitySurveySchema.parse(req.body);
  res.status(201).json(await service.createFeasibilitySurvey(body, req.user?.id));
}

export async function update(req: Request, res: Response): Promise<void> {
  const body = validation.updateFeasibilitySurveySchema.parse(req.body);
  res.json(await service.updateFeasibilitySurvey(req.params.id, body, req.user?.id));
}

export async function remove(req: Request, res: Response): Promise<void> {
  res.json(await service.softDeleteFeasibilitySurvey(req.params.id, req.user?.id));
}


