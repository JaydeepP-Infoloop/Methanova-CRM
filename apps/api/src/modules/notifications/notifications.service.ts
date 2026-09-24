import { NotificationPriority, type NotificationEntityType, type NotificationEventType } from "@methanova/shared-types";
import { applyActor } from "../../db/plugins/audit.plugin.js";
import { HttpError } from "../../utils/http.js";
import { MasterDataModel } from "../admin/master-data/master-data.model.js";
import { NotificationModel } from "./notifications.model.js";

/**
 * Lives here rather than in the admin master-data routes file that reads and
 * writes it — the same reason `MOU_APPROVAL_SETTINGS_KEY` lives in
 * `mou.service.ts` rather than in the routes file that exposes it: this is
 * the one place that actually needs the setting at runtime, and a service
 * reading from a routes file would run the module dependency the wrong way
 * round. `geography.routes.ts` imports these two from here instead.
 */
export const NOTIFICATION_DEFAULTS_KEY = "notification-defaults";
export const DEFAULT_NOTIFICATION_DEFAULTS = {
  inAppEnabled: true,
  emailEnabled: false,
  taskOverdueToAssignee: true,
  taskOverdueToProjectManager: true,
};

export interface NotifyUsersInput {
  eventType: NotificationEventType;
  entityType: NotificationEntityType;
  entityId: string;
  actorUserId?: string | null;
  title: string;
  message: string;
  priority?: NotificationPriority;
}

/**
 * The one place every trigger in this codebase creates a notification.
 * Recipient ids are de-duplicated (an activity can list the same participant
 * twice; a lead's owner can be the same person as the actor), and nothing is
 * created at all when the system-wide in-app channel is off.
 *
 * Never throws past the caller. A notification is a side effect of a real
 * business operation — assigning a lead, signing an MOU — never a
 * precondition for one, so a failure here is logged and swallowed rather
 * than allowed to fail the operation that triggered it.
 */
export async function notifyUsers(
  recipientUserIds: (string | null | undefined)[],
  input: NotifyUsersInput,
): Promise<void> {
  try {
    const uniqueRecipients = [...new Set(recipientUserIds.filter((id): id is string => Boolean(id)))];
    if (uniqueRecipients.length === 0) return;

    const settingsRow = (await MasterDataModel.findOne({ key: NOTIFICATION_DEFAULTS_KEY }).lean()) as
      | { payload?: Partial<typeof DEFAULT_NOTIFICATION_DEFAULTS> }
      | null;
    const inAppEnabled = settingsRow?.payload?.inAppEnabled ?? DEFAULT_NOTIFICATION_DEFAULTS.inAppEnabled;
    if (!inAppEnabled) return;

    await Promise.all(
      uniqueRecipients.map(async (recipientUserId) => {
        const doc = new NotificationModel({
          recipientUserId,
          actorUserId: input.actorUserId ?? null,
          eventType: input.eventType,
          entityType: input.entityType,
          entityId: input.entityId,
          title: input.title,
          message: input.message,
          priority: input.priority ?? NotificationPriority.NORMAL,
        });
        applyActor(doc, input.actorUserId ?? undefined, "notification_created");
        await doc.save();
      }),
    );
  } catch (error) {
    // Logged, never rethrown — see the doc comment above.
    console.error("notifyUsers failed; swallowed so it cannot fail the operation that triggered it", error);
  }
}

export async function listForUser(
  userId: string,
  { unreadOnly, page, pageSize }: { unreadOnly?: boolean; page: number; pageSize: number },
) {
  const filter: Record<string, unknown> = { recipientUserId: userId };
  if (unreadOnly) filter.readAt = null;

  const [rows, total] = await Promise.all([
    NotificationModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    NotificationModel.countDocuments(filter),
  ]);

  // `.lean()` returns a plain object with `_id`, not a hydrated document with
  // the `id` virtual — unlike markRead's `findOne` below, this has to map it
  // by hand, the same way leads.service.ts and activities.service.ts do for
  // their own lean list endpoints.
  const items = rows.map((row) => ({
    id: String(row._id),
    recipientUserId: String(row.recipientUserId),
    actorUserId: row.actorUserId ? String(row.actorUserId) : null,
    eventType: row.eventType,
    entityType: row.entityType,
    entityId: String(row.entityId),
    title: row.title,
    message: row.message,
    priority: row.priority,
    readAt: row.readAt,
    createdAt: row.createdAt,
  }));

  return { items, total, page, pageSize };
}

export async function unreadCount(userId: string): Promise<number> {
  return NotificationModel.countDocuments({ recipientUserId: userId, readAt: null });
}

/**
 * Ownership is checked here, not just filtered — this is the one place in
 * the whole notifications surface where a wrong id must not leak another
 * user's data. A 404 either way (never existed, or belongs to someone else)
 * tells a caller nothing about whether the id belongs to another user.
 */
export async function markRead(id: string, userId: string) {
  const doc = await NotificationModel.findOne({ _id: id, recipientUserId: userId });
  if (!doc) throw new HttpError(404, "Notification not found");
  if (!doc.get("readAt")) {
    doc.set("readAt", new Date());
    applyActor(doc, userId, "notification_read");
    await doc.save();
  }
  return doc;
}

export async function markAllRead(userId: string): Promise<{ modifiedCount: number }> {
  const result = await NotificationModel.updateMany(
    { recipientUserId: userId, readAt: null },
    { $set: { readAt: new Date() } },
  );
  return { modifiedCount: result.modifiedCount };
}
