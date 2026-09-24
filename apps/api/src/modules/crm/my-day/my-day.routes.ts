import { AccessLevel, AppModule } from "@methanova/shared-types";
import { Router } from "express";
import { requireAuth, requirePermission } from "../../../middlewares/index.js";
import * as controller from "./my-day.controller.js";

export const myDayRouter = Router();

// Gated at crm/READ like the rest of CRM — every role that can see a lead can
// see their own queue. Team scope narrows further to crm/FULL inside the
// controller, since that toggle is only meaningful for someone who can also
// see leads other than their own.
myDayRouter.use(requireAuth, requirePermission(AppModule.crm, AccessLevel.READ));

myDayRouter.get("/", (req, res, next) => {
  void controller.get(req, res).catch(next);
});
