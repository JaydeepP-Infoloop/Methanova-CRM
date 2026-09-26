import {
  AgeingBucket,
  CounterKey,
  INVOICE_RECEIVABLE_STATUSES,
  InvoiceKind,
  invoiceAgeing,
  type DashboardOutstandingInvoiceDto,
  type DashboardReceivablesDto,
} from "@methanova/shared-types";
import { ProjectModel } from "../../projects/project/project.model.js";
import { nextNumber } from "../../../core/counters/index.js";
import { applyStatus } from "../../../core/state-machine/index.js";
import { applyActor } from "../../../db/plugins/audit.plugin.js";
import { HttpError } from "../../../utils/http.js";
import { toObjectIds, wholeDaysExpr } from "../../../utils/query.js";
import { InvoiceModel } from "./invoices.model.js";

function counterForKind(kind: string): CounterKey {
  if (kind === InvoiceKind.PROFORMA) return CounterKey.PF;
  if (kind === InvoiceKind.CREDIT_NOTE) return CounterKey.CN;
  return CounterKey.INV;
}

/**
 * Appends `receivedPaise` (live receipts), `outstandingPaise`,
 * `retentionHeldPaise`, `daysPastDue` and `ageingBucket` — the Mongo form of
 * `invoiceAgeing()` (derived.ts), which the two must stay in step with.
 * Receipts never move an invoice's status, so "still owed" can only be read
 * off the receipts themselves.
 *
 * Retention (SoW: "retention held shown separately and excluded from
 * overdue"): `retentionPaise` is the part of `totalPaise` the client withholds
 * until release, so only `totalPaise − retentionPaise` is collectible now.
 * Receipts are applied to that collectible part first; anything received
 * beyond it releases retention.
 *   outstanding    = max(0, collectible − received)
 *   retentionHeld  = max(0, retention − max(0, received − collectible))
 * Only `outstandingPaise` ages, goes overdue, or counts as a receivable.
 */
function outstandingStages(now: Date) {
  const days = "$daysPastDue";
  const retention = { $ifNull: ["$retentionPaise", 0] };
  const collectible = { $max: [0, { $subtract: [{ $ifNull: ["$totalPaise", 0] }, retention] }] };
  return [
    {
      $lookup: {
        from: "receipts",
        let: { invoiceId: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$invoiceId", "$$invoiceId"] }, deletedAt: null } },
          { $group: { _id: null, total: { $sum: "$amountPaise" } } },
        ],
        as: "received",
      },
    },
    { $addFields: { receivedPaise: { $ifNull: [{ $first: "$received.total" }, 0] } } },
    {
      $addFields: {
        outstandingPaise: { $max: [0, { $subtract: [collectible, "$receivedPaise"] }] },
        retentionHeldPaise: {
          $max: [0, { $subtract: [retention, { $max: [0, { $subtract: ["$receivedPaise", collectible] }] }] }],
        },
        daysPastDue: { $cond: [{ $ifNull: ["$dueDate", false] }, wholeDaysExpr("$dueDate", now), null] },
        isOpenReceivable: { $in: ["$status", [...INVOICE_RECEIVABLE_STATUSES]] },
      },
    },
    {
      $addFields: {
        ageingBucket: {
          $cond: [
            { $and: ["$isOpenReceivable", { $gt: ["$outstandingPaise", 0] }, { $ne: [days, null] }] },
            {
              $switch: {
                branches: [
                  { case: { $lte: [days, 0] }, then: AgeingBucket.CURRENT },
                  { case: { $lte: [days, 30] }, then: AgeingBucket.DAYS_0_30 },
                  { case: { $lte: [days, 60] }, then: AgeingBucket.DAYS_31_60 },
                  { case: { $lte: [days, 90] }, then: AgeingBucket.DAYS_61_90 },
                ],
                default: AgeingBucket.DAYS_90_PLUS,
              },
            },
            null,
          ],
        },
      },
    },
    { $project: { received: 0 } },
  ];
}

/** Open receivable with something still owed — what "outstanding" means everywhere on the dashboard. */
const OUTSTANDING = { isOpenReceivable: true, outstandingPaise: { $gt: 0 } };

/** Drops invoices whose project was soft-deleted — a deleted project's paperwork is not a live receivable. */
const LIVE_PROJECT_STAGES = [
  { $lookup: { from: "projects", localField: "projectId", foreignField: "_id", as: "project" } },
  // Empty lookup (no project) also matches: `project.deletedAt` is then absent.
  { $match: { "project.deletedAt": null } },
];

/** Stored fields plus `outstandingPaise`/`retentionHeldPaise` and the read-time `isOverdue`/`daysOverdue`/`ageingBucket` — never stored. */
function toInvoiceView(row: Record<string, unknown>, now: Date) {
  const { isOpenReceivable: _r, daysPastDue: _d, ageingBucket: _b, ...plain } = row;
  const ageing = invoiceAgeing(
    {
      status: String(plain.status),
      dueDate: plain.dueDate as Date | null,
      outstandingPaise: plain.outstandingPaise as number,
    },
    now,
  );
  return { ...plain, id: String(plain._id), ...ageing };
}

