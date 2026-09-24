import mongoose, { Schema, type ClientSession, type HydratedDocument, type Model } from "mongoose";

export interface AuditLogAttrs {
  actorId?: mongoose.Types.ObjectId;
  action: string;
  entityType: string;
  entityId: mongoose.Types.ObjectId;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  at: Date;
}

const auditLogSchema = new Schema<AuditLogAttrs>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User" },
    action: { type: String, required: true },
    entityType: { type: String, required: true, index: true },
    entityId: { type: Schema.Types.ObjectId, required: true, index: true },
    before: { type: Schema.Types.Mixed, default: null },
    after: { type: Schema.Types.Mixed, default: null },
    at: { type: Date, required: true, default: Date.now },
  },
  { collection: "audit_logs" },
);

export const AuditLogModel = mongoose.model<AuditLogAttrs>("AuditLog", auditLogSchema);

function snapshot(doc: HydratedDocument<unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(doc.toObject())) as Record<string, unknown>;
}

export function auditPlugin(schema: Schema): void {
  schema.pre("save", function (this: HydratedDocument<{ _auditBefore?: Record<string, unknown> }> & { isNew: boolean }) {
    if (!this.isNew && this.$locals) {
      this.$locals.before = undefined;
    }
  });

  schema.post("init", function (this: HydratedDocument<unknown> & { $locals: Record<string, unknown> }) {
    this.$locals.before = snapshot(this);
  });

  schema.post("save", async function (this: HydratedDocument<unknown> & { $locals: Record<string, unknown> }) {
    const actorId = this.$locals.actorId as mongoose.Types.ObjectId | string | undefined;
    const action = this.$locals.auditAction as string | undefined;
    const session = this.$session() ?? undefined;
    await AuditLogModel.create(
      [
        {
          actorId: typeof actorId === "string" ? new mongoose.Types.ObjectId(actorId) : actorId,
          action: action ?? (this.isNew ? "create" : "update"),
          entityType: (this.constructor as unknown as { modelName: string }).modelName,
          entityId: this._id as mongoose.Types.ObjectId,
          before: (this.$locals.before as Record<string, unknown> | undefined) ?? null,
          after: snapshot(this),
          at: new Date(),
        },
      ],
      session ? { session } : {},
    );
  });
}

export async function writeAudit(
  entry: Omit<AuditLogAttrs, "at"> & { at?: Date },
  session?: ClientSession,
): Promise<void> {
  await AuditLogModel.create([{ ...entry, at: entry.at ?? new Date() }], { session });
}

export function applyActor<T>(doc: HydratedDocument<T>, actorId?: string, action?: string): HydratedDocument<T> {
  doc.$locals.actorId = actorId;
  if (action) doc.$locals.auditAction = action;
  return doc;
}

export type AuditedModel<T> = Model<T>;
