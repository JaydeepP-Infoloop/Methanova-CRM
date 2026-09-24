export interface BaseRecord {
  _id: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface LeadRow extends BaseRecord {
  code: string;
  organisationName: string;
  contactName: string;
  contactEmail?: string;
  siteLocation?: string;
  stage: string;
}

export interface PriceLine {
  description: string;
  amountPaise: number;
  hsnSac: string;
}

export interface PaymentMilestone {
  description: string;
  percentage: number;
  dueOnMilestone?: string;
}

export interface PaymentTermsTemplate {
  name: string;
  milestones: PaymentMilestone[];
}

export interface QuotationRow extends BaseRecord {
  leadId: string;
  revision: number;
  parentQuotationId?: string;
  rootQuotationId: string;
  revisionReason?: string;
  status: string;
  capacityTpd: number;
  feedstockBasis: string;
  expectedCbgTpd: number;
  priceLines: PriceLine[];
  scopeInclusions: string[];
  scopeExclusions: string[];
  paymentTermsTemplate: PaymentTermsTemplate;
  totalPaise: number;
  notes?: string;
}

export interface ActivityRow extends BaseRecord {
  parentType: string;
  parentId: string;
  sequenceNo: number;
  type: string;
  summary: string;
  outcome?: string | null;
  occurredAt: string;
}

export interface MouRow extends BaseRecord {
  code: string;
  leadId: string;
  mouDate: string;
  status: string;
  acceptedQuotationId: string;
  feePaise: number;
  contractValuePaise: number;
  feeAdjustable: boolean;
  civilScope: "METHANOVA" | "CLIENT";
  targetCommissioningDate: string;
  signedDocumentId?: string;
  supersedesMouId?: string;
  projectId?: string;
}
