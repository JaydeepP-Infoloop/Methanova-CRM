import type { Request, Response } from "express";
import { getAtRiskProjectIds } from "../../crm/dashboard/dashboard.service.js";
import * as files from "../../files/files.service.js";
import * as service from "./project.service.js";
import * as validation from "./project.validation.js";

export async function list(req: Request, res: Response): Promise<void> {
  const query = validation.listProjectsQuerySchema.parse(req.query);
  const onlyIds = query.atRisk && req.user ? await getAtRiskProjectIds(req.user.role) : undefined;
  res.json(
    await service.listProjects({
      mine: query.mine,
      userId: req.user?.id,
      portfolio: query.portfolio,
      onlyIds,
    }),
  );
}

export async function get(req: Request, res: Response): Promise<void> {
  res.json(await service.getProject(req.params.id));
}

export async function create(req: Request, res: Response): Promise<void> {
  const body = validation.createProjectSchema.parse(req.body);
  res.status(201).json(await service.createProject(body, req.user?.id));
}

export async function update(req: Request, res: Response): Promise<void> {
  const body = validation.updateProjectSchema.parse(req.body);
  res.json(await service.updateProject(req.params.id, body, req.user?.id));
}

export async function remove(req: Request, res: Response): Promise<void> {
  res.json(await service.softDeleteProject(req.params.id, req.user?.id));
}

export async function transition(req: Request, res: Response): Promise<void> {
  const body = validation.transitionProjectSchema.parse(req.body);
  res.json(await service.transitionProject(req.params.id, body.to, req.user?.id));
}

export async function replaceMembers(req: Request, res: Response): Promise<void> {
  const body = validation.replaceMembersSchema.parse(req.body);
  res.json(await service.replaceMembers(req.params.id, body.userIds, req.user?.id));
}

export async function audit(req: Request, res: Response): Promise<void> {
  res.json(await service.listProjectAudit(req.params.id));
}

export async function uploadLetterhead(req: Request, res: Response): Promise<void> {
  const body = validation.uploadProjectLetterheadSchema.parse(req.body);
  await files.uploadLetterhead(
    { ...body, kind: "PROJECT_LETTERHEAD", projectId: req.params.id },
    req.user?.id,
    req.user?.role,
  );
  res.json(await service.getProject(req.params.id));
}

export async function inheritLetterhead(req: Request, res: Response): Promise<void> {
  await files.clearProjectLetterhead(req.params.id, req.user?.id);
  res.json(await service.getProject(req.params.id));
}

export async function resetLetterhead(req: Request, res: Response): Promise<void> {
  await files.resetProjectLetterheadToOrg(req.params.id, req.user?.id);
  res.json(await service.getProject(req.params.id));
}
