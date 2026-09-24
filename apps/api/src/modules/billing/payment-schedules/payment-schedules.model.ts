import mongoose, { Schema } from "mongoose";
import { applyDomainPlugins } from "../../../db/plugins/index.js";
import { paiseField } from "../../../utils/http.js";

export interface PaymentScheduleAttrs {
  [key: string]: unknown;
}

const schema = new Schema({
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    mouId: { type: Schema.Types.ObjectId, ref: "Mou", required: true },
    lines: [{
      description: { type: String, required: true },
      amountPaise: paiseField(),
      dueOnMilestone: { type: String },
    }],
}, { collection: "payment_schedules" });

applyDomainPlugins(schema);

export const PaymentScheduleModel = mongoose.models.PaymentSchedule ?? mongoose.model("PaymentSchedule", schema);
