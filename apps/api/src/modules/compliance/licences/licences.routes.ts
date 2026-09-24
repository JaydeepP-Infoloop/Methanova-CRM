import { AccessLevel, AppModule } from "@methanova/shared-types";
import { Router } from "express";
import { requireAuth, requirePermission } from "../../../middlewares/index.js";
import * as controller from "./licences.controller.js";

export const licencesRouter = Router();

licencesRouter.use(requireAuth, requirePermission(AppModule.compliance, AccessLevel.READ));

licencesRouter.get("/", (req, res, next) => { void controller.list(req, res).catch(next); });
licencesRouter.get("/:id", (req, res, next) => { void controller.get(req, res).catch(next); });
licencesRouter.post("/", requirePermission(AppModule.compliance, AccessLevel.WRITE), (req, res, next) => { void controller.create(req, res).catch(next); });
licencesRouter.patch("/:id", requirePermission(AppModule.compliance, AccessLevel.WRITE), (req, res, next) => { void controller.update(req, res).catch(next); });
licencesRouter.delete("/:id", requirePermission(AppModule.compliance, AccessLevel.WRITE), (req, res, next) => { void controller.remove(req, res).catch(next); });
licencesRouter.post("/:id/transition", requirePermission(AppModule.compliance, AccessLevel.WRITE), (req, res, next) => { void controller.transition(req, res).catch(next); });
