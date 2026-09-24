import { AppModule } from "@methanova/shared-types";

export const PROJECTS_MODULE = AppModule.projects;

export const PROJECTS_NAV = [
  { path: "project", label: "Project" },
  { path: "feasibility", label: "Feasibility Survey" },
  { path: "drp", label: "Dpr" },
] as const;
