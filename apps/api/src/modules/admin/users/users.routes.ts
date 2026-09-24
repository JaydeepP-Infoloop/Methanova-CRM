import { AccessLevel, AppModule } from "@methanova/shared-types";
import { Router } from "express";
import { requireAuth, requirePermission } from "../../../middlewares/index.js";
import * as controller from "./users.controller.js";

export const usersRouter = Router();

usersRouter.use(requireAuth, requirePermission(AppModule.admin, AccessLevel.READ));

usersRouter.get("/", (req, res, next) => { void controller.list(req, res).catch(next); });
usersRouter.get("/:id", (req, res, next) => { void controller.get(req, res).catch(next); });
usersRouter.post("/", requirePermission(AppModule.admin, AccessLevel.WRITE), (req, res, next) => { void controller.create(req, res).catch(next); });
usersRouter.patch("/:id", requirePermission(AppModule.admin, AccessLevel.WRITE), (req, res, next) => { void controller.update(req, res).catch(next); });
usersRouter.delete("/:id", requirePermission(AppModule.admin, AccessLevel.WRITE), (req, res, next) => { void controller.remove(req, res).catch(next); });

