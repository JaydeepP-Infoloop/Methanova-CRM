import type { Request, Response } from "express";
import * as service from "./leads.service.js";
import * as validation from "./leads.validation.js";

export async function list(req: Request, res: Response): Promise<void> {
  const query = validation.listLeadsQuerySchema.parse(req.query);
  res.json(await service.listLeads(query));
}

/**
 * Takes the same query as the list so the filtered figures describe exactly
 * the rows the table is showing. Paging fields are parsed and ignored — the
 * summary covers the whole filtered set, not one page of it.
 */
export async function summary(req: Request, res: Response): Promise<void> {
  const query = validation.listLeadsQuerySchema.parse(req.query);
  res.json(await service.getInboxSummary(query));
}

export async function sourceMix(_req: Request, res: Response): Promise<void> {
  res.json(await service.getSourceMix());
}

export async function criteriaTally(_req: Request, res: Response): Promise<void> {
  res.json(await service.getCriteriaTally());
}

export async function duplicates(req: Request, res: Response): Promise<void> {
  const companyName = String(req.query.companyName ?? "");
  res.json(await service.findDuplicatesByName(companyName));
}

export async function expectedCbg(req: Request, res: Response): Promise<void> {
  const body = validation.expectedCbgSchema.parse(req.body);
  res.json(await service.computeExpectedCbg(body.feedstockTypeIds, body.feedstockQtyTpd));
}

export async function get(req: Request, res: Response): Promise<void> {
  res.json(await service.getLeadDetail(req.params.id));
}

export async function create(req: Request, res: Response): Promise<void> {
  const body = validation.createLeadSchema.parse(req.body);
  res.status(201).json(await service.createLead(body, req.user?.id));
}

export async function update(req: Request, res: Response): Promise<void> {
  const body = validation.updateLeadSchema.parse(req.body);
  res.json(await service.updateLead(req.params.id, body, req.user?.id));
}

export async function remove(req: Request, res: Response): Promise<void> {
  res.json(await service.softDeleteLead(req.params.id, req.user?.id));
}

export async function updateContacts(req: Request, res: Response): Promise<void> {
  const body = validation.updateContactsSchema.parse(req.body);
  res.json(await service.updateLeadContacts(req.params.id, body.contacts, req.user?.id));
}

export async function transition(req: Request, res: Response): Promise<void> {
  const body = validation.transitionLeadSchema.parse(req.body);
  res.json(
    await service.transitionLead(req.params.id, body.to, req.user?.id, {
      reason: body.reason,
      competitor: body.competitor,
      reengageOn: body.reengageOn,
    }),
  );
}

export async function park(req: Request, res: Response): Promise<void> {
  const body = validation.parkLeadSchema.parse(req.body);
  res.json(
    await service.parkLead(
      req.params.id,
      { reason: body.reason, revisitDate: body.revisitDate },
      req.user?.id,
    ),
  );
}

export async function unpark(req: Request, res: Response): Promise<void> {
  res.json(await service.unparkLead(req.params.id, req.user?.id));
}

export async function qualify(req: Request, res: Response): Promise<void> {
  const body = validation.qualifyLeadSchema.parse(req.body);
  res.json(
    await service.qualifyLead(
      req.params.id,
      {
        scores: body.scores.map((entry) => ({
          criterionKey: entry.criterionKey,
          score: entry.score,
          note: entry.note,
        })),
        decision: body.decision as Parameters<typeof service.qualifyLead>[1]["decision"],
        disqualificationReason: body.disqualificationReason,
        budgetMinPaise: body.budgetMinPaise,
        budgetMaxPaise: body.budgetMaxPaise,
      },
      req.user?.id,
    ),
  );
}
