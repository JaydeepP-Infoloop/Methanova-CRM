import { AccessLevel, AppModule, canAccess } from "@methanova/shared-types";
import type { Request, Response } from "express";
import * as service from "./my-day.service.js";
import { myDayQuerySchema } from "./my-day.validation.js";

export async function get(req: Request, res: Response): Promise<void> {
  const { scope } = myDayQuerySchema.parse(req.query);

  // A hidden toggle in the UI is a UX nicety, never the actual access
  // control (PROJECT_CONTEXT §6) — team scope is downgraded here regardless
  // of what the client asked for, for anyone who does not hold crm/FULL.
  const effectiveScope = scope === "team" && req.user && canAccess(req.user.role, AppModule.crm, AccessLevel.FULL)
    ? "team"
    : "mine";

  res.json(await service.getMyDay(req.user!.id, effectiveScope));
}
