import { AccessLevel, AppModule } from "@methanova/shared-types";
import { Router } from "express";
import { requireAuth, requirePermission } from "../../middlewares/index.js";
import * as controller from "./files.controller.js";

export const filesRouter = Router();

filesRouter.use(requireAuth);

filesRouter.get("/org-letterhead", (req, res, next) => {
  void controller.orgLetterhead(req, res).catch(next);
});
filesRouter.patch(
  "/org-letterhead",
  requirePermission(AppModule.admin, AccessLevel.FULL),
  (req, res, next) => {
    void controller.patchOrgLetterhead(req, res).catch(next);
  },
);
filesRouter.post("/", (req, res, next) => {
  void controller.upload(req, res).catch(next);
});
filesRouter.get("/:id/content", (req, res, next) => {
  void controller.getContent(req, res).catch(next);
});
filesRouter.get("/:id", (req, res, next) => {
  void controller.getMeta(req, res).catch(next);
});
