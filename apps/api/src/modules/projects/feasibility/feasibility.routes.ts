import { AccessLevel, AppModule } from "@methanova/shared-types";
import { Router } from "express";
import { requireAuth, requirePermission } from "../../../middlewares/index.js";
import * as controller from "./feasibility.controller.js";

export const feasibilityRouter = Router();

feasibilityRouter.use(requireAuth, requirePermission(AppModule.projects, AccessLevel.READ));

feasibilityRouter.get("/", (req, res, next) => { void controller.list(req, res).catch(next); });
feasibilityRouter.get("/:id", (req, res, next) => { void controller.get(req, res).catch(next); });
feasibilityRouter.post("/", requirePermission(AppModule.projects, AccessLevel.WRITE), (req, res, next) => { void controller.create(req, res).catch(next); });
feasibilityRouter.patch("/:id", requirePermission(AppModule.projects, AccessLevel.WRITE), (req, res, next) => { void controller.update(req, res).catch(next); });
feasibilityRouter.delete("/:id", requirePermission(AppModule.projects, AccessLevel.WRITE), (req, res, next) => { void controller.remove(req, res).catch(next); });

