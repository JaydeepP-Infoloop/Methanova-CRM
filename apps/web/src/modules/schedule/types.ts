export interface BaseRecord {
  _id: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface WorkPackageRow extends BaseRecord {
  projectId: string;
  name: string;
  sequence: number;
  status: string;
  plannedStart?: string;
  plannedEnd?: string;
  amountPaise: number;
}

export interface ProgressUpdateRow extends BaseRecord {
  workPackageId: string;
  percentComplete: number;
  notes?: string;
  at: string;
}
