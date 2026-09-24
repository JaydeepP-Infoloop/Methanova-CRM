import { AccessLevel, AppModule } from "@methanova/shared-types";
import { Router } from "express";
import { requireAuth, requirePermission } from "../../../middlewares/index.js";
import * as controller from "./invoices.controller.js";

export const invoicesRouter = Router();

invoicesRouter.use(requireAuth, requirePermission(AppModule.billing, AccessLevel.READ));

invoicesRouter.get("/", (req, res, next) => { void controller.list(req, res).catch(next); });
invoicesRouter.get("/:id", (req, res, next) => { void controller.get(req, res).catch(next); });
invoicesRouter.post("/", requirePermission(AppModule.billing, AccessLevel.WRITE), (req, res, next) => { void controller.create(req, res).catch(next); });
invoicesRouter.patch("/:id", requirePermission(AppModule.billing, AccessLevel.WRITE), (req, res, next) => { void controller.update(req, res).catch(next); });
invoicesRouter.delete("/:id", requirePermission(AppModule.billing, AccessLevel.WRITE), (req, res, next) => { void controller.remove(req, res).catch(next); });
invoicesRouter.post("/:id/transition", requirePermission(AppModule.billing, AccessLevel.WRITE), (req, res, next) => { void controller.transition(req, res).catch(next); });
