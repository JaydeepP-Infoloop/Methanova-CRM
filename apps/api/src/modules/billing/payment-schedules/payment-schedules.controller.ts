import type { Request, Response } from "express";
import * as service from "./payment-schedules.service.js";
import * as validation from "./payment-schedules.validation.js";

export async function list(req: Request, res: Response): Promise<void> {
  res.json(await service.listPaymentSchedules());
}

export async function get(req: Request, res: Response): Promise<void> {
  res.json(await service.getPaymentSchedule(req.params.id));
}

export async function create(req: Request, res: Response): Promise<void> {
  const body = validation.createPaymentScheduleSchema.parse(req.body);
  res.status(201).json(await service.createPaymentSchedule(body, req.user?.id));
}

export async function update(req: Request, res: Response): Promise<void> {
  const body = validation.updatePaymentScheduleSchema.parse(req.body);
  res.json(await service.updatePaymentSchedule(req.params.id, body, req.user?.id));
}

export async function remove(req: Request, res: Response): Promise<void> {
  res.json(await service.softDeletePaymentSchedule(req.params.id, req.user?.id));
}


