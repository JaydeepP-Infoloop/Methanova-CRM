import { AccessLevel, AppModule } from "@methanova/shared-types";
import { Router } from "express";
import { requireAuth, requirePermission } from "../../middlewares/index.js";
import * as controller from "./reports.controller.js";

export const reportsRouter = Router();

reportsRouter.use(requireAuth, requirePermission(AppModule.reports, AccessLevel.READ));

reportsRouter.get("/", (req, res, next) => { void controller.list(req, res).catch(next); });
reportsRouter.get("/:id", (req, res, next) => { void controller.get(req, res).catch(next); });
reportsRouter.post("/", requirePermission(AppModule.reports, AccessLevel.WRITE), (req, res, next) => { void controller.create(req, res).catch(next); });
reportsRouter.patch("/:id", requirePermission(AppModule.reports, AccessLevel.WRITE), (req, res, next) => { void controller.update(req, res).catch(next); });
reportsRouter.delete("/:id", requirePermission(AppModule.reports, AccessLevel.WRITE), (req, res, next) => { void controller.remove(req, res).catch(next); });

