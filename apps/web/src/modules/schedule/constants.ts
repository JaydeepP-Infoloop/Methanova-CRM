import { AppModule } from "@methanova/shared-types";

export const SCHEDULE_MODULE = AppModule.schedule;

export const SCHEDULE_NAV = [
  { path: "work-packages", label: "Work Package" },
  { path: "progress-updates", label: "Progress Update" },
] as const;
