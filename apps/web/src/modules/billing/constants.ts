import { AppModule } from "@methanova/shared-types";

export const BILLING_MODULE = AppModule.billing;

export const BILLING_NAV = [
  { path: "payment-schedules", label: "Payment Schedule" },
  { path: "invoices", label: "Invoice" },
] as const;
