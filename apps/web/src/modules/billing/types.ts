export interface BaseRecord {
  _id: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface PaymentScheduleRow extends BaseRecord {
  projectId: string;
  mouId: string;
  lines: Array<{ description: string; amountPaise: number; dueOnMilestone?: string }>;
}

export interface InvoiceRow extends BaseRecord {
  projectId?: string;
  mouId?: string;
  paymentScheduleId?: string;
  number: string;
  kind: string;
  status: string;
  placeOfSupply: string;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  retentionPaise: number;
  advanceRecoveredPaise: number;
  totalPaise: number;
  /** Null on older/auto-created invoices — see `invoices.model.ts`. */
  dueDate?: string | null;
  clientName?: string | null;
  /** Total less live receipts, computed by the API. */
  outstandingPaise?: number;
  /** Derived by the API on every read — see derived.ts `invoiceAgeing()`. */
  isOverdue?: boolean;
  daysOverdue?: number;
  ageingBucket?: string | null;
}
