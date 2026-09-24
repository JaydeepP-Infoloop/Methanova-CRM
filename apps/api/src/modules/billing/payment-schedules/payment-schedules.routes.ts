import { AccessLevel, AppModule } from "@methanova/shared-types";
import { Router } from "express";
import { requireAuth, requirePermission } from "../../../middlewares/index.js";
import * as controller from "./payment-schedules.controller.js";

export const paymentSchedulesRouter = Router();

paymentSchedulesRouter.use(requireAuth, requirePermission(AppModule.billing, AccessLevel.READ));

paymentSchedulesRouter.get("/", (req, res, next) => { void controller.list(req, res).catch(next); });
paymentSchedulesRouter.get("/:id", (req, res, next) => { void controller.get(req, res).catch(next); });
paymentSchedulesRouter.post("/", requirePermission(AppModule.billing, AccessLevel.WRITE), (req, res, next) => { void controller.create(req, res).catch(next); });
paymentSchedulesRouter.patch("/:id", requirePermission(AppModule.billing, AccessLevel.WRITE), (req, res, next) => { void controller.update(req, res).catch(next); });
paymentSchedulesRouter.delete("/:id", requirePermission(AppModule.billing, AccessLevel.WRITE), (req, res, next) => { void controller.remove(req, res).catch(next); });

