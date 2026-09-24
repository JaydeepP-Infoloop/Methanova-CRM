import { AccessLevel, AppModule } from "@methanova/shared-types";
import { Router } from "express";
import { requireAuth, requirePermission } from "../../middlewares/index.js";
import * as controller from "./notifications.controller.js";

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth, requirePermission(AppModule.reports, AccessLevel.READ));

notificationsRouter.get("/", (req, res, next) => { void controller.list(req, res).catch(next); });
notificationsRouter.get("/:id", (req, res, next) => { void controller.get(req, res).catch(next); });
notificationsRouter.post("/", requirePermission(AppModule.reports, AccessLevel.WRITE), (req, res, next) => { void controller.create(req, res).catch(next); });
notificationsRouter.patch("/:id", requirePermission(AppModule.reports, AccessLevel.WRITE), (req, res, next) => { void controller.update(req, res).catch(next); });
notificationsRouter.delete("/:id", requirePermission(AppModule.reports, AccessLevel.WRITE), (req, res, next) => { void controller.remove(req, res).catch(next); });

