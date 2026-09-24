import { AccessLevel, AppModule } from "@methanova/shared-types";
import { Router } from "express";
import { requireAuth, requirePermission } from "../../../middlewares/index.js";
import * as controller from "./receipts.controller.js";

export const receiptsRouter = Router();

receiptsRouter.use(requireAuth, requirePermission(AppModule.receivables, AccessLevel.READ));

receiptsRouter.get("/", (req, res, next) => { void controller.list(req, res).catch(next); });
receiptsRouter.get("/:id", (req, res, next) => { void controller.get(req, res).catch(next); });
receiptsRouter.post("/", requirePermission(AppModule.receivables, AccessLevel.WRITE), (req, res, next) => { void controller.create(req, res).catch(next); });
receiptsRouter.patch("/:id", requirePermission(AppModule.receivables, AccessLevel.WRITE), (req, res, next) => { void controller.update(req, res).catch(next); });
receiptsRouter.delete("/:id", requirePermission(AppModule.receivables, AccessLevel.WRITE), (req, res, next) => { void controller.remove(req, res).catch(next); });

