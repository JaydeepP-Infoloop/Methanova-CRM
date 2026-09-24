import { AccessLevel, AppModule } from "@methanova/shared-types";
import { Router } from "express";
import { requireAuth, requirePermission } from "../../../middlewares/index.js";
import * as controller from "./master-data.controller.js";

export const masterDataRouter = Router();

masterDataRouter.use(requireAuth, requirePermission(AppModule.admin, AccessLevel.READ));

masterDataRouter.get("/", (req, res, next) => { void controller.list(req, res).catch(next); });
masterDataRouter.get("/:id", (req, res, next) => { void controller.get(req, res).catch(next); });
masterDataRouter.post("/", requirePermission(AppModule.admin, AccessLevel.WRITE), (req, res, next) => { void controller.create(req, res).catch(next); });
masterDataRouter.patch("/:id", requirePermission(AppModule.admin, AccessLevel.WRITE), (req, res, next) => { void controller.update(req, res).catch(next); });
masterDataRouter.delete("/:id", requirePermission(AppModule.admin, AccessLevel.WRITE), (req, res, next) => { void controller.remove(req, res).catch(next); });

