import { AppModule } from "@methanova/shared-types";

export const DOCUMENTS_MODULE = AppModule.documents;

export const DOCUMENTS_NAV = [
  { path: "documents", label: "Document Record" },
] as const;
