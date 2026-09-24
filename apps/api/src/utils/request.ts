import type { Request } from "express";

export function actorIdFrom(req: Request): string | undefined {
  return req.user?.id;
}
