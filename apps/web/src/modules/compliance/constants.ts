import { AppModule } from "@methanova/shared-types";

export const COMPLIANCE_MODULE = AppModule.compliance;

export const COMPLIANCE_NAV = [
  { path: "licences", label: "Licence" },
] as const;
