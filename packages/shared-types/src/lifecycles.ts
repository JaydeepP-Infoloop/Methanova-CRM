export const LeadStage = {
  ENQUIRY: "ENQUIRY",
  QUALIFICATION: "QUALIFICATION",
  SITE_VISIT: "SITE_VISIT",
  QUOTATION: "QUOTATION",
  NEGOTIATION: "NEGOTIATION",
  MOU: "MOU",
  WON: "WON",
  LOST: "LOST",
} as const;
export type LeadStage = (typeof LeadStage)[keyof typeof LeadStage];
export const LEAD_STAGE_ORDER: LeadStage[] = [
  LeadStage.ENQUIRY,
  LeadStage.QUALIFICATION,
  LeadStage.SITE_VISIT,
  LeadStage.QUOTATION,
  LeadStage.NEGOTIATION,
  LeadStage.MOU,
  LeadStage.WON,
  LeadStage.LOST,
];

export const LicenceStatus = {
  NOT_STARTED: "NOT_STARTED",
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  QUERY_PENDING: "QUERY_PENDING",
  AUTHORITY_VISIT: "AUTHORITY_VISIT",
  GRANTED: "GRANTED",
  REJECTED: "REJECTED",
  EXPIRED: "EXPIRED",
} as const;
export type LicenceStatus = (typeof LicenceStatus)[keyof typeof LicenceStatus];
export const LICENCE_STATUS_ORDER: LicenceStatus[] = [
  LicenceStatus.NOT_STARTED,
  LicenceStatus.DRAFT,
  LicenceStatus.SUBMITTED,
  LicenceStatus.QUERY_PENDING,
  LicenceStatus.AUTHORITY_VISIT,
  LicenceStatus.GRANTED,
  LicenceStatus.REJECTED,
  LicenceStatus.EXPIRED,
];

export const InvoiceStatus = {
  DRAFT: "DRAFT",
  PROFORMA_ISSUED: "PROFORMA_ISSUED",
  TAX_INVOICE_ISSUED: "TAX_INVOICE_ISSUED",
  PARTIALLY_PAID: "PARTIALLY_PAID",
  PAID: "PAID",
  OVERDUE: "OVERDUE",
  CANCELLED: "CANCELLED",
  CREDITED: "CREDITED",
} as const;
export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];
export const INVOICE_STATUS_ORDER: InvoiceStatus[] = [
  InvoiceStatus.DRAFT,
  InvoiceStatus.PROFORMA_ISSUED,
  InvoiceStatus.TAX_INVOICE_ISSUED,
  InvoiceStatus.PARTIALLY_PAID,
  InvoiceStatus.PAID,
  InvoiceStatus.OVERDUE,
  InvoiceStatus.CANCELLED,
  InvoiceStatus.CREDITED,
];

export const WorkPackageStatus = {
  PLANNED: "PLANNED",
  READY: "READY",
  IN_PROGRESS: "IN_PROGRESS",
  ON_HOLD: "ON_HOLD",
  COMPLETED: "COMPLETED",
  HANDED_OVER: "HANDED_OVER",
} as const;
export type WorkPackageStatus = (typeof WorkPackageStatus)[keyof typeof WorkPackageStatus];
export const WORK_PACKAGE_STATUS_ORDER: WorkPackageStatus[] = [
  WorkPackageStatus.PLANNED,
  WorkPackageStatus.READY,
  WorkPackageStatus.IN_PROGRESS,
  WorkPackageStatus.ON_HOLD,
  WorkPackageStatus.COMPLETED,
  WorkPackageStatus.HANDED_OVER,
];

