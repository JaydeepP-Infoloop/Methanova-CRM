import { AccessLevel, AppModule } from "@methanova/shared-types";
import { Router } from "express";
import { requireAuth, requirePermission } from "../../../middlewares/index.js";
import * as activities from "../activities/activities.controller.js";
import * as controller from "./leads.controller.js";

export const leadsRouter = Router();

leadsRouter.use(requireAuth, requirePermission(AppModule.crm, AccessLevel.READ));

// Declared before "/:id" so they are not swallowed by the id route.
leadsRouter.get("/summary", (req, res, next) => {
  void controller.summary(req, res).catch(next);
});
leadsRouter.get("/duplicates", (req, res, next) => {
  void controller.duplicates(req, res).catch(next);
});
// Two thin aggregations for the inbox's own charts. Namespaced under
// /reports so the full CRM Reports feature has somewhere obvious to grow,
// but deliberately not the start of it — see MODULE_MAP.md.
leadsRouter.get("/reports/source-mix", (req, res, next) => {
  void controller.sourceMix(req, res).catch(next);
});
leadsRouter.get("/reports/criteria-tally", (req, res, next) => {
  void controller.criteriaTally(req, res).catch(next);
});
// A POST that only reads: it takes an array of ids, which does not belong in a
// query string, and it creates nothing.
leadsRouter.post("/expected-cbg", (req, res, next) => {
  void controller.expectedCbg(req, res).catch(next);
});

leadsRouter.get("/", (req, res, next) => {
  void controller.list(req, res).catch(next);
});
leadsRouter.get("/:id", (req, res, next) => {
  void controller.get(req, res).catch(next);
});
leadsRouter.post("/", requirePermission(AppModule.crm, AccessLevel.WRITE), (req, res, next) => {
  void controller.create(req, res).catch(next);
});
leadsRouter.patch("/:id", requirePermission(AppModule.crm, AccessLevel.WRITE), (req, res, next) => {
  void controller.update(req, res).catch(next);
});
leadsRouter.delete("/:id", requirePermission(AppModule.crm, AccessLevel.WRITE), (req, res, next) => {
  void controller.remove(req, res).catch(next);
});
// Contacts are replaced as a whole array so the one-primary rule can be
// re-validated against the finished set — see updateContactsSchema.
leadsRouter.patch("/:id/contacts", requirePermission(AppModule.crm, AccessLevel.WRITE), (req, res, next) => {
  void controller.updateContacts(req, res).catch(next);
});
leadsRouter.post("/:id/transition", requirePermission(AppModule.crm, AccessLevel.WRITE), (req, res, next) => {
  void controller.transition(req, res).catch(next);
});

// Parking is orthogonal to the stage, so it gets its own pair of routes rather
// than a transition target. Marking a lead dead is not here at all: that is
// the LOST transition above.
leadsRouter.post("/:id/park", requirePermission(AppModule.crm, AccessLevel.WRITE), (req, res, next) => {
  void controller.park(req, res).catch(next);
});
leadsRouter.post("/:id/unpark", requirePermission(AppModule.crm, AccessLevel.WRITE), (req, res, next) => {
  void controller.unpark(req, res).catch(next);
});

leadsRouter.post("/:id/qualify", requirePermission(AppModule.crm, AccessLevel.WRITE), (req, res, next) => {
  void controller.qualify(req, res).catch(next);
});

// An activity only exists in the context of its parent, so it is created here
// rather than on a top-level /activities route.
leadsRouter.get("/:id/activities", (req, res, next) => {
  void activities.listForLead(req, res).catch(next);
});
leadsRouter.post("/:id/activities", requirePermission(AppModule.crm, AccessLevel.WRITE), (req, res, next) => {
  void activities.createForLead(req, res).catch(next);
});
leadsRouter.post("/:id/assign", requirePermission(AppModule.crm, AccessLevel.WRITE), (req, res, next) => {
  void activities.assign(req, res).catch(next);
});
