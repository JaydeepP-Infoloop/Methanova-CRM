import type { Paise } from "./money.js";
import type {
  GstPlaceOfSupply,
  InvoiceKind,
  InvoiceStatus,
  LeadStage,
  LicenceBundle,
  LicenceStatus,
  MouStatus,
  QuotationStatus,
  ResponsibleParty,
  WorkPackageStatus,
} from "./lifecycles.js";
import type { Role } from "./roles.js";

export type Id = string;

export interface UserDto {
  id: Id;
  email: string;
  name: string;
  role: Role;
}

export interface LeadDto {
  id: Id;
  code: string;
  organisationName: string;
  contactName: string;
  stage: LeadStage;
}

export interface PriceLineDto {
  description: string;
  amountPaise: Paise;
  hsnSac: string;
}

export interface PaymentMilestoneDto {
  description: string;
  /** Must sum to 100 across the template — validated on the quotation, not per line. */
  percentage: number;
  dueOnMilestone?: string;
}

export interface PaymentTermsTemplateDto {
  name: string;
  milestones: PaymentMilestoneDto[];
}

export interface QuotationDto {
  id: Id;
  leadId: Id;
  revision: number;
  parentQuotationId?: Id;
  /** Shared across every revision in a lineage — the family a revision-comparison query walks. */
  rootQuotationId: Id;
  /** Required on every revision after the first; absent on revision 1. */
  revisionReason?: string;
  status: QuotationStatus;
  capacityTpd: number;
  feedstockBasis: string;
  expectedCbgTpd: number;
  priceLines: PriceLineDto[];
  scopeInclusions: string[];
  scopeExclusions: string[];
  paymentTermsTemplate: PaymentTermsTemplateDto;
  totalPaise: Paise;
  notes?: string;
}

export interface MouDto {
  id: Id;
  leadId: Id;
  /** The MOU number — allocated from the atomic counter, same as a lead or project code. */
  code: string;
  mouDate: string;
  status: MouStatus;
  /** The quotation whose technical and commercial basis this MOU locks in. */
  acceptedQuotationId: Id;
  feePaise: Paise;
  contractValuePaise: Paise;
  /** Whether the fee is adjusted against the first bill, or retained separately. */
  feeAdjustable: boolean;
  civilScope: ResponsibleParty;
  targetCommissioningDate: string;
  signedDocumentId?: Id;
  /** Set when this MOU renegotiates a deal that was already signed — the prior document is never mutated. */
  supersedesMouId?: Id;
  projectId?: Id;
}

export interface ProjectDto {
  id: Id;
  code: string;
  leadId: Id;
  mouId: Id;
  name: string;
  siteAddress?: string;
  stateId?: Id;
  districtId?: Id;
  talukaId?: Id;
  villageId?: Id;
  capacityTpd: number;
  feedstockBasis: string;
  civilScope: ResponsibleParty;
  targetCommissioningDate: string;
}

export interface LicenceTypeDto {
  id: Id;
  key: string;
  label: string;
  authority: string;
  bundle: LicenceBundle;
  scope: ResponsibleParty;
  expectedVisitCount: number;
  sortOrder: number;
}

export interface LicenceDto {
  id: Id;
  projectId: Id;
  licenceTypeId: Id;
  bundle: LicenceBundle;
  status: LicenceStatus;
}

export interface InvoiceDto {
  id: Id;
  number: string;
  kind: InvoiceKind;
  status: InvoiceStatus;
  placeOfSupply: GstPlaceOfSupply;
  taxablePaise: Paise;
  cgstPaise: Paise;
  sgstPaise: Paise;
  igstPaise: Paise;
  retentionPaise: Paise;
  advanceRecoveredPaise: Paise;
  totalPaise: Paise;
}

export interface WorkPackageDto {
  id: Id;
  projectId: Id;
  name: string;
  status: WorkPackageStatus;
}