async function clientNameForProject(projectId: unknown): Promise<string> {
  const project = await ProjectModel.findById(projectId).select("name");
  if (!project) throw new HttpError(400, "That project does not exist");
  return String(project.get("name"));
}

export async function listInvoices(
  filters: { id?: string; projectId?: string; receivable?: boolean; overdue?: boolean; bucket?: string; retention?: boolean } = {},
) {
  const now = new Date();
  const base: Record<string, unknown> = { deletedAt: null };
  if (filters.id) base._id = toObjectIds([filters.id])[0];
  if (filters.projectId) base.projectId = toObjectIds([filters.projectId])[0];
  const after: Record<string, unknown>[] = [];
  if (filters.receivable) after.push(OUTSTANDING);
  if (filters.retention) after.push({ isOpenReceivable: true, retentionHeldPaise: { $gt: 0 } });
  if (filters.overdue) after.push(OUTSTANDING, { daysPastDue: { $gte: 1 } });
  if (filters.bucket) {
    after.push(OUTSTANDING, filters.bucket === "none" ? { daysPastDue: null } : { ageingBucket: filters.bucket });
  }
  const sorted = filters.receivable || filters.overdue || filters.bucket || filters.retention;
  const rows = await InvoiceModel.aggregate<Record<string, unknown>>([
    { $match: base },
    ...outstandingStages(now),
    ...(after.length ? [{ $match: { $and: after } }, ...LIVE_PROJECT_STAGES, { $project: { project: 0 } }] : []),
    { $sort: sorted ? { outstandingPaise: -1, createdAt: 1 } : { createdAt: -1 } },
    { $limit: 100 },
  ]);
  return rows.map((row) => toInvoiceView(row, now));
}

/**
 * The Dashboard Billing card's "invoiced" series — grouped by the month an
 * invoice was raised (`createdAt`; this codebase has no separate "issued at"
 * moment — an invoice is created at issue time). UTC-grouped throughout,
 * matching the rest of this codebase's plain `Date` handling.
 */
export async function getMonthlyInvoicedTotals(sinceMonthStart: Date): Promise<Map<string, number>> {
  const rows = await InvoiceModel.aggregate<{ _id: string; total: number }>([
    { $match: { createdAt: { $gte: sinceMonthStart }, deletedAt: null } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
        total: { $sum: { $ifNull: ["$totalPaise", 0] } },
      },
    },
  ]);
  return new Map(rows.map((row) => [row._id, row.total]));
}

export interface ReceivablesSummary {
  summary: DashboardReceivablesDto;
  overdueByProject: { _id: unknown; count: number; worstId: unknown; worstLabel: string; worstDays: number; outstandingPaise: number }[];
  overdueTop: {
    _id: unknown;
    projectId: unknown;
    number: string;
    daysPastDue: number;
    outstandingPaise: number;
    projectCode: string | null;
    client: string | null;
  }[];
}

const AGEING_BUCKET_ORDER: AgeingBucket[] = [
  AgeingBucket.CURRENT,
  AgeingBucket.DAYS_0_30,
  AgeingBucket.DAYS_31_60,
  AgeingBucket.DAYS_61_90,
  AgeingBucket.DAYS_90_PLUS,
];

