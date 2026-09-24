import { NotificationEntityType, NotificationEventType, NotificationPriority } from "@methanova/shared-types";
import mongoose, { Schema } from "mongoose";
import { applyDomainPlugins } from "../../db/plugins/index.js";

const schema = new Schema(
  {
    recipientUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    /** Null for a system-generated event with no single person behind it. */
    actorUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    eventType: { type: String, required: true, enum: Object.values(NotificationEventType) },
    /**
     * Generic polymorphic target — the same `parentType`/`parentId` pair
     * pattern Activity already uses for its own parent, rather than a
     * leadId/projectId/licenceId column per possible entity kind.
     */
    entityType: { type: String, required: true, enum: Object.values(NotificationEntityType) },
    entityId: { type: Schema.Types.ObjectId, required: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    priority: {
      type: String,
      required: true,
      enum: Object.values(NotificationPriority),
      default: NotificationPriority.NORMAL,
    },
    /**
     * No stored `actionUrl` on purpose — the click-through route is computed
     * client-side from `entityType`/`entityId`, so a future route rename
     * never needs a data migration.
     */
    readAt: { type: Date, default: null, index: true },
  },
  { collection: "notifications" },
);

// The bell and the notifications page both ask the same question — this
// recipient's rows, optionally unread only, newest first.
schema.index({ recipientUserId: 1, readAt: 1, createdAt: -1 });

applyDomainPlugins(schema);

export const NotificationModel = mongoose.models.Notification ?? mongoose.model("Notification", schema);
