import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { config } from "./config/index.js";
import { authRouter } from "./core/auth/auth.routes.js";
import { errorHandler, requestLogger, requireAuth } from "./middlewares/index.js";
import { usersRouter } from "./modules/admin/users/users.routes.js";
import { rolesRouter } from "./modules/admin/roles/roles.routes.js";
import { masterDataRouter } from "./modules/admin/master-data/master-data.routes.js";
import { geographyRouter } from "./modules/admin/master-data/geography.routes.js";
import { referenceAdminRouter } from "./modules/admin/master-data/reference.routes.js";
import { invoicesRouter } from "./modules/billing/invoices/invoices.routes.js";
import { paymentSchedulesRouter } from "./modules/billing/payment-schedules/payment-schedules.routes.js";
import { licencesRouter } from "./modules/compliance/licences/licences.routes.js";
import { activitiesRouter } from "./modules/crm/activities/activities.routes.js";
import { leadsRouter } from "./modules/crm/leads/leads.routes.js";
import { mouRouter } from "./modules/crm/mou/mou.routes.js";
import { myDayRouter } from "./modules/crm/my-day/my-day.routes.js";
import { quotationsRouter } from "./modules/crm/quotations/quotations.routes.js";
import { documentsRouter } from "./modules/documents/documents.routes.js";
import { filesRouter } from "./modules/files/files.routes.js";
import { notificationsRouter } from "./modules/notifications/notifications.routes.js";
import { drpRouter } from "./modules/projects/drp/drp.routes.js";
import { feasibilityRouter } from "./modules/projects/feasibility/feasibility.routes.js";
import { projectRouter } from "./modules/projects/project/project.routes.js";
import { receiptsRouter } from "./modules/receivables/receipts/receipts.routes.js";
import { reportsRouter } from "./modules/reports/reports.routes.js";
import { progressUpdatesRouter } from "./modules/schedule/progress-updates/progress-updates.routes.js";
import { workPackagesRouter } from "./modules/schedule/work-packages/work-packages.routes.js";

export function createApp() {
  const app = express();
  app.use(requestLogger);
  app.use(cors({ origin: config.webOrigin, credentials: true }));
  app.use(cookieParser());
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "methanova-api" });
  });

  app.use("/auth", authRouter);

  const api = express.Router();
  api.use(requireAuth);
  api.use("/crm/leads", leadsRouter);
  api.use("/crm/quotations", quotationsRouter);
  api.use("/crm/activities", activitiesRouter);
  api.use("/crm/mou", mouRouter);
  api.use("/crm/my-day", myDayRouter);
  api.use("/projects/feasibility", feasibilityRouter);
  api.use("/projects/dpr", drpRouter);
  api.use("/projects", projectRouter);
  api.use("/compliance/licences", licencesRouter);
  api.use("/documents", documentsRouter);
  api.use("/files", filesRouter);
  api.use("/schedule/work-packages", workPackagesRouter);
  api.use("/schedule/progress-updates", progressUpdatesRouter);
  api.use("/billing/payment-schedules", paymentSchedulesRouter);
  api.use("/billing/invoices", invoicesRouter);
  api.use("/receivables/receipts", receiptsRouter);
  api.use("/notifications", notificationsRouter);
  api.use("/reports", reportsRouter);
  api.use("/admin/users", usersRouter);
  api.use("/admin/roles", rolesRouter);
  api.use("/admin/master-data", masterDataRouter);
  // Reference data the CRM intake form reads (geography, lead sources, feedstock types).
  api.use("/masters", geographyRouter);
  // Admin CRUD over that same reference data — gated at admin/WRITE, not crm/READ.
  api.use("/admin/reference", referenceAdminRouter);

  app.use("/api", api);
  app.use(errorHandler);
  return app;
}
