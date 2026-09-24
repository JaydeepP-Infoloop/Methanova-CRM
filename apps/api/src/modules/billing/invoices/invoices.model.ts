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
    /**
     * Null on older/auto-created invoices (e.g. the MOU-fee invoice `signMou()`
     * creates has no payment-terms policy to derive a due date from — nothing
     * in this codebase defines "days to pay" yet, so it is left unset rather
     * than invented). Backs the existing `OVERDUE` status, which otherwise has
     * no data behind it, and the Dashboard's Billing panel.
     */
    dueDate: { type: Date, default: null, index: true },
    /**
     * The billed-to name as it stood when the invoice was raised — copied
     * server-side from the project, never accepted from a client, and not
     * rewritten if the project is renamed later: a tax invoice is a legal
     * document and its addressee is a historical fact. Receivables ageing
     * groups on this. See PROJECT_CONTEXT.md "Invoice client identity".
     */
    clientName: { type: String, trim: true, default: null, index: true },
}, { collection: "invoices" });

applyDomainPlugins(schema);

export const InvoiceModel = mongoose.models.Invoice ?? mongoose.model("Invoice", schema);
