export interface BaseRecord {
  _id: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface UserRow extends BaseRecord {
  email: string;
  name: string;
  role: string;
}

export interface RoleRecordRow extends BaseRecord {
  key: string;
  label: string;
  description?: string;
}

export interface MasterDataRow extends BaseRecord {
  key: string;
  label: string;
  payload: Record<string, unknown>;
}
