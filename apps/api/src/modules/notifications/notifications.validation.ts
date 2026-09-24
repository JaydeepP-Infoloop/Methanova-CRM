import { z } from "zod";

export const createNotificationSchema = z.object({
  notes: z.string().optional(),
}).passthrough();

export const updateNotificationSchema = createNotificationSchema.partial();


