import { canTransition, QuotationStatus, type DashboardQuotationsSummaryDto } from "@methanova/shared-types";
import { assertTransition } from "../../../core/state-machine/index.js";
import { applyActor } from "../../../db/plugins/audit.plugin.js";
import { HttpError } from "../../../utils/http.js";
import { QuotationModel } from "./quotations.model.js";

export async function listQuotations(filters: { status?: string[]; open?: boolean } = {}) {
  const clauses: Record<string, unknown>[] = [];
  if (filters.status) clauses.push({ status: { $in: filters.status } });
  if (filters.open) clauses.push({ status: { $nin: TERMINAL_QUOTATION_STATUSES } });
  return QuotationModel.find(clauses.length ? { $and: clauses } : {})
    .sort({ createdAt: -1 })
    .limit(100);
}

/**
 * The Dashboard's "Open Quotations" KPI. "Open" is every non-terminal
 * `QuotationStatus` — ACCEPTED, REJECTED and SUPERSEDED are the only terminal
 * states (see `packages/shared-types/src/transitions.ts`) — derived from the
 * real status enum rather than a proxy invented from unrelated fields.
 */
const TERMINAL_QUOTATION_STATUSES = [
  QuotationStatus.ACCEPTED,
  QuotationStatus.REJECTED,
  QuotationStatus.SUPERSEDED,
];

export async function getOpenQuotationsSummary(): Promise<DashboardQuotationsSummaryDto> {
  const match = { status: { $nin: TERMINAL_QUOTATION_STATUSES }, deletedAt: null };
  const [openCount, valueAgg] = await Promise.all([
    QuotationModel.countDocuments(match),
    QuotationModel.aggregate<{ total: number }>([
      { $match: match },
      { $group: { _id: null, total: { $sum: { $ifNull: ["$totalPaise", 0] } } } },
      { $project: { _id: 0, total: 1 } },
    ]),
  ]);
  return { openCount, openValueTotalPaise: valueAgg[0]?.total ?? 0 };
}

export async function getQuotation(id: string) {
  const doc = await QuotationModel.findById(id);
  if (!doc) throw new HttpError(404, "Quotation not found");
  return doc;
}

function sumPaise(lines: { amountPaise: number }[]): number {
  return lines.reduce((sum, line) => sum + line.amountPaise, 0);
}

/**
 * `totalPaise` is always the sum of `priceLines` — computed here, never
 * accepted from the client, so a quotation can never claim a total its own
 * line items don't add up to.
 */
export async function createQuotation(payload: Record<string, unknown>, actorId?: string) {
  const parentId = payload.parentQuotationId as string | undefined;
  const priceLines = payload.priceLines as { amountPaise: number }[];
  const totalPaise = sumPaise(priceLines);

  const parent = parentId ? await QuotationModel.findById(parentId) : null;
  if (parentId && !parent) throw new HttpError(404, "Parent quotation not found");

  let revision = 1;
  let rootQuotationId: string | undefined;

  if (parent) {
    const parentStatus = String(parent.get("status"));
    // Revising a quotation that is already locked in (ACCEPTED — an MOU may
    // reference it) or already closed out (REJECTED/SUPERSEDED) would leave
    // whatever referenced it disagreeing with what the lineage now claims is
    // current. A genuinely new negotiation starts a new lineage instead.
    if (!canTransition("quotation", parentStatus, QuotationStatus.SUPERSEDED)) {
      throw new HttpError(409, `Cannot revise a quotation that is already ${parentStatus}`);
    }
    revision = Number(parent.get("revision") ?? 1) + 1;
    rootQuotationId = String(parent.get("rootQuotationId") ?? parent._id);
  }

  const doc = new QuotationModel({
    ...payload,
    revision,
    totalPaise,
    status: QuotationStatus.DRAFT,
  });
  // Only knowable once the document has its own _id, for revision 1.
  doc.set("rootQuotationId", rootQuotationId ?? doc._id);
  applyActor(doc, actorId, "create");
  const saved = await doc.save();

  if (parent) {
    parent.set("status", QuotationStatus.SUPERSEDED);
    applyActor(parent, actorId, "quotation_superseded");
    await parent.save();
  }

  return saved;
}

/** Only a draft may be edited directly — once submitted, a change is a new revision, not a silent mutation of the one under review. */
export async function updateQuotation(id: string, payload: Record<string, unknown>, actorId?: string) {
  const doc = await getQuotation(id);
  if (String(doc.get("status")) !== QuotationStatus.DRAFT) {
    throw new HttpError(409, "Only a draft quotation can be edited directly — create a revision instead");
  }
  const { status: _ignoredStatus, revision: _ignoredRevision, rootQuotationId: _ignoredRoot, ...rest } = payload;
  if (rest.priceLines) {
    rest.totalPaise = sumPaise(rest.priceLines as { amountPaise: number }[]);
  }
  Object.assign(doc, rest);
  applyActor(doc, actorId, "update");
  return doc.save();
}

export async function softDeleteQuotation(id: string, actorId?: string) {
  const doc = await getQuotation(id);
  return doc.softDelete(actorId);
}

export async function transitionQuotation(id: string, to: string, actorId?: string) {
  const doc = await getQuotation(id);
  assertTransition("quotation", String(doc.get("status")), to);
  doc.set("status", to);
  applyActor(doc, actorId, "status_transition");
  return doc.save();
}

/** Every revision sharing this quotation's lineage, oldest first — the side-by-side comparison view's data source. */
export async function listRevisions(id: string) {
  const doc = await getQuotation(id);
  const rootId = doc.get("rootQuotationId");
  return QuotationModel.find({ rootQuotationId: rootId }).sort({ revision: 1 });
}
