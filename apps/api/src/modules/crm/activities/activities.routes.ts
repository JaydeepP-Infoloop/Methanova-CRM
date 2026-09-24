import { AccessLevel, AppModule } from "@methanova/shared-types";
import { Router } from "express";
import { requireAuth, requirePermission } from "../../../middlewares/index.js";
import * as controller from "./activities.controller.js";

/**
 * Flat activity routes. The ones that matter operationally are nested under a
 * lead (`/crm/leads/:id/activities`) and declared in leads.routes.ts, because
 * an activity is only ever created in the context of its parent.
 */
export const activitiesRouter = Router();

activitiesRouter.use(requireAuth, requirePermission(AppModule.crm, AccessLevel.READ));

activitiesRouter.get("/", (req, res, next) => {
  void controller.list(req, res).catch(next);
});
activitiesRouter.get("/:id", (req, res, next) => {
  void controller.get(req, res).catch(next);
});
