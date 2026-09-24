import { Router } from "express";
import { requireAuth } from "../../middlewares/index.js";
import * as controller from "./notifications.controller.js";

export const notificationsRouter = Router();

/**
 * `requireAuth` only — deliberately no `requirePermission` module gate.
 * A user's own notifications are not a business-module resource like leads
 * or invoices; every handler reads `req.user.id` as the recipient and never
 * accepts a client-supplied id, so there is nothing here a permission level
 * would meaningfully restrict beyond "is this a logged-in user".
 *
 * No POST /, PATCH /:id or DELETE /:id — notifications are only ever
 * produced internally by NotificationService, never posted directly by a
 * client.
 */
notificationsRouter.use(requireAuth);

notificationsRouter.get("/", (req, res, next) => {
  void controller.list(req, res).catch(next);
});
notificationsRouter.get("/unread-count", (req, res, next) => {
  void controller.unreadCount(req, res).catch(next);
});
notificationsRouter.patch("/read-all", (req, res, next) => {
  void controller.markAllRead(req, res).catch(next);
});
notificationsRouter.patch("/:id/read", (req, res, next) => {
  void controller.markRead(req, res).catch(next);
});
