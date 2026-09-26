export interface BaseRecord {
  _id: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface LicenceRow extends BaseRecord {
  projectId: string;
  bundle: string;
  authority: string;
  status: string;
  visits: Array<{ at: string; notes?: string; officer?: string }>;
  queries: Array<{ at: string; question: string; response?: string; status?: string }>;
  /** Defaulted from the MOU's own `targetCommissioningDate` at creation — see `signMou()`. */
  targetDate?: string | null;
  /** Set once GRANTED (required on that transition); null before then. */
  validUntil?: string | null;
  /** Derived by the API on every read — see derived.ts `licenceOverdue()`. */
  isOverdue?: boolean;
  daysOverdue?: number;
}
