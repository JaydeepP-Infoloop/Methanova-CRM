import { Role } from "./roles.js";

export const AppModule = {
  crm: "crm",
  projects: "projects",
  compliance: "compliance",
  documents: "documents",
  schedule: "schedule",
  billing: "billing",
  receivables: "receivables",
  reports: "reports",
  admin: "admin",
} as const;
export type AppModule = (typeof AppModule)[keyof typeof AppModule];

export const AccessLevel = {
  NONE: "NONE",
  READ: "READ",
  WRITE: "WRITE",
  FULL: "FULL",
} as const;
export type AccessLevel = (typeof AccessLevel)[keyof typeof AccessLevel];

export type PermissionMatrix = Record<Role, Record<AppModule, AccessLevel>>;

const none: Record<AppModule, AccessLevel> = {
  crm: AccessLevel.NONE,
  projects: AccessLevel.NONE,
  compliance: AccessLevel.NONE,
  documents: AccessLevel.NONE,
  schedule: AccessLevel.NONE,
  billing: AccessLevel.NONE,
  receivables: AccessLevel.NONE,
  reports: AccessLevel.NONE,
  admin: AccessLevel.NONE,
};

function withAccess(overrides: Partial<Record<AppModule, AccessLevel>>): Record<AppModule, AccessLevel> {
  return { ...none, ...overrides };
}

export const PERMISSION_MATRIX: PermissionMatrix = {
  [Role.DIRECTOR]: withAccess({
    crm: AccessLevel.FULL,
    projects: AccessLevel.FULL,
    compliance: AccessLevel.FULL,
    documents: AccessLevel.FULL,
    schedule: AccessLevel.FULL,
    billing: AccessLevel.FULL,
    receivables: AccessLevel.FULL,
    reports: AccessLevel.FULL,
    admin: AccessLevel.FULL,
  }),
  [Role.SALES_HEAD_BDE]: withAccess({
    crm: AccessLevel.FULL,
    projects: AccessLevel.READ,
    documents: AccessLevel.WRITE,
    reports: AccessLevel.READ,
  }),
  [Role.LIAISON_COMPLIANCE_OFFICER]: withAccess({
    projects: AccessLevel.READ,
    compliance: AccessLevel.FULL,
    documents: AccessLevel.WRITE,
    reports: AccessLevel.READ,
  }),
  [Role.DESIGN_ENGINEERING_LEAD]: withAccess({
    projects: AccessLevel.WRITE,
    documents: AccessLevel.WRITE,
    schedule: AccessLevel.READ,
    reports: AccessLevel.READ,
  }),
  [Role.PROJECT_MANAGER]: withAccess({
    crm: AccessLevel.READ,
    projects: AccessLevel.FULL,
    compliance: AccessLevel.READ,
    documents: AccessLevel.WRITE,
    schedule: AccessLevel.FULL,
    billing: AccessLevel.READ,
    reports: AccessLevel.READ,
  }),
  [Role.SITE_ENGINEER]: withAccess({
    projects: AccessLevel.READ,
    documents: AccessLevel.WRITE,
    schedule: AccessLevel.WRITE,
  }),
  [Role.ACCOUNTS]: withAccess({
    crm: AccessLevel.READ,
    projects: AccessLevel.READ,
    billing: AccessLevel.FULL,
    receivables: AccessLevel.FULL,
    reports: AccessLevel.READ,
  }),
  [Role.CLIENT]: withAccess({
    documents: AccessLevel.READ,
    schedule: AccessLevel.READ,
    billing: AccessLevel.READ,
  }),
};

export function canAccess(role: Role, module: AppModule, needed: AccessLevel): boolean {
  const rank: Record<AccessLevel, number> = {
    NONE: 0,
    READ: 1,
    WRITE: 2,
    FULL: 3,
  };
  return rank[PERMISSION_MATRIX[role][module]] >= rank[needed];
}
