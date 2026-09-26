import mongoose from "mongoose";
import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Must be a valid id");
export const flagParam = z.enum(["1", "true"]).transform(() => true);
const flag = flagParam;

/**
 * The URL-driven list filters every dashboard drill-down lands on. Each list
 * route parses only the keys it supports; unknown keys are dropped, and a
 * malformed id is a 400 rather than a silently unfiltered list.
 */
export const listFilterFields = {
  id: objectId.optional(),
  projectId: objectId.optional(),
  status: z.string().trim().min(1).optional(),
  delayed: flag.optional(),
  overdue: flag.optional(),
  expiringSoon: flag.optional(),
  receivable: flag.optional(),
  openProjects: flag.optional(),
  atRisk: flag.optional(),
  bucket: z.string().trim().min(1).optional(),
  portfolio: z.string().trim().min(1).optional(),
};

export function toObjectIds(ids: Iterable<unknown>): mongoose.Types.ObjectId[] {
  return [...ids].map((id) => new mongoose.Types.ObjectId(String(id)));
}

/** Whole days between two instants, floored — the Mongo twin of derived.ts's `wholeDaysBetween`. */
export function wholeDaysExpr(from: unknown, now: Date) {
  return { $floor: { $divide: [{ $subtract: [now, from] }, 24 * 60 * 60 * 1000] } };
}
