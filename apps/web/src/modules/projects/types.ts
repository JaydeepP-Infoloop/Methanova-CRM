export interface BaseRecord {
  _id: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface PopulatedUser {
  _id: string;
  name: string;
  email?: string;
  role: string;
}

export interface ProjectMember {
  userId: PopulatedUser | string;
  addedAt?: string;
}

export interface ProjectLetterhead {
  source: "project" | "org" | "none";
  fileId: string | null;
  orgFileId: string | null;
  orgLegalName: string;
}

export interface ProjectSetup {
  mouSigned: boolean;
  projectManagerAssigned: boolean;
  letterheadReady: boolean;
  teamAssigned: boolean;
}

export interface ProjectRow extends BaseRecord {
  code: string;
  name: string;
  shortName?: string | null;
  description?: string | null;
  leadId: string;
  mouId: string;
  status: string;
  siteAddress?: string | null;
  capacityTpd?: number | null;
  feedstockBasis?: string | null;
  civilScope?: string | null;
  targetCommissioningDate?: string | null;
  projectManagerUserId?: PopulatedUser | string | null;
  members?: ProjectMember[];
  letterhead?: ProjectLetterhead;
  setup?: ProjectSetup;
}

export interface ProjectAuditRow {
  _id: string;
  action: string;
  at: string;
  actorId?: PopulatedUser | string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

export interface FeasibilitySurveyRow extends BaseRecord {
  projectId: string;
  version: number;
  findings?: string;
  statutoryNotes?: string;
}

export interface DprRow extends BaseRecord {
  projectId: string;
  version: number;
  summary?: string;
  capacityNm3?: number;
}

export function populatedName(value: PopulatedUser | string | null | undefined): string {
  if (!value) return "—";
  if (typeof value === "string") return value;
  return value.name;
}

export function populatedId(value: PopulatedUser | string | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value._id;
}
