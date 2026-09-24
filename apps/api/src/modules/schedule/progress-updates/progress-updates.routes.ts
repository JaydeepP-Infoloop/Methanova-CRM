import { AccessLevel, AppModule } from "@methanova/shared-types";
import { Router } from "express";
import { requireAuth, requirePermission } from "../../../middlewares/index.js";
import * as controller from "./progress-updates.controller.js";

export const progressUpdatesRouter = Router();

progressUpdatesRouter.use(requireAuth, requirePermission(AppModule.schedule, AccessLevel.READ));

progressUpdatesRouter.get("/", (req, res, next) => { void controller.list(req, res).catch(next); });
progressUpdatesRouter.get("/:id", (req, res, next) => { void controller.get(req, res).catch(next); });
progressUpdatesRouter.post("/", requirePermission(AppModule.schedule, AccessLevel.WRITE), (req, res, next) => { void controller.create(req, res).catch(next); });
progressUpdatesRouter.patch("/:id", requirePermission(AppModule.schedule, AccessLevel.WRITE), (req, res, next) => { void controller.update(req, res).catch(next); });
progressUpdatesRouter.delete("/:id", requirePermission(AppModule.schedule, AccessLevel.WRITE), (req, res, next) => { void controller.remove(req, res).catch(next); });

