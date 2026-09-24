export interface BaseRecord {
  _id: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface ReportSnapshotRow extends BaseRecord {
  name: string;
  payload: Record<string, unknown>;
  generatedAt: string;
}
