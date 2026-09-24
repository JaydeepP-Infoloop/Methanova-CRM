import type { Schema } from "mongoose";

export function timestampsPlugin(schema: Schema): void {
  schema.set("timestamps", true);
}
