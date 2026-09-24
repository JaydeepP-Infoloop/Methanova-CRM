import { AccessLevel, AppModule } from "@methanova/shared-types";
import { Router } from "express";
import { requireAuth, requirePermission } from "../../../middlewares/index.js";
import * as controller from "./work-packages.controller.js";

export const workPackagesRouter = Router();

workPackagesRouter.use(requireAuth, requirePermission(AppModule.schedule, AccessLevel.READ));

workPackagesRouter.get("/", (req, res, next) => { void controller.list(req, res).catch(next); });
workPackagesRouter.get("/:id", (req, res, next) => { void controller.get(req, res).catch(next); });
workPackagesRouter.post("/", requirePermission(AppModule.schedule, AccessLevel.WRITE), (req, res, next) => { void controller.create(req, res).catch(next); });
workPackagesRouter.patch("/:id", requirePermission(AppModule.schedule, AccessLevel.WRITE), (req, res, next) => { void controller.update(req, res).catch(next); });
workPackagesRouter.delete("/:id", requirePermission(AppModule.schedule, AccessLevel.WRITE), (req, res, next) => { void controller.remove(req, res).catch(next); });
workPackagesRouter.post("/:id/transition", requirePermission(AppModule.schedule, AccessLevel.WRITE), (req, res, next) => { void controller.transition(req, res).catch(next); });
