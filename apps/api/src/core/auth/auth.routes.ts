import { Router } from "express";
import { requireAuth } from "../../middlewares/index.js";
import { loginHandler, logoutHandler, meHandler, refreshHandler } from "./auth.controller.js";

export const authRouter = Router();

authRouter.post("/login", (req, res, next) => {
  void loginHandler(req, res).catch(next);
});
// No requireAuth: the whole point is exchanging a still-valid refresh cookie
// for a new access token after the short-lived access token has expired.
authRouter.post("/refresh", (req, res, next) => {
  void refreshHandler(req, res).catch(next);
});
authRouter.get("/me", requireAuth, (req, res, next) => {
  void meHandler(req, res).catch(next);
});
authRouter.post("/logout", (req, res, next) => {
  void logoutHandler(req, res).catch(next);
});
