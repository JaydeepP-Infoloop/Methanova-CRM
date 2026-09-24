import { AccessLevel, AppModule } from "@methanova/shared-types";
import { Router } from "express";
import { requireAuth, requirePermission } from "../../../middlewares/index.js";
import * as controller from "./quotations.controller.js";

export const quotationsRouter = Router();

quotationsRouter.use(requireAuth, requirePermission(AppModule.crm, AccessLevel.READ));

quotationsRouter.get("/", (req, res, next) => { void controller.list(req, res).catch(next); });
quotationsRouter.get("/:id", (req, res, next) => { void controller.get(req, res).catch(next); });
quotationsRouter.get("/:id/revisions", (req, res, next) => { void controller.revisions(req, res).catch(next); });
quotationsRouter.post("/", requirePermission(AppModule.crm, AccessLevel.WRITE), (req, res, next) => { void controller.create(req, res).catch(next); });
quotationsRouter.patch("/:id", requirePermission(AppModule.crm, AccessLevel.WRITE), (req, res, next) => { void controller.update(req, res).catch(next); });
quotationsRouter.delete("/:id", requirePermission(AppModule.crm, AccessLevel.WRITE), (req, res, next) => { void controller.remove(req, res).catch(next); });
quotationsRouter.post("/:id/transition", requirePermission(AppModule.crm, AccessLevel.WRITE), (req, res, next) => { void controller.transition(req, res).catch(next); });
