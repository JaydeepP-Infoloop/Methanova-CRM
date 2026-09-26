import type { Request, Response } from "express";
import { HttpError } from "../../../utils/http.js";
import * as service from "./dashboard.service.js";

export async function get(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new HttpError(401, "Authentication required");
  res.json(await service.getDashboard({ id: req.user.id, role: req.user.role }));
}
