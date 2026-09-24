import { MouStatus, ResponsibleParty } from "@methanova/shared-types";
import mongoose, { Schema } from "mongoose";
import { applyDomainPlugins } from "../../../db/plugins/index.js";
import { paiseField } from "../../../utils/http.js";

export interface MouAttrs {
  [key: string]: unknown;
}

const schema = new Schema(
  {
    leadId: { type: Schema.Types.ObjectId, ref: "Lead", required: true },
    /** The MOU number — allocated from the atomic counter at creation, same convention as a lead or project code. */
    code: { type: String, required: true, unique: true },
    mouDate: { type: Date, required: true, default: Date.now },
    status: { type: String, required: true, default: MouStatus.DRAFT },
    /** Locks the technical and commercial basis — only a quotation with status ACCEPTED may be referenced (enforced in mou.service.ts). */
    acceptedQuotationId: { type: Schema.Types.ObjectId, ref: "Quotation", required: true },
    feePaise: paiseField(),
    contractValuePaise: paiseField(),
    /** Whether the fee is adjusted against the first bill, or retained separately from it. */
    feeAdjustable: { type: Boolean, required: true, default: false },
    civilScope: { type: String, required: true, enum: Object.values(ResponsibleParty) },
    targetCommissioningDate: { type: Date, required: true },
    signedDocumentId: { type: Schema.Types.ObjectId, ref: "DocumentRecord", default: null },
    /**
     * Set when this MOU renegotiates a deal that was already signed. The
     * prior, signed MOU is never mutated or versioned in place — a
     * renegotiation is a new document that says what it replaces, consistent
     * with how a Quotation is never edited after it exists, only revised.
     */
    supersedesMouId: { type: Schema.Types.ObjectId, ref: "Mou", default: null },
    projectId: { type: Schema.Types.ObjectId, ref: "Project" },
  },
  { collection: "mous" },
);

applyDomainPlugins(schema);

export const MouModel = mongoose.models.Mou ?? mongoose.model("Mou", schema);
