import { CounterKey } from "@methanova/shared-types";
import mongoose, { Schema, type ClientSession } from "mongoose";

interface CounterDoc {
  key: string;
  seq: number;
}

const counterSchema = new Schema<CounterDoc>(
  {
    key: { type: String, required: true, unique: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { collection: "counters" },
);

export const CounterModel = mongoose.model<CounterDoc>("Counter", counterSchema);

/**
 * Gapless numbering via atomic findOneAndUpdate + upsert.
 * Cancelled documents keep their number; this never decrements seq.
 */
export async function nextSequence(key: CounterKey | string, session?: ClientSession): Promise<number> {
  const doc = await CounterModel.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, session },
  );
  if (!doc) {
    throw new Error(`Failed to allocate counter for ${key}`);
  }
  return doc.seq;
}

export async function nextNumber(key: CounterKey, session?: ClientSession): Promise<string> {
  const seq = await nextSequence(key, session);
  return `${key}-${String(seq).padStart(5, "0")}`;
}
