import mongoose, { Schema } from "mongoose";
import { applyDomainPlugins } from "../../../db/plugins/index.js";
import { paiseField } from "../../../utils/http.js";

export interface InvoiceAttrs {
  [key: string]: unknown;
}

const schema = new Schema({
    projectId: { type: Schema.Types.ObjectId, ref: "Project" },
    mouId: { type: Schema.Types.ObjectId, ref: "Mou" },
    paymentScheduleId: { type: Schema.Types.ObjectId, ref: "PaymentSchedule" },
    number: { type: String, required: true, unique: true },
    kind: { type: String, required: true, enum: ["PROFORMA", "TAX_INVOICE", "CREDIT_NOTE"] },
    status: { type: String, required: true, default: "DRAFT" },
    placeOfSupply: { type: String, required: true, enum: ["INTRA_STATE", "INTER_STATE"] },
    taxablePaise: paiseField(),
    cgstPaise: paiseField(),
    sgstPaise: paiseField(),
    igstPaise: paiseField(),
    retentionPaise: paiseField(),
    advanceRecoveredPaise: paiseField(),
    totalPaise: paiseField(),
}, { collection: "invoices" });

applyDomainPlugins(schema);

export const InvoiceModel = mongoose.models.Invoice ?? mongoose.model("Invoice", schema);
