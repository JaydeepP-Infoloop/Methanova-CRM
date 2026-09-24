import { AccessLevel, AppModule } from "@methanova/shared-types";
import { Router } from "express";
import { requireAuth, requirePermission } from "../../../middlewares/index.js";
import * as controller from "./project.controller.js";

export const projectRouter = Router();

projectRouter.use(requireAuth, requirePermission(AppModule.projects, AccessLevel.READ));

projectRouter.get("/", (req, res, next) => {
  void controller.list(req, res).catch(next);
});
projectRouter.get("/:id/audit", (req, res, next) => {
  void controller.audit(req, res).catch(next);
});
projectRouter.get("/:id", (req, res, next) => {
  void controller.get(req, res).catch(next);
});
projectRouter.post("/", requirePermission(AppModule.projects, AccessLevel.WRITE), (req, res, next) => {
  void controller.create(req, res).catch(next);
});
projectRouter.patch("/:id", requirePermission(AppModule.projects, AccessLevel.FULL), (req, res, next) => {
  void controller.update(req, res).catch(next);
});
projectRouter.delete("/:id", requirePermission(AppModule.projects, AccessLevel.WRITE), (req, res, next) => {
  void controller.remove(req, res).catch(next);
});
projectRouter.post(
  "/:id/transition",
  requirePermission(AppModule.projects, AccessLevel.FULL),
  (req, res, next) => {
    void controller.transition(req, res).catch(next);
  },
);
projectRouter.put(
  "/:id/members",
  requirePermission(AppModule.projects, AccessLevel.FULL),
  (req, res, next) => {
    void controller.replaceMembers(req, res).catch(next);
  },
);
projectRouter.post(
  "/:id/letterhead",
  requirePermission(AppModule.projects, AccessLevel.FULL),
  (req, res, next) => {
    void controller.uploadLetterhead(req, res).catch(next);
  },
);
projectRouter.delete(
  "/:id/letterhead",
  requirePermission(AppModule.projects, AccessLevel.FULL),
  (req, res, next) => {
    void controller.inheritLetterhead(req, res).catch(next);
  },
);
projectRouter.post(
  "/:id/letterhead/reset",
  requirePermission(AppModule.projects, AccessLevel.FULL),
  (req, res, next) => {
    void controller.resetLetterhead(req, res).catch(next);
  },
);