/** Receivables Ageing, Top Outstanding, and the overdue roll-up the risk reasons and critical alerts are built from — one `$facet`. */
export async function getReceivablesSummary(now: Date, topLimit: number, overdueLimit: number): Promise<ReceivablesSummary> {
  const [result] = await InvoiceModel.aggregate<{
    retention: { count: number; held: number }[];
    buckets: { _id: AgeingBucket; count: number; outstanding: number }[];
    noDueDate: { count: number; outstanding: number }[];
    totals: { count: number; outstanding: number }[];
    top: {
      _id: unknown;
      number: string;
      clientName: string | null;
      projectId: unknown;
      projectCode: string | null;
      createdAt: Date;
      dueDate: Date | null;
      outstandingPaise: number;
      ageingBucket: AgeingBucket | null;
    }[];
    overdueByProject: ReceivablesSummary["overdueByProject"];
    overdueTop: ReceivablesSummary["overdueTop"];
  }>([
    { $match: { deletedAt: null, status: { $in: [...INVOICE_RECEIVABLE_STATUSES] } } },
    ...outstandingStages(now),
    ...LIVE_PROJECT_STAGES,
    {
      $facet: {
        // Over every open receivable, not just those with collectible money
        // left: an invoice paid down to its retention still holds retention.
        retention: [
          { $match: { retentionHeldPaise: { $gt: 0 } } },
          { $group: { _id: null, count: { $sum: 1 }, held: { $sum: "$retentionHeldPaise" } } },
        ],
        buckets: [
          { $match: OUTSTANDING },
          { $match: { ageingBucket: { $ne: null } } },
          { $group: { _id: "$ageingBucket", count: { $sum: 1 }, outstanding: { $sum: "$outstandingPaise" } } },
        ],
        noDueDate: [
          { $match: OUTSTANDING },
          { $match: { daysPastDue: null } },
          { $group: { _id: null, count: { $sum: 1 }, outstanding: { $sum: "$outstandingPaise" } } },
        ],
        totals: [{ $match: OUTSTANDING }, { $group: { _id: null, count: { $sum: 1 }, outstanding: { $sum: "$outstandingPaise" } } }],
        top: [
          { $match: OUTSTANDING },
          { $sort: { outstandingPaise: -1, createdAt: 1 } },
          { $limit: topLimit },
          {
            $project: {
              number: 1,
              clientName: 1,
              projectId: 1,
              createdAt: 1,
              dueDate: 1,
              outstandingPaise: 1,
              ageingBucket: 1,
              projectCode: { $first: "$project.code" },
            },
          },
        ],
        overdueByProject: [
          { $match: OUTSTANDING },
          { $match: { daysPastDue: { $gte: 1 } } },
          { $sort: { daysPastDue: -1, outstandingPaise: -1 } },
          {
            $group: {
              _id: "$projectId",
              count: { $sum: 1 },
              worstId: { $first: "$_id" },
              worstLabel: { $first: "$number" },
              worstDays: { $first: "$daysPastDue" },
              outstandingPaise: { $sum: "$outstandingPaise" },
            },
          },
        ],
        overdueTop: [
          { $match: OUTSTANDING },
          { $match: { daysPastDue: { $gte: 1 } } },
          { $sort: { daysPastDue: -1, outstandingPaise: -1 } },
          { $limit: overdueLimit },
          {
            $project: {
              projectId: 1,
              number: 1,
              daysPastDue: 1,
              outstandingPaise: 1,
              projectCode: { $first: "$project.code" },
              client: { $ifNull: ["$clientName", { $first: "$project.name" }] },
            },
          },
        ],
      },
    },
  ]);

  const bucketRow = new Map((result?.buckets ?? []).map((row) => [row._id, row]));
  const top: DashboardOutstandingInvoiceDto[] = (result?.top ?? []).map((row) => ({
    invoiceId: String(row._id),
    number: row.number,
    clientName: row.clientName ?? null,
    projectId: row.projectId ? String(row.projectId) : null,
    projectCode: row.projectCode ?? null,
    invoiceDate: new Date(row.createdAt).toISOString(),
    dueDate: row.dueDate ? new Date(row.dueDate).toISOString() : null,
    outstandingPaise: row.outstandingPaise,
    ageingBucket: row.ageingBucket ?? null,
  }));
  return {
    summary: {
      buckets: AGEING_BUCKET_ORDER.map((bucket) => ({
        bucket,
        count: bucketRow.get(bucket)?.count ?? 0,
        outstandingPaise: bucketRow.get(bucket)?.outstanding ?? 0,
      })),
      noDueDate: {
        count: result?.noDueDate[0]?.count ?? 0,
        outstandingPaise: result?.noDueDate[0]?.outstanding ?? 0,
      },
      openCount: result?.totals[0]?.count ?? 0,
      totalOutstandingPaise: result?.totals[0]?.outstanding ?? 0,
      retentionHeld: {
        count: result?.retention[0]?.count ?? 0,
        paise: result?.retention[0]?.held ?? 0,
      },
      top,
    },
    overdueByProject: result?.overdueByProject ?? [],
    overdueTop: result?.overdueTop ?? [],
  };
}

export async function getInvoice(id: string) {
  const [row] = await listInvoices({ id });
  if (!row) throw new HttpError(404, "Invoice not found");
  return row;
}

async function findInvoice(id: string) {
  const doc = await InvoiceModel.findById(id);
  if (!doc) throw new HttpError(404, "Invoice not found");
  return doc;
}

export async function createInvoice(payload: Record<string, unknown>, actorId?: string) {
  const { status: _s, number: _n, clientName: _c, ...rest } = payload;
  const kind = String(rest.kind ?? InvoiceKind.PROFORMA);
  const clientName = await clientNameForProject(rest.projectId);
  const number = await nextNumber(counterForKind(kind));
  const doc = new InvoiceModel({ ...rest, kind, number, clientName, status: "DRAFT" });
  applyActor(doc, actorId, "create");
  await doc.save();
  return getInvoice(String(doc._id));
}

export async function updateInvoice(id: string, payload: Record<string, unknown>, actorId?: string) {
  const { status: _s, number: _n, clientName: _c, ...rest } = payload;
  const doc = await findInvoice(id);
  // Re-pointing an invoice at another project re-snapshots the addressee; a
  // plain project rename does not (see invoices.model.ts).
  if (rest.projectId !== undefined && String(rest.projectId) !== String(doc.get("projectId"))) {
    doc.set("clientName", await clientNameForProject(rest.projectId));
  }
  Object.assign(doc, rest);
  applyActor(doc, actorId, "update");
  await doc.save();
  return getInvoice(id);
}

export async function softDeleteInvoice(id: string, actorId?: string) {
  const doc = await findInvoice(id);
  return doc.softDelete(actorId);
}

export async function transitionInvoice(id: string, to: string, actorId?: string) {
  const doc = await findInvoice(id);
  applyStatus("invoice", doc as { status: string }, to);
  applyActor(doc, actorId, "status_transition");
  await doc.save();
  return getInvoice(id);
}
