export interface BaseRecord {
  _id: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface DocumentRecordRow extends BaseRecord {
  projectId?: string;
  leadId?: string;
  kind: string;
  version: number;
  filename: string;
  storagePath: string;
}
