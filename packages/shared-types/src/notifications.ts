/**
 * A string enum, not a fixed union baked into the schema as separate boolean
 * columns — a new trigger later just needs a new string here, never a
 * migration. Only the four event types this pass actually wires exist; add
 * the next one when its trigger is actually built, not before.
 */
export const NotificationEventType = {
  LEAD_ASSIGNED: "LEAD_ASSIGNED",
  ACTIVITY_PARTICIPANT_ADDED: "ACTIVITY_PARTICIPANT_ADDED",
  LEAD_QUALIFICATION_DECIDED: "LEAD_QUALIFICATION_DECIDED",
  PROJECT_MANAGER_ASSIGNED: "PROJECT_MANAGER_ASSIGNED",
} as const;
export type NotificationEventType = (typeof NotificationEventType)[keyof typeof NotificationEventType];

/**
 * The generic polymorphic target pair, the same shape Activity's own
 * `parentType`/`parentId` already uses for its parent, rather than a
 * `leadId`/`projectId`/`licenceId` column per possible entity a notification
 * might ever point at. Only LEAD and PROJECT exist because those are the only
 * two detail routes the four wired triggers ever point at — see
 * `notifications.constants.ts` on the web side for the click-through map.
 */
export const NotificationEntityType = {
  LEAD: "LEAD",
  PROJECT: "PROJECT",
} as const;
export type NotificationEntityType = (typeof NotificationEntityType)[keyof typeof NotificationEntityType];

/** Only two levels for now — every real trigger in this pass needs just these. */
export const NotificationPriority = {
  NORMAL: "NORMAL",
  HIGH: "HIGH",
} as const;
export type NotificationPriority = (typeof NotificationPriority)[keyof typeof NotificationPriority];

export interface NotificationDto {
  id: string;
  recipientUserId: string;
  /** Null for a system-generated event with no single person behind it. */
  actorUserId: string | null;
  eventType: NotificationEventType;
  entityType: NotificationEntityType;
  entityId: string;
  title: string;
  message: string;
  priority: NotificationPriority;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationListResponseDto {
  items: NotificationDto[];
  total: number;
  page: number;
  pageSize: number;
}
