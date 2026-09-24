import type { Request, Response } from "express";
import * as service from "./dashboard.service.js";

export async function get(req: Request, res: Response): Promise<void> {
  res.json(await service.getDashboard());
}
