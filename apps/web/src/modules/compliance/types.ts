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
}
