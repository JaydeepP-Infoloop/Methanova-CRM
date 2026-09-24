/**
 * One-shot scaffold for API entity modules. Run from repo root with node.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const entities = [
  { path: "crm/leads", file: "leads", model: "Lead", collection: "leads", sm: "lead", statusField: "stage", module: "crm", extraFields: `organisationName: { type: String, required: true },
    contactName: { type: String, required: true },
    contactEmail: { type: String },
    siteLocation: { type: String },
    code: { type: String, required: true, unique: true },
    stage: { type: String, required: true, default: "ENQUIRY" },` },
  { path: "crm/quotations", file: "quotations", model: "Quotation", collection: "quotations", sm: null, statusField: null, module: "crm", extraFields: `leadId: { type: Schema.Types.ObjectId, ref: "Lead", required: true },
    revision: { type: Number, required: true, default: 1 },
    parentQuotationId: { type: Schema.Types.ObjectId, ref: "Quotation" },
    notes: { type: String },
    totalPaise: paiseField(),` },
  { path: "crm/activities", file: "activities", model: "Activity", collection: "activities", sm: null, statusField: null, module: "crm", extraFields: `leadId: { type: Schema.Types.ObjectId, ref: "Lead", required: true },
    type: { type: String, required: true },
    notes: { type: String, required: true },
    at: { type: Date, required: true, default: Date.now },` },
  { path: "crm/mou", file: "mou", model: "Mou", collection: "mous", sm: "mou", statusField: "status", module: "crm", extraFields: `leadId: { type: Schema.Types.ObjectId, ref: "Lead", required: true },
    code: { type: String, required: true, unique: true },
    status: { type: String, required: true, default: "DRAFT" },
    feePaise: paiseField(),
    projectId: { type: Schema.Types.ObjectId, ref: "Project" },` },
  { path: "projects/project", file: "project", model: "Project", collection: "projects", sm: null, statusField: "status", module: "projects", extraFields: `leadId: { type: Schema.Types.ObjectId, ref: "Lead", required: true },
    mouId: { type: Schema.Types.ObjectId, ref: "Mou", required: true },
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    status: { type: String, required: true, default: "ACTIVE" },` },
  { path: "projects/feasibility", file: "feasibility", model: "FeasibilitySurvey", collection: "feasibility_surveys", sm: null, statusField: null, module: "projects", extraFields: `projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    version: { type: Number, required: true, default: 1 },
    findings: { type: String },
    statutoryNotes: { type: String },` },
  { path: "projects/drp", file: "drp", model: "Dpr", collection: "dprs", sm: null, statusField: null, module: "projects", extraFields: `projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    version: { type: Number, required: true, default: 1 },
    summary: { type: String },
    capacityNm3: { type: Number, integer: true },` },
  { path: "compliance/licences", file: "licences", model: "Licence", collection: "licences", sm: "licence", statusField: "status", module: "compliance", extraFields: `projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    bundle: { type: String, required: true, enum: ["PRE_CTE", "CTE", "CTO"] },
    authority: { type: String, default: "SPCB" },
    status: { type: String, required: true, default: "NOT_STARTED" },
    visits: [{ at: Date, notes: String, officer: String }],
    queries: [{ at: Date, question: String, response: String, status: String }],` },
  { path: "documents", file: "documents", model: "DocumentRecord", collection: "documents", sm: null, statusField: null, module: "documents", extraFields: `projectId: { type: Schema.Types.ObjectId, ref: "Project" },
    leadId: { type: Schema.Types.ObjectId, ref: "Lead" },
    kind: { type: String, required: true },
    version: { type: Number, required: true, default: 1 },
    filename: { type: String, required: true },
    storagePath: { type: String, required: true },` },
  { path: "schedule/work-packages", file: "work-packages", model: "WorkPackage", collection: "work_packages", sm: "workPackage", statusField: "status", module: "schedule", extraFields: `projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    name: { type: String, required: true },
    sequence: { type: Number, required: true, default: 1 },
    status: { type: String, required: true, default: "PLANNED" },
    plannedStart: { type: Date },
    plannedEnd: { type: Date },
    amountPaise: paiseField(),` },
  { path: "schedule/progress-updates", file: "progress-updates", model: "ProgressUpdate", collection: "progress_updates", sm: null, statusField: null, module: "schedule", extraFields: `workPackageId: { type: Schema.Types.ObjectId, ref: "WorkPackage", required: true },
    percentComplete: { type: Number, required: true, min: 0, max: 100 },
    notes: { type: String },
    at: { type: Date, required: true, default: Date.now },` },
  { path: "billing/payment-schedules", file: "payment-schedules", model: "PaymentSchedule", collection: "payment_schedules", sm: null, statusField: null, module: "billing", extraFields: `projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    mouId: { type: Schema.Types.ObjectId, ref: "Mou", required: true },
    lines: [{
      description: { type: String, required: true },
      amountPaise: paiseField(),
      dueOnMilestone: { type: String },
    }],` },
  { path: "billing/invoices", file: "invoices", model: "Invoice", collection: "invoices", sm: "invoice", statusField: "status", module: "billing", extraFields: `projectId: { type: Schema.Types.ObjectId, ref: "Project" },
    mouId: { type: Schema.Types.ObjectId, ref: "Mou" },
    paymentScheduleId: { type: Schema.Types.ObjectId, ref: "PaymentSchedule" },
    number: { type: String, required: true, unique: true },
    kind: { type: String, required: true, enum: ["PROFORMA", "TAX_INVOICE", "CREDIT_NOTE"] },
    status: { type: String, required: true, default: "DRAFT" },
    placeOfSupply: { type: String, required: true, enum: ["INTRA_STATE", "INTER_STATE"] },
    taxablePaise: paiseField(),
    cgstPaise: paiseField(),
    sgstPaise: paiseField(),
    igstPaise: paiseField(),
    retentionPaise: paiseField(),
    advanceRecoveredPaise: paiseField(),
    totalPaise: paiseField(),` },
  { path: "receivables/receipts", file: "receipts", model: "Receipt", collection: "receipts", sm: null, statusField: null, module: "receivables", extraFields: `invoiceId: { type: Schema.Types.ObjectId, ref: "Invoice", required: true },
    amountPaise: paiseField(),
    receivedOn: { type: Date, required: true, default: Date.now },
    reference: { type: String },` },
  { path: "notifications", file: "notifications", model: "Notification", collection: "notifications", sm: null, statusField: null, module: "reports", extraFields: `userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    readAt: { type: Date },` },
  { path: "reports", file: "reports", model: "ReportSnapshot", collection: "report_snapshots", sm: null, statusField: null, module: "reports", extraFields: `name: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, required: true, default: {} },
    generatedAt: { type: Date, required: true, default: Date.now },` },
  { path: "admin/users", file: "users", model: "User", collection: "users", sm: null, statusField: null, module: "admin", extraFields: null, skipModel: true },
  { path: "admin/roles", file: "roles", model: "RoleRecord", collection: "roles", sm: null, statusField: null, module: "admin", extraFields: `key: { type: String, required: true, unique: true },
    label: { type: String, required: true },
    description: { type: String },` },
  { path: "admin/master-data", file: "master-data", model: "MasterData", collection: "master_data", sm: null, statusField: null, module: "admin", extraFields: `key: { type: String, required: true, unique: true },
    label: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, required: true, default: {} },` },
];

function depth(entityPath) {
  return entityPath.split("/").length + 1; // modules/ + parts
}

function rel(entityPath, to) {
  const up = "../".repeat(depth(entityPath));
  return up + to;
}

for (const e of entities) {
  const dir = join(root, "apps/api/src/modules", e.path);
  mkdirSync(dir, { recursive: true });

  const pluginsImport = rel(e.path, "db/plugins/index.js");
  const httpImport = rel(e.path, "utils/http.js");
  const smImport = rel(e.path, "core/state-machine/index.js");
  const mwImport = rel(e.path, "middlewares/index.js");

  if (!e.skipModel) {
    const usesPaise = e.extraFields.includes("paiseField");
    const model = `import mongoose, { Schema } from "mongoose";
import { applyDomainPlugins } from "${pluginsImport}";
${usesPaise ? `import { paiseField } from "${httpImport}";` : ""}

export interface ${e.model}Attrs {
  [key: string]: unknown;
}

const schema = new Schema({
    ${e.extraFields}
}, { collection: "${e.collection}" });

applyDomainPlugins(schema);

export const ${e.model}Model = mongoose.models.${e.model} ?? mongoose.model("${e.model}", schema);
`;
    writeFileSync(join(dir, `${e.file}.model.ts`), model);
  }

  const types = `export type ${e.model}Id = string;

export interface ${e.model}ListQuery {
  limit?: number;
}
`;
  writeFileSync(join(dir, `${e.file}.types.ts`), types);

  const validation = `import { z } from "zod";

export const create${e.model}Schema = z.object({
  notes: z.string().optional(),
}).passthrough();

export const update${e.model}Schema = create${e.model}Schema.partial();

${e.sm ? `export const transition${e.model}Schema = z.object({
  to: z.string().min(1),
});` : ""}
`;
  writeFileSync(join(dir, `${e.file}.validation.ts`), validation);

  const statusCode = e.sm
    ? `import { applyStatus } from "${smImport}";
`
    : "";

  const service = `import { HttpError } from "${httpImport}";
${statusCode}import { ${e.skipModel ? "UserModel as TheModel" : e.model + "Model as TheModel"} } from "./${e.file}.model.js";
import { applyActor } from "${rel(e.path, "db/plugins/audit.plugin.js")}";

export async function list${e.model}s() {
  return TheModel.find().sort({ createdAt: -1 }).limit(100);
}

export async function get${e.model}(id: string) {
  const doc = await TheModel.findById(id);
  if (!doc) throw new HttpError(404, "${e.model} not found");
  return doc;
}

export async function create${e.model}(payload: Record<string, unknown>, actorId?: string) {
  const doc = new TheModel(payload);
  applyActor(doc, actorId, "create");
  return doc.save();
}

export async function update${e.model}(id: string, payload: Record<string, unknown>, actorId?: string) {
  const doc = await get${e.model}(id);
  Object.assign(doc, payload);
  applyActor(doc, actorId, "update");
  return doc.save();
}

export async function softDelete${e.model}(id: string, actorId?: string) {
  const doc = await get${e.model}(id);
  return doc.softDelete(actorId);
}

${e.sm ? `export async function transition${e.model}(id: string, to: string, actorId?: string) {
  const doc = await get${e.model}(id);
  applyStatus("${e.sm}", doc as { status: string }, to);
  applyActor(doc, actorId, "status_transition");
  return doc.save();
}` : ""}
`;
  writeFileSync(join(dir, `${e.file}.service.ts`), service);

  const controller = `import type { Request, Response } from "express";
import * as service from "./${e.file}.service.js";
import * as validation from "./${e.file}.validation.js";

export async function list(req: Request, res: Response): Promise<void> {
  res.json(await service.list${e.model}s());
}

export async function get(req: Request, res: Response): Promise<void> {
  res.json(await service.get${e.model}(req.params.id));
}

export async function create(req: Request, res: Response): Promise<void> {
  const body = validation.create${e.model}Schema.parse(req.body);
  res.status(201).json(await service.create${e.model}(body, req.user?.id));
}

export async function update(req: Request, res: Response): Promise<void> {
  const body = validation.update${e.model}Schema.parse(req.body);
  res.json(await service.update${e.model}(req.params.id, body, req.user?.id));
}

export async function remove(req: Request, res: Response): Promise<void> {
  res.json(await service.softDelete${e.model}(req.params.id, req.user?.id));
}

${e.sm ? `export async function transition(req: Request, res: Response): Promise<void> {
  const body = validation.transition${e.model}Schema.parse(req.body);
  res.json(await service.transition${e.model}(req.params.id, body.to, req.user?.id));
}` : ""}
`;
  writeFileSync(join(dir, `${e.file}.controller.ts`), controller);

  const access = e.module === "admin" ? "FULL" : "WRITE";
  const routes = `import { AccessLevel, AppModule } from "@methanova/shared-types";
import { Router } from "express";
import { requireAuth, requirePermission } from "${mwImport}";
import * as controller from "./${e.file}.controller.js";

export const ${e.file.replace(/-([a-z])/g, (_, c) => c.toUpperCase())}Router = Router();

${e.file.replace(/-([a-z])/g, (_, c) => c.toUpperCase())}Router.use(requireAuth, requirePermission(AppModule.${e.module}, AccessLevel.READ));

${e.file.replace(/-([a-z])/g, (_, c) => c.toUpperCase())}Router.get("/", (req, res, next) => { void controller.list(req, res).catch(next); });
${e.file.replace(/-([a-z])/g, (_, c) => c.toUpperCase())}Router.get("/:id", (req, res, next) => { void controller.get(req, res).catch(next); });
${e.file.replace(/-([a-z])/g, (_, c) => c.toUpperCase())}Router.post("/", requirePermission(AppModule.${e.module}, AccessLevel.${access === "FULL" ? "WRITE" : "WRITE"}), (req, res, next) => { void controller.create(req, res).catch(next); });
${e.file.replace(/-([a-z])/g, (_, c) => c.toUpperCase())}Router.patch("/:id", requirePermission(AppModule.${e.module}, AccessLevel.WRITE), (req, res, next) => { void controller.update(req, res).catch(next); });
${e.file.replace(/-([a-z])/g, (_, c) => c.toUpperCase())}Router.delete("/:id", requirePermission(AppModule.${e.module}, AccessLevel.WRITE), (req, res, next) => { void controller.remove(req, res).catch(next); });
${e.sm ? `${e.file.replace(/-([a-z])/g, (_, c) => c.toUpperCase())}Router.post("/:id/transition", requirePermission(AppModule.${e.module}, AccessLevel.WRITE), (req, res, next) => { void controller.transition(req, res).catch(next); });` : ""}
`;
  writeFileSync(join(dir, `${e.file}.routes.ts`), routes);
}

console.log("Wrote", entities.length, "entity modules");
