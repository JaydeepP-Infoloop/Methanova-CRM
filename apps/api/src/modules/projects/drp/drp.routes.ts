import { AccessLevel, AppModule } from "@methanova/shared-types";
import { Router } from "express";
import { requireAuth, requirePermission } from "../../../middlewares/index.js";
import * as controller from "./drp.controller.js";

export const drpRouter = Router();

drpRouter.use(requireAuth, requirePermission(AppModule.projects, AccessLevel.READ));

drpRouter.get("/", (req, res, next) => { void controller.list(req, res).catch(next); });
drpRouter.get("/:id", (req, res, next) => { void controller.get(req, res).catch(next); });
drpRouter.post("/", requirePermission(AppModule.projects, AccessLevel.WRITE), (req, res, next) => { void controller.create(req, res).catch(next); });
drpRouter.patch("/:id", requirePermission(AppModule.projects, AccessLevel.WRITE), (req, res, next) => { void controller.update(req, res).catch(next); });
drpRouter.delete("/:id", requirePermission(AppModule.projects, AccessLevel.WRITE), (req, res, next) => { void controller.remove(req, res).catch(next); });

