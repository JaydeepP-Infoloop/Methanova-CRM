import { NotificationEntityType } from "@methanova/shared-types";

/**
 * The click-through route is computed here from `entityType`/`entityId`
 * rather than stored on the notification as `actionUrl`, so a future route
 * rename never needs a data migration. An entity type with no entry falls
 * through to no navigation at all — the same discipline `RefCell` applies to
 * a foreign key with no detail route yet, rather than sending someone to a 404.
 */
export const NOTIFICATION_ENTITY_ROUTES: Partial<Record<NotificationEntityType, (entityId: string) => string>> = {
  [NotificationEntityType.LEAD]: (entityId) => `/app/crm/leads/${entityId}`,
  [NotificationEntityType.PROJECT]: (entityId) => `/app/projects/${entityId}`,
};

export function notificationRoute(entityType: string, entityId: string): string | undefined {
  return NOTIFICATION_ENTITY_ROUTES[entityType as NotificationEntityType]?.(entityId);
}
