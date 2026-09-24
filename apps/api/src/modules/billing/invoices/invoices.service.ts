import { CounterKey, InvoiceKind, invoiceAgeing } from "@methanova/shared-types";
import type { HydratedDocument } from "mongoose";
import { ProjectModel } from "../../projects/project/project.model.js";
import { nextNumber } from "../../../core/counters/index.js";
import { applyStatus } from "../../../core/state-machine/index.js";
import { applyActor } from "../../../db/plugins/audit.plugin.js";
import { HttpError } from "../../../utils/http.js";
import { InvoiceModel } from "./invoices.model.js";

function counterForKind(kind: string): CounterKey {
  if (kind === InvoiceKind.PROFORMA) return CounterKey.PF;
  if (kind === InvoiceKind.CREDIT_NOTE) return CounterKey.CN;
  return CounterKey.INV;
}

/** Stored fields plus the read-time `isOverdue`/`daysOverdue`/`ageingBucket` — computed from `dueDate` on every read, never stored. */
function toInvoiceView(doc: HydratedDocument<Record<string, unknown>>, now = new Date()) {
  const plain = doc.toObject() as Record<string, unknown>;
  const ageing = invoiceAgeing({ status: String(plain.status), dueDate: plain.dueDate as Date | null }, now);
  return { ...plain, id: String(plain._id), ...ageing };
}

async function clientNameForProject(projectId: unknown): Promise<string> {
  const project = await ProjectModel.findById(projectId).select("name");
  if (!project) throw new HttpError(400, "That project does not exist");
  return String(project.get("name"));
}

export async function listInvoices() {
  const docs = await InvoiceModel.find().sort({ createdAt: -1 }).limit(100);
  const now = new Date();
  return docs.map((doc) => toInvoiceView(doc, now));
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

async function findInvoice(id: string) {
  const doc = await InvoiceModel.findById(id);
  if (!doc) throw new HttpError(404, "Invoice not found");
  return doc;
}

export async function getInvoice(id: string) {
  return toInvoiceView(await findInvoice(id));
}

export async function createInvoice(payload: Record<string, unknown>, actorId?: string) {
  const { status: _s, number: _n, clientName: _c, ...rest } = payload;
  const kind = String(rest.kind ?? InvoiceKind.PROFORMA);
  const clientName = await clientNameForProject(rest.projectId);
  const number = await nextNumber(counterForKind(kind));
  const doc = new InvoiceModel({ ...rest, kind, number, clientName, status: "DRAFT" });
  applyActor(doc, actorId, "create");
  await doc.save();
  return toInvoiceView(doc);
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
  return toInvoiceView(doc);
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
  return toInvoiceView(doc);
}
