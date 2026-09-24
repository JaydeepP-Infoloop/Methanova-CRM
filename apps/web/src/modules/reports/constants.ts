import { AppModule } from "@methanova/shared-types";

export const REPORTS_MODULE = AppModule.reports;

export const REPORTS_NAV = [
  { path: "reports", label: "Report Snapshot" },
] as const;