export const QuotationStatus = {
  DRAFT: "DRAFT",
  PENDING_APPROVAL: "PENDING_APPROVAL",
  APPROVED: "APPROVED",
  SENT: "SENT",
  UNDER_NEGOTIATION: "UNDER_NEGOTIATION",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
  /** Set automatically when a later revision is created against this one — never a manual move. */
  SUPERSEDED: "SUPERSEDED",
} as const;
export type QuotationStatus = (typeof QuotationStatus)[keyof typeof QuotationStatus];
export const QUOTATION_STATUS_ORDER: QuotationStatus[] = [
  QuotationStatus.DRAFT,
  QuotationStatus.PENDING_APPROVAL,
  QuotationStatus.APPROVED,
  QuotationStatus.SENT,
  QuotationStatus.UNDER_NEGOTIATION,
  QuotationStatus.ACCEPTED,
  QuotationStatus.REJECTED,
  QuotationStatus.SUPERSEDED,
];

export const MouStatus = {
  DRAFT: "DRAFT",
  SENT: "SENT",
  SIGNED: "SIGNED",
  CANCELLED: "CANCELLED",
} as const;
export type MouStatus = (typeof MouStatus)[keyof typeof MouStatus];

/**
 * Who is responsible for a piece of scope — a licence type's own scope, and
 * an MOU's civil-works scope. One enum for both rather than two identical
 * ones: "who does this, us or the client" is the same question in either
 * context.
 */
export const ResponsibleParty = {
  METHANOVA: "METHANOVA",
  CLIENT: "CLIENT",
} as const;
export type ResponsibleParty = (typeof ResponsibleParty)[keyof typeof ResponsibleParty];

/**
 * Structural drawings are Methanova's scope regardless of who holds general
 * civil-works responsibility on a given deal — this is a fixed fact about how
 * Methanova operates, not a per-MOU choice, so it is a constant rather than a
 * field anyone can set. `Mou.civilScope` still varies per deal; this does not.
 */
export const STRUCTURAL_DRAWINGS_SCOPE: ResponsibleParty = ResponsibleParty.METHANOVA;

export const ProjectStatus = {
  ACTIVE: "ACTIVE",
  ON_HOLD: "ON_HOLD",
  COMMISSIONING: "COMMISSIONING",
  HANDED_OVER: "HANDED_OVER",
  OM: "OM",
} as const;
export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];
export const PROJECT_STATUS_ORDER: ProjectStatus[] = [
  ProjectStatus.ACTIVE,
  ProjectStatus.ON_HOLD,
  ProjectStatus.COMMISSIONING,
  ProjectStatus.HANDED_OVER,
  ProjectStatus.OM,
];

export const StoredFileKind = {
  ORG_LOGO: "ORG_LOGO",
  PROJECT_LETTERHEAD: "PROJECT_LETTERHEAD",
  DOCUMENT: "DOCUMENT",
} as const;
export type StoredFileKind = (typeof StoredFileKind)[keyof typeof StoredFileKind];

export const LicenceBundle = {
  PRE_CTE: "PRE_CTE",
  CTE: "CTE",
  CTO: "CTO",
} as const;
export type LicenceBundle = (typeof LicenceBundle)[keyof typeof LicenceBundle];

export const InvoiceKind = {
  PROFORMA: "PROFORMA",
  TAX_INVOICE: "TAX_INVOICE",
  CREDIT_NOTE: "CREDIT_NOTE",
} as const;
export type InvoiceKind = (typeof InvoiceKind)[keyof typeof InvoiceKind];

export const GstPlaceOfSupply = {
  INTRA_STATE: "INTRA_STATE",
  INTER_STATE: "INTER_STATE",
} as const;
export type GstPlaceOfSupply = (typeof GstPlaceOfSupply)[keyof typeof GstPlaceOfSupply];

export const DocumentKind = {
  QUOTATION: "QUOTATION",
  MOU: "MOU",
  DPR: "DPR",
  LICENCE: "LICENCE",
  NOC: "NOC",
  INVOICE: "INVOICE",
  SITE_PHOTO: "SITE_PHOTO",
  OTHER: "OTHER",
} as const;
export type DocumentKind = (typeof DocumentKind)[keyof typeof DocumentKind];

export const CounterKey = {
  INV: "INV",
  PF: "PF",
  CN: "CN",
  LEAD: "LEAD",
  PROJECT: "PROJECT",
  MOU: "MOU",
} as const;
export type CounterKey = (typeof CounterKey)[keyof typeof CounterKey];
