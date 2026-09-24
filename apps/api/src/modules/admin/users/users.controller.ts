import type { Request, Response } from "express";
import * as service from "./users.service.js";
import * as validation from "./users.validation.js";

export async function list(req: Request, res: Response): Promise<void> {
  res.json(await service.listUsers());
}

export async function get(req: Request, res: Response): Promise<void> {
  res.json(await service.getUser(req.params.id));
}

export async function create(req: Request, res: Response): Promise<void> {
  const body = validation.createUserSchema.parse(req.body);
  res.status(201).json(await service.createUser(body, req.user?.id));
}

export async function update(req: Request, res: Response): Promise<void> {
  const body = validation.updateUserSchema.parse(req.body);
  res.json(await service.updateUser(req.params.id, body, req.user?.id));
}

export async function remove(req: Request, res: Response): Promise<void> {
  res.json(await service.softDeleteUser(req.params.id, req.user?.id));
}


