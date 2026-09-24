import { CounterKey, InvoiceKind } from "@methanova/shared-types";
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

export async function listInvoices() {
  return InvoiceModel.find().sort({ createdAt: -1 }).limit(100);
}

export async function getInvoice(id: string) {
  const doc = await InvoiceModel.findById(id);
  if (!doc) throw new HttpError(404, "Invoice not found");
  return doc;
}

export async function createInvoice(payload: Record<string, unknown>, actorId?: string) {
  const { status: _s, number: _n, ...rest } = payload;
  const kind = String(rest.kind ?? InvoiceKind.PROFORMA);
  const number = await nextNumber(counterForKind(kind));
  const doc = new InvoiceModel({ ...rest, kind, number, status: "DRAFT" });
  applyActor(doc, actorId, "create");
  return doc.save();
}

export async function updateInvoice(id: string, payload: Record<string, unknown>, actorId?: string) {
  const { status: _s, number: _n, ...rest } = payload;
  const doc = await getInvoice(id);
  Object.assign(doc, rest);
  applyActor(doc, actorId, "update");
  return doc.save();
}

export async function softDeleteInvoice(id: string, actorId?: string) {
  const doc = await getInvoice(id);
  return doc.softDelete(actorId);
}

export async function transitionInvoice(id: string, to: string, actorId?: string) {
  const doc = await getInvoice(id);
  applyStatus("invoice", doc as { status: string }, to);
  applyActor(doc, actorId, "status_transition");
  return doc.save();
}
