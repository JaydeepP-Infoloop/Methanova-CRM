import {
  InvoiceStatus,
  LeadStage,
  LicenceStatus,
  MouStatus,
  ProjectStatus,
  QuotationStatus,
  WorkPackageStatus,
} from "./lifecycles.js";

export type StatefulEntity =
  | "lead"
  | "licence"
  | "invoice"
  | "workPackage"
  | "mou"
  | "quotation"
  | "project";

type TransitionMap = Record<string, readonly string[]>;

/**
 * The single definition of which status moves are legal. It lives in
 * shared-types rather than the API because both sides need it and they must
 * never disagree: the server enforces it (assertTransition throws 409) and
 * the client uses it to avoid offering moves that would be rejected. A second
 * copy anywhere is a bug waiting to happen.
 */
export const TRANSITION_MAP: Record<StatefulEntity, TransitionMap> = {
  lead: {
    [LeadStage.ENQUIRY]: [LeadStage.QUALIFICATION, LeadStage.LOST],
    [LeadStage.QUALIFICATION]: [LeadStage.SITE_VISIT, LeadStage.LOST],
    [LeadStage.SITE_VISIT]: [LeadStage.QUOTATION, LeadStage.LOST],
    [LeadStage.QUOTATION]: [LeadStage.NEGOTIATION, LeadStage.LOST],
    [LeadStage.NEGOTIATION]: [LeadStage.MOU, LeadStage.LOST],
    [LeadStage.MOU]: [LeadStage.WON, LeadStage.LOST],
    [LeadStage.WON]: [],
    [LeadStage.LOST]: [],
  },
  licence: {
    [LicenceStatus.NOT_STARTED]: [LicenceStatus.DRAFT],
    [LicenceStatus.DRAFT]: [LicenceStatus.SUBMITTED],
    [LicenceStatus.SUBMITTED]: [
      LicenceStatus.QUERY_PENDING,
      LicenceStatus.AUTHORITY_VISIT,
      LicenceStatus.GRANTED,
      LicenceStatus.REJECTED,
    ],
    [LicenceStatus.QUERY_PENDING]: [LicenceStatus.SUBMITTED, LicenceStatus.AUTHORITY_VISIT],
    [LicenceStatus.AUTHORITY_VISIT]: [
      LicenceStatus.GRANTED,
      LicenceStatus.REJECTED,
      LicenceStatus.QUERY_PENDING,
    ],
    [LicenceStatus.GRANTED]: [LicenceStatus.EXPIRED],
    [LicenceStatus.REJECTED]: [],
    [LicenceStatus.EXPIRED]: [LicenceStatus.DRAFT],
  },
  invoice: {
    [InvoiceStatus.DRAFT]: [
      InvoiceStatus.PROFORMA_ISSUED,
      InvoiceStatus.TAX_INVOICE_ISSUED,
      InvoiceStatus.CANCELLED,
    ],
    [InvoiceStatus.PROFORMA_ISSUED]: [
      InvoiceStatus.TAX_INVOICE_ISSUED,
      InvoiceStatus.CANCELLED,
      InvoiceStatus.OVERDUE,
    ],
    [InvoiceStatus.TAX_INVOICE_ISSUED]: [
      InvoiceStatus.PARTIALLY_PAID,
      InvoiceStatus.PAID,
      InvoiceStatus.OVERDUE,
      InvoiceStatus.CREDITED,
      InvoiceStatus.CANCELLED,
    ],
    [InvoiceStatus.PARTIALLY_PAID]: [
      InvoiceStatus.PAID,
      InvoiceStatus.OVERDUE,
      InvoiceStatus.CREDITED,
    ],
    [InvoiceStatus.PAID]: [InvoiceStatus.CREDITED],
    [InvoiceStatus.OVERDUE]: [
      InvoiceStatus.PARTIALLY_PAID,
      InvoiceStatus.PAID,
      InvoiceStatus.CREDITED,
      InvoiceStatus.CANCELLED,
    ],
    [InvoiceStatus.CANCELLED]: [],
    [InvoiceStatus.CREDITED]: [],
  },
  workPackage: {
    [WorkPackageStatus.PLANNED]: [WorkPackageStatus.READY, WorkPackageStatus.ON_HOLD],
    [WorkPackageStatus.READY]: [WorkPackageStatus.IN_PROGRESS, WorkPackageStatus.ON_HOLD],
    [WorkPackageStatus.IN_PROGRESS]: [WorkPackageStatus.ON_HOLD, WorkPackageStatus.COMPLETED],
    [WorkPackageStatus.ON_HOLD]: [WorkPackageStatus.READY, WorkPackageStatus.IN_PROGRESS],
    [WorkPackageStatus.COMPLETED]: [WorkPackageStatus.HANDED_OVER],
    [WorkPackageStatus.HANDED_OVER]: [],
  },
  mou: {
    [MouStatus.DRAFT]: [MouStatus.SENT, MouStatus.CANCELLED],
    [MouStatus.SENT]: [MouStatus.SIGNED, MouStatus.CANCELLED],
    [MouStatus.SIGNED]: [],
    [MouStatus.CANCELLED]: [],
  },
  // SUPERSEDED is reachable from every non-terminal state but is never a
  // manually-offered move — the service sets it as a side effect of creating
  // a later revision (createQuotation), the same way a revision itself is
  // never something the transition endpoint grants.
  quotation: {
    [QuotationStatus.DRAFT]: [QuotationStatus.PENDING_APPROVAL, QuotationStatus.SUPERSEDED],
    [QuotationStatus.PENDING_APPROVAL]: [
      QuotationStatus.APPROVED,
      QuotationStatus.DRAFT,
      QuotationStatus.SUPERSEDED,
    ],
    [QuotationStatus.APPROVED]: [QuotationStatus.SENT, QuotationStatus.SUPERSEDED],
    [QuotationStatus.SENT]: [
      QuotationStatus.UNDER_NEGOTIATION,
      QuotationStatus.ACCEPTED,
      QuotationStatus.REJECTED,
      QuotationStatus.SUPERSEDED,
    ],
    [QuotationStatus.UNDER_NEGOTIATION]: [
      QuotationStatus.SENT,
      QuotationStatus.ACCEPTED,
      QuotationStatus.REJECTED,
      QuotationStatus.SUPERSEDED,
    ],
    [QuotationStatus.ACCEPTED]: [],
    [QuotationStatus.REJECTED]: [],
    [QuotationStatus.SUPERSEDED]: [],
  },
  project: {
    [ProjectStatus.ACTIVE]: [ProjectStatus.ON_HOLD, ProjectStatus.COMMISSIONING],
    [ProjectStatus.ON_HOLD]: [ProjectStatus.ACTIVE],
    [ProjectStatus.COMMISSIONING]: [ProjectStatus.HANDED_OVER, ProjectStatus.ON_HOLD],
    [ProjectStatus.HANDED_OVER]: [ProjectStatus.OM],
    [ProjectStatus.OM]: [],
  },
};

export function nextStates(entity: StatefulEntity, from: string): readonly string[] {
  return TRANSITION_MAP[entity][from] ?? [];
}

export function canTransition(entity: StatefulEntity, from: string, to: string): boolean {
  return nextStates(entity, from).includes(to);
}
