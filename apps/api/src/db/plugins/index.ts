import type { Schema } from "mongoose";
import { auditPlugin } from "./audit.plugin.js";
import { softDeletePlugin } from "./soft-delete.plugin.js";
import { timestampsPlugin } from "./timestamps.plugin.js";

export function applyDomainPlugins(schema: Schema): void {
  timestampsPlugin(schema);
  softDeletePlugin(schema);
  auditPlugin(schema);
}
