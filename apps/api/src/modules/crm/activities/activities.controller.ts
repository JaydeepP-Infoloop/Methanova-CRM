import { ActivityParentType } from "@methanova/shared-types";
import type { Request, Response } from "express";
import { HttpError } from "../../../utils/http.js";
import { ActivityModel } from "./activities.model.js";
import * as service from "./activities.service.js";
import * as validation from "./activities.validation.js";

/**
 * Flat, cross-lead Activity Log — filters, real pagination and a summary
 * scoped to the same filter. Replaces the old bare `find().sort().limit()`,
 * which silently truncated an audit-grade log at 100 rows with no `total` and
 * no way to reach row 101.
 */
export async function list(req: Request, res: Response): Promise<void> {
  const query = validation.listFlatActivitiesQuerySchema.parse(req.query);
  res.json(await service.listActivities(query));
}

export async function get(req: Request, res: Response): Promise<void> {
  const doc = await ActivityModel.findById(req.params.id).populate("internalParticipantIds", "name email");
  if (!doc) throw new HttpError(404, "Activity not found");
  res.json(doc);
}

export async function listForLead(req: Request, res: Response): Promise<void> {
  const { limit } = validation.listActivitiesQuerySchema.parse(req.query);
  res.json(await service.listLeadActivities(req.params.id, limit));
}

export async function createForLead(req: Request, res: Response): Promise<void> {
  const body = validation.createActivitySchema.parse(req.body);
  const created = await service.createLeadActivity(
    req.params.id,
    {
      type: body.type,
      occurredAt: body.occurredAt,
      internalParticipantIds: body.internalParticipantIds,
      externalContactNames: body.externalContactNames,
      summary: body.summary,
      outcomeCategory: body.outcomeCategory ?? null,
      outcome: body.outcome,
      nextFollowUpDate: body.nextFollowUpDate ?? null,
      nextFollowUpAction: body.nextFollowUpAction,
      plantVisit: body.plantVisit ?? null,
      siteVisit: body.siteVisit ?? null,
    },
    req.user?.id,
  );
  res.status(201).json(created);
}

export async function assign(req: Request, res: Response): Promise<void> {
  const body = validation.assignLeadSchema.parse(req.body);
  // No userId means "assign to me" — the caller takes ownership.
  const userId = body.userId ?? req.user?.id ?? null;
  res.json(await service.assignLead(req.params.id, userId, req.user?.id));
}

export { ActivityParentType };
