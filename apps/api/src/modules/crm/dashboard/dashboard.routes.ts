import { Role } from "@methanova/shared-types";
import { Router } from "express";
import { requireAuth } from "../../../middlewares/index.js";
import { HttpError } from "../../../utils/http.js";
import * as controller from "./dashboard.controller.js";

export const dashboardRouter = Router();

/**
 * Authentication only at the route: each section is gated by its own
 * module's `:READ` inside `getDashboard()`, so a Liaison Officer (compliance,
 * no crm) gets Compliance Health without being able to fetch lead data here.
 *
 * The CLIENT role is refused outright. Its schedule/billing READ is meant for
 * its own project in the (deferred) client portal, but every section here
 * aggregates across all clients — client-scoped figures are that portal's
 * job, not a filtered version of this endpoint.
 */
dashboardRouter.use(requireAuth, (req, _res, next) => {
  next(req.user?.role === Role.CLIENT ? new HttpError(403, "The dashboard is not available to client accounts") : undefined);
});

dashboardRouter.get("/", (req, res, next) => {
  void controller.get(req, res).catch(next);
});
