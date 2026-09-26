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
  /** Stamped automatically the moment this reaches COMPLETED — never set by hand. */
  actualEnd?: string | null;
  /** Set once, when moved to ON_HOLD; irrelevant otherwise. */
  delayReason?: string | null;
  /** Mirrors the latest progress update; the API never accepts it directly. */
  percentComplete?: number;
  /** Derived by the API on every read — see derived.ts `workPackageDelay()`. */
  isDelayed?: boolean;
  daysDelayed?: number;
}

export interface ProgressUpdateRow extends BaseRecord {
  workPackageId: string;
  percentComplete: number;
  notes?: string;
  at: string;
}
