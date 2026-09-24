import { Schema } from "mongoose";
import { HttpError } from "../../utils/http.js";

export function softDeletePlugin(schema: Schema): void {
  schema.add({
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  });

  schema.pre(/^find/, function (this: { getFilter: () => Record<string, unknown>; where: (q: object) => void }) {
    const filter = this.getFilter();
    if (filter.deletedAt === undefined && filter.includeDeleted !== true) {
      this.where({ deletedAt: null });
    }
    delete (filter as { includeDeleted?: boolean }).includeDeleted;
  });

  const blockHardDelete = function () {
    throw new HttpError(405, "Hard deletes are not permitted; use softDelete");
  };

  schema.pre("deleteOne", blockHardDelete);
  schema.pre("deleteMany", blockHardDelete);
  schema.pre("findOneAndDelete", blockHardDelete);

  schema.methods.softDelete = async function (actorId?: string) {
    this.deletedAt = new Date();
    this.deletedBy = actorId ?? null;
    return this.save();
  };
}
