import mongoose, { Schema } from "mongoose";
import { applyDomainPlugins } from "../../../db/plugins/index.js";
import { paiseField } from "../../../utils/http.js";

export interface ReceiptAttrs {
  [key: string]: unknown;
}

const schema = new Schema({
    invoiceId: { type: Schema.Types.ObjectId, ref: "Invoice", required: true, index: true },
    amountPaise: paiseField(),
    receivedOn: { type: Date, required: true, default: Date.now },
    reference: { type: String },
}, { collection: "receipts" });

applyDomainPlugins(schema);

export const ReceiptModel = mongoose.models.Receipt ?? mongoose.model("Receipt", schema);
