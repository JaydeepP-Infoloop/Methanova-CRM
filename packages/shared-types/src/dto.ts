import type { Paise } from "./money.js";
import type { AgeingBucket } from "./derived.js";
import type {
  ExecutionScope,
  GstPlaceOfSupply,
  InvoiceKind,
  InvoiceStatus,
  LeadStage,
  LicenceBundle,
  LicenceStatus,
  MouStatus,
  ProjectStatus,
  QuotationStatus,
  ResponsibleParty,
  WorkPackageDelayReason,
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
  status: ProjectStatus;
  capacityTpd: number | null;
  feedstockBasis: string | null;
  feedstockTypeIds: Id[];
  civilScope: ResponsibleParty | null;
  /** Contract value copied from the signed MOU. Null on projects created before this field existed. */
  contractValuePaise: Paise | null;
  /** The MOU's date — set once at MOU signing and never overwritten. Slippage goes in `revisedTargetDate`. */
  targetCommissioningDate: string | null;
  revisedTargetDate: string | null;
  /** Stamped by the COMMISSIONING → HANDED_OVER transition. */
  actualCommissioningDate: string | null;
  projectManagerUserId: Id | null;
  siteEngineerUserId: Id | null;
  liaisonOfficerUserId: Id | null;
  /** Derived at read time: work-package completion weighted by `amountPaise`. Null when no work packages exist. */
  progressPct: number | null;
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
  authority: string;
  status: LicenceStatus;
  /** Copied from the licence type at MOU signing; editable per project. */
  scope: ResponsibleParty | null;
  assigneeUserId: Id | null;
  targetDate: string | null;
  /** Stamped by the SUBMITTED transition. */
  appliedDate: string | null;
  /** Both stamped by the GRANTED transition. */
  clearedDate: string | null;
  validFrom: string | null;
  validUntil: string | null;
  renewalLeadDays: number | null;
  /** Derived: `targetDate` passed without a `clearedDate`. */
  isOverdue: boolean;
  daysOverdue: number;
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
  projectId: Id;
  /** Snapshot of the client's name when the invoice was raised — see PROJECT_CONTEXT.md "Invoice client identity". */
  clientName: string | null;
  dueDate: string | null;
  /** Derived from `dueDate`; `ageingBucket` is null when the invoice is not an open receivable. */
  isOverdue: boolean;
  daysOverdue: number;
  ageingBucket: AgeingBucket | null;
}

export interface WorkPackageDto {
  id: Id;
  projectId: Id;
  name: string;
  sequence: number;
  status: WorkPackageStatus;
  amountPaise: Paise;
  plannedStart: string | null;
  plannedEnd: string | null;
  /** Stamped by the → IN_PROGRESS transition. */
  actualStart: string | null;
  /** Stamped by the → COMPLETED transition. */
  actualEnd: string | null;
  /** Mirrors the latest progress update; forced to 100 on COMPLETED. Not directly writable. */
  percentComplete: number;
  responsibleUserId: Id | null;
  executionScope: ExecutionScope | null;
  /** Set when the package is moved ON_HOLD — required on that move. */
  delayReason: WorkPackageDelayReason | null;
  /** Derived: past `plannedEnd` with `percentComplete` under 100. */
  isDelayed: boolean;
  daysDelayed: number;
}
