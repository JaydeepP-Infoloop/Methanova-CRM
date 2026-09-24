import { z } from "zod";

/**
 * `scope=team` is a request, not a guarantee — the service downgrades it to
 * "mine" for anyone who does not hold crm/FULL, the same way a hidden menu
 * item is a UX nicety and never the actual access control (PROJECT_CONTEXT
 * §6). A caller who cannot see it in the UI could still type it in the URL,
 * so the server has to make the same call the UI does.
 */
export const myDayQuerySchema = z.object({
  scope: z.enum(["mine", "team"]).default("mine"),
});
