import { AppModule } from "@methanova/shared-types";

export const RECEIVABLES_MODULE = AppModule.receivables;

export const RECEIVABLES_NAV = [
  { path: "receipts", label: "Receipt" },
] as const;
