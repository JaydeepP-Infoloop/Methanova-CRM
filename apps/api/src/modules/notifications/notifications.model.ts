import mongoose, { Schema } from "mongoose";
import { applyDomainPlugins } from "../../db/plugins/index.js";


export interface NotificationAttrs {
  [key: string]: unknown;
}

const schema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    readAt: { type: Date },
}, { collection: "notifications" });

applyDomainPlugins(schema);

export const NotificationModel = mongoose.models.Notification ?? mongoose.model("Notification", schema);
