import { AccessLevel, AppModule } from "@methanova/shared-types";
import { Router } from "express";
import { requireAuth, requirePermission } from "../../middlewares/index.js";
import * as controller from "./documents.controller.js";

export const documentsRouter = Router();

documentsRouter.use(requireAuth, requirePermission(AppModule.documents, AccessLevel.READ));

documentsRouter.get("/", (req, res, next) => { void controller.list(req, res).catch(next); });
documentsRouter.get("/:id", (req, res, next) => { void controller.get(req, res).catch(next); });
documentsRouter.post("/", requirePermission(AppModule.documents, AccessLevel.WRITE), (req, res, next) => { void controller.create(req, res).catch(next); });
documentsRouter.patch("/:id", requirePermission(AppModule.documents, AccessLevel.WRITE), (req, res, next) => { void controller.update(req, res).catch(next); });
documentsRouter.delete("/:id", requirePermission(AppModule.documents, AccessLevel.WRITE), (req, res, next) => { void controller.remove(req, res).catch(next); });

