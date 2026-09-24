import { AccessLevel, AppModule, canAccess, type Role } from "@methanova/shared-types";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import morgan from "morgan";
import { ZodError } from "zod";
import { config } from "../config/index.js";
import { HttpError } from "../utils/http.js";

/** Standard Apache combined log in production, terser colourised output in development. */
export const requestLogger = morgan(config.nodeEnv === "production" ? "combined" : "dev");

interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    next(new HttpError(401, "Authentication required"));
    return;
  }
  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret) as JwtPayload;
    req.user = { id: payload.sub, email: payload.email, role: payload.role };
    next();
  } catch {
    next(new HttpError(401, "Invalid token"));
  }
}

export function requirePermission(module: AppModule, needed: AccessLevel = AccessLevel.READ) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new HttpError(401, "Authentication required"));
      return;
    }
    if (!canAccess(req.user.role, module, needed)) {
      next(new HttpError(403, `Role ${req.user.role} cannot ${needed} ${module}`));
      return;
    }
    next();
  };
}

/** For routes gated by exact role rather than a module/access-level pair (e.g. admin-only actions). */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new HttpError(401, "Authentication required"));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new HttpError(403, `Role ${req.user.role} is not permitted to perform this action`));
      return;
    }
    next();
  };
}

/**
 * The MongoDB driver's duplicate-key error, detected by shape rather than
 * `instanceof` — mongoose re-throws the driver's `MongoServerError` as-is, and
 * importing the driver's class here just to narrow a type is not worth the
 * coupling. `code: 11000` is the driver's own stable identifier for this
 * error family; `keyValue` is the field/value pair that collided.
 */
interface MongoDuplicateKeyError {
  code: 11000;
  keyValue?: Record<string, unknown>;
}

function isDuplicateKeyError(err: unknown): err is MongoDuplicateKeyError {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === 11000;
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  // A schema rejection is the client's mistake, not a server fault. It also
  // carries the field paths the intake wizard needs to put each message back
  // on the step that owns it, so they are returned as a keyed map rather than
  // a stringified blob.
  if (err instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of err.issues) {
      const path = issue.path.join(".") || "_";
      (fieldErrors[path] ??= []).push(issue.message);
    }
    res.status(400).json({ error: "Validation failed", fieldErrors });
    return;
  }

  // A uniqueness collision is the client's problem to react to ("someone
  // already used that"), not a server fault — but the driver's own message
  // ("E11000 duplicate key error collection: methanova_crm.leads index:
  // code_1 dup key: { code: null }") names the database, collection and
  // index, which is internal detail nobody outside this codebase should see.
  // `keyValue`'s field name is not internal in the same way — it is the
  // schema field the caller just submitted — so it is the only part reused.
  if (isDuplicateKeyError(err)) {
    console.error(err);
    const field = Object.keys(err.keyValue ?? {})[0];
    res.status(409).json({
      error: field ? `A record with that ${field} already exists` : "That value is already in use",
    });
    return;
  }

  const status = err instanceof HttpError ? err.status : 500;
  const message = err instanceof Error ? err.message : "Unexpected error";
  if (status >= 500) {
    console.error(err);
  }
  res.status(status).json({ error: message });
}
