export interface BaseRecord {
  _id: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface ReceiptRow extends BaseRecord {
  invoiceId: string;
  amountPaise: number;
  receivedOn: string;
  reference?: string;
}
