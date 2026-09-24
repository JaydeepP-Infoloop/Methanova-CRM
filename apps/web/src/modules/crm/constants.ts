import { AppModule } from "@methanova/shared-types";

export const CRM_MODULE = AppModule.crm;

export const CRM_NAV = [
  { path: "leads", label: "Lead" },
  { path: "quotations", label: "Quotation" },
  { path: "activities", label: "Activity" },
  { path: "mou", label: "Mou" },
] as const;
