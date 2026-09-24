import { AccessLevel, AppModule } from "@methanova/shared-types";
import { Router } from "express";
import { requireAuth, requirePermission } from "../../../middlewares/index.js";
import * as controller from "./mou.controller.js";

export const mouRouter = Router();

mouRouter.use(requireAuth, requirePermission(AppModule.crm, AccessLevel.READ));

mouRouter.get("/", (req, res, next) => { void controller.list(req, res).catch(next); });
mouRouter.get("/:id", (req, res, next) => { void controller.get(req, res).catch(next); });
mouRouter.post("/", requirePermission(AppModule.crm, AccessLevel.WRITE), (req, res, next) => { void controller.create(req, res).catch(next); });
mouRouter.patch("/:id", requirePermission(AppModule.crm, AccessLevel.WRITE), (req, res, next) => { void controller.update(req, res).catch(next); });
mouRouter.delete("/:id", requirePermission(AppModule.crm, AccessLevel.WRITE), (req, res, next) => { void controller.remove(req, res).catch(next); });
mouRouter.post("/:id/transition", requirePermission(AppModule.crm, AccessLevel.WRITE), (req, res, next) => { void controller.transition(req, res).catch(next); });
mouRouter.post("/:id/sign", requirePermission(AppModule.crm, AccessLevel.WRITE), (req, res, next) => { void controller.sign(req, res).catch(next); });
