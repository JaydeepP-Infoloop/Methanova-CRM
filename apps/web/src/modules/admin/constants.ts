import { AppModule } from "@methanova/shared-types";

export const ADMIN_MODULE = AppModule.admin;

export const ADMIN_NAV = [
  { path: "users", label: "User" },
  { path: "roles", label: "Role Record" },
  { path: "master-data", label: "Master Data" },
] as const;
