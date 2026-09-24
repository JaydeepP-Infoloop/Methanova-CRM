import { AccessLevel, AppModule } from "@methanova/shared-types";
import { Router } from "express";
import { requireAuth, requirePermission } from "../../../middlewares/index.js";
import * as controller from "./dashboard.controller.js";

export const dashboardRouter = Router();

/**
 * Gated at `crm:READ`, the same check the Dashboard's existing KPI strip
 * already uses client-side — not `reports:READ`, which Liaison &
 * Compliance and Design/Engineering both hold without holding `crm:READ`
 * (see the permission matrix in PROJECT_CONTEXT.md §5) and would otherwise
 * let them fetch lead/MOU data through this endpoint even though the UI
 * never shows it to them. Client-side hiding is not access control on its
 * own (hard rule #7).
 */
dashboardRouter.use(requireAuth, requirePermission(AppModule.crm, AccessLevel.READ));

dashboardRouter.get("/", (req, res, next) => {
  void controller.get(req, res).catch(next);
});
