import type { z } from "zod";
import type { listNotificationsQuerySchema } from "./notifications.validation.js";

export type NotificationId = string;
export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
