import { AccessLevel, AppModule } from "@methanova/shared-types";
import { Router } from "express";
import { requireAuth, requirePermission } from "../../../middlewares/index.js";
import * as controller from "./roles.controller.js";

export const rolesRouter = Router();

rolesRouter.use(requireAuth, requirePermission(AppModule.admin, AccessLevel.READ));

rolesRouter.get("/", (req, res, next) => { void controller.list(req, res).catch(next); });
rolesRouter.get("/:id", (req, res, next) => { void controller.get(req, res).catch(next); });
rolesRouter.post("/", requirePermission(AppModule.admin, AccessLevel.WRITE), (req, res, next) => { void controller.create(req, res).catch(next); });
rolesRouter.patch("/:id", requirePermission(AppModule.admin, AccessLevel.WRITE), (req, res, next) => { void controller.update(req, res).catch(next); });
rolesRouter.delete("/:id", requirePermission(AppModule.admin, AccessLevel.WRITE), (req, res, next) => { void controller.remove(req, res).catch(next); });

