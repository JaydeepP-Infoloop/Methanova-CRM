import { z } from "zod";

const booleanFlag = z
  .enum(["true", "false"])
  .optional()
  .transform((value) => value === "true");

export const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  unreadOnly: booleanFlag,
});
