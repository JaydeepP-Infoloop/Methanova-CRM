import {
  AccessLevel,
  AppModule,
  canAccess,
  CounterKey,
  GstPlaceOfSupply,
  InvoiceKind,
  InvoiceStatus,
  LeadStage,
  MOU_STATUS_ORDER,
  MouStatus,
  NotificationEntityType,
  NotificationEventType,
  ProjectStatus,
  QuotationStatus,
  type DashboardMouStatusDto,
  type Role,
} from "@methanova/shared-types";
import mongoose from "mongoose";
import { nextNumber } from "../../../core/counters/index.js";
import { assertTransition } from "../../../core/state-machine/index.js";
import { applyActor, writeAudit } from "../../../db/plugins/audit.plugin.js";
import { InvoiceModel } from "../../billing/invoices/invoices.model.js";
import { PaymentScheduleModel } from "../../billing/payment-schedules/payment-schedules.model.js";
import { LicenceModel } from "../../compliance/licences/licences.model.js";
import { LicenceTypeModel } from "../../admin/master-data/geography.model.js";
import { MasterDataModel } from "../../admin/master-data/master-data.model.js";
import { notifyUsers } from "../../notifications/notifications.service.js";
import { LeadModel } from "../leads/leads.model.js";
import { ProjectModel } from "../../projects/project/project.model.js";
import { QuotationModel } from "../quotations/quotations.model.js";
import { gstComponents } from "../../../utils/gst.js";
import { HttpError } from "../../../utils/http.js";
import { MouModel } from "./mou.model.js";

/**
 * The Director-approval gate's own threshold. Lives here rather than in the
 * routes file that reads/writes it — the setting is an MOU-domain concept
 * `signMou()` itself needs, and a service reading from a routes file would
 * run the module dependency the wrong way round; `geography.routes.ts`
 * imports these from here instead, the same direction every other
 * route→service relationship in this codebase runs.
 */
export const MOU_APPROVAL_SETTINGS_KEY = "mou-approval-settings";
/** ₹1 crore — a starting default pending the actual SoW figure; edit it from the admin screen, not here. */
export const DEFAULT_MOU_APPROVAL_THRESHOLD_PAISE = 1_000_000_000;

export async function listMous(filters: { status?: string[] } = {}) {
  const query = filters.status ? { status: { $in: filters.status } } : {};
  return MouModel.find(query).sort({ createdAt: -1 }).limit(100);
}

/**
 * The Dashboard's MOU card. Every status in `MOU_STATUS_ORDER` is always
 * present, including at count 0. `contractValuePaise`/`feePaise` are summed
 * as recorded on each MOU regardless of status — the SIGNED row is where
 * "total signed contract value" actually lives; DRAFT/SENT rows show what's
 * still in the pipeline rather than committed.
 */
export async function getMouSummaryByStatus(): Promise<DashboardMouStatusDto[]> {
  const rows = await MouModel.aggregate<{ _id: string; count: number; contractValuePaise: number; feePaise: number }>([
    { $match: { deletedAt: null } },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        contractValuePaise: { $sum: { $ifNull: ["$contractValuePaise", 0] } },
        feePaise: { $sum: { $ifNull: ["$feePaise", 0] } },
      },
    },
  ]);
  const byStatus = new Map(rows.map((row) => [row._id, row]));

  return MOU_STATUS_ORDER.map((status) => ({
    status,
    count: byStatus.get(status)?.count ?? 0,
    contractValuePaise: byStatus.get(status)?.contractValuePaise ?? 0,
    feePaise: byStatus.get(status)?.feePaise ?? 0,
  }));
}

export async function getMou(id: string) {
  const doc = await MouModel.findById(id);
  if (!doc) throw new HttpError(404, "Mou not found");
  return doc;
}

export async function createMou(payload: Record<string, unknown>, actorId?: string) {
  const { status: _ignored, code: _ignoredCode, ...rest } = payload;

  const quotation = await QuotationModel.findById(rest.acceptedQuotationId as string);
  if (!quotation) throw new HttpError(404, "Accepted quotation not found");
  if (String(quotation.get("status")) !== QuotationStatus.ACCEPTED) {
    throw new HttpError(400, "An MOU can only be created against a quotation that has been accepted");
  }

  const code = await nextNumber(CounterKey.MOU);
  const contractValuePaise = (rest.contractValuePaise as number | undefined) ?? Number(quotation.get("totalPaise"));

  const doc = new MouModel({ ...rest, code, contractValuePaise, status: MouStatus.DRAFT });
  applyActor(doc, actorId, "create");
  return doc.save();
}

export async function updateMou(id: string, payload: Record<string, unknown>, actorId?: string) {
  const { status: _ignored, ...rest } = payload;
  const doc = await getMou(id);
  Object.assign(doc, rest);
  applyActor(doc, actorId, "update");
  return doc.save();
}

export async function softDeleteMou(id: string, actorId?: string) {
  const doc = await getMou(id);
  return doc.softDelete(actorId);
}

export async function transitionMou(id: string, to: string, actorId?: string, actorRole?: Role) {
  if (to === MouStatus.SIGNED) {
    return signMou(id, actorId, actorRole);
  }
  const doc = await getMou(id);
  assertTransition("mou", String(doc.get("status")), to);
  doc.set("status", to);
  applyActor(doc, actorId, "status_transition");
  return doc.save();
}

/** Sum of `amountPaise` lands exactly on `totalPaise` — any rounding remainder is absorbed into the last line rather than left to drift across the set. */
function paymentLinesFromTemplate(
  milestones: { description: string; percentage: number; dueOnMilestone?: string | null }[],
  totalPaise: number,
): { description: string; amountPaise: number; dueOnMilestone: string }[] {
  const totalPercentage = milestones.reduce((sum, milestone) => sum + milestone.percentage, 0);
  if (Math.round(totalPercentage * 100) !== 10000) {
    throw new HttpError(
      400,
      `The accepted quotation's payment terms template percentages must sum to 100 (currently ${totalPercentage})`,
    );
  }
  const lines = milestones.map((milestone) => ({
    description: milestone.description,
    amountPaise: Math.floor((totalPaise * milestone.percentage) / 100),
    dueOnMilestone: milestone.dueOnMilestone ?? milestone.description,
  }));
  const allocated = lines.reduce((sum, line) => sum + line.amountPaise, 0);
  if (lines.length > 0) {
    lines[lines.length - 1].amountPaise += totalPaise - allocated;
  }
  return lines;
}

/**
 * Atomic MOU sign: project + payment schedule + licence checklist + MOU fee
 * invoice, all populated from the MOU's own accepted quotation and its Lead
 * rather than left as stub placeholders. Entire unit rolls back on any
 * failure (requires replica set).
 */
export async function signMou(id: string, actorId?: string, actorRole?: Role) {
  const session = await mongoose.startSession();
  try {
    let signed;
    let notifyProjectId: string | undefined;
    let notifyProjectManagerId: string | null | undefined;
    let notifyCompanyName: string | undefined;
    await session.withTransaction(async () => {
      const mou = await MouModel.findById(id).session(session);
      if (!mou) throw new HttpError(404, "Mou not found");
      const fromStatus = String(mou.get("status"));
      assertTransition("mou", fromStatus, MouStatus.SIGNED);

      const feePaise = Number(mou.get("feePaise") ?? 0);
      if (!Number.isInteger(feePaise) || feePaise < 0) {
        throw new HttpError(400, "MOU feePaise must be a non-negative integer");
      }
      const contractValuePaise = Number(mou.get("contractValuePaise") ?? 0);
      if (!Number.isInteger(contractValuePaise) || contractValuePaise < 0) {
        throw new HttpError(400, "MOU contractValuePaise must be a non-negative integer");
      }

      // Director-approval gate: a contract at or above the configured
      // threshold cannot be signed by just anyone with crm/WRITE. admin/FULL
      // is reused as the "director-level approval" check rather than a raw
      // role comparison — it is already the established gate qualification
      // settings and reference-data writes use, and stays correct if the
      // permission matrix itself ever changes who holds it.
      const settingsRow = (await MasterDataModel.findOne({ key: MOU_APPROVAL_SETTINGS_KEY })
        .session(session)
        .lean()) as { payload?: { thresholdPaise?: number } } | null;
      const thresholdPaise = settingsRow?.payload?.thresholdPaise ?? DEFAULT_MOU_APPROVAL_THRESHOLD_PAISE;
      if (contractValuePaise >= thresholdPaise && !(actorRole && canAccess(actorRole, AppModule.admin, AccessLevel.FULL))) {
        throw new HttpError(
          403,
          `Signing an MOU with a contract value of ₹${(contractValuePaise / 100).toLocaleString("en-IN")} (at or above the ₹${(thresholdPaise / 100).toLocaleString("en-IN")} approval threshold) requires Director approval`,
        );
      }

      const quotation = await QuotationModel.findById(mou.get("acceptedQuotationId")).session(session);
      if (!quotation) throw new HttpError(404, "The MOU's accepted quotation could not be found");
      if (String(quotation.get("status")) !== QuotationStatus.ACCEPTED) {
        throw new HttpError(409, "The MOU's accepted quotation is no longer in ACCEPTED status");
      }

      const lead = await LeadModel.findById(mou.get("leadId")).session(session);
      if (!lead) throw new HttpError(404, "The MOU's lead could not be found");
      notifyCompanyName = String(lead.get("companyName"));

      const projectCode = await nextNumber(CounterKey.PROJECT, session);
      const invoiceNumber = await nextNumber(CounterKey.INV, session);
      const place = GstPlaceOfSupply.INTRA_STATE;
      const tax = gstComponents(feePaise, place);
      const totalPaise = feePaise + tax.cgstPaise + tax.sgstPaise + tax.igstPaise;

      const [project] = await ProjectModel.create(
        [
          {
            leadId: mou.get("leadId"),
            mouId: mou._id,
            code: projectCode,
            // Named after the client, not the project code — the old stub
            // (`Project ${projectCode}`) carried no client name at all.
            name: lead.get("companyName"),
            status: ProjectStatus.ACTIVE,
            siteAddress: lead.get("siteAddress") ?? lead.get("registeredAddress") ?? null,
            stateId: lead.get("stateId"),
            districtId: lead.get("districtId"),
            talukaId: lead.get("talukaId"),
            villageId: lead.get("villageId") ?? null,
            capacityTpd: quotation.get("capacityTpd"),
            feedstockBasis: quotation.get("feedstockBasis"),
            feedstockTypeIds: lead.get("feedstockTypeIds") ?? [],
            civilScope: mou.get("civilScope"),
            contractValuePaise,
            // The only write of this field, ever — see project.model.ts.
            targetCommissioningDate: mou.get("targetCommissioningDate"),
          },
        ],
        { session },
      );
      notifyProjectId = String(project._id);
      // `projectManagerUserId` is never set inside this spin-up in practice — the
      // real assignment happens afterwards through project.service.ts's
      // updateProject(), which carries its own notifyUsers() call for
      // exactly that reason (verified live: this call site alone never
      // fired). This reads the real field rather than assuming, so nothing
      // breaks if a future change ever does pass a PM in at creation.
      notifyProjectManagerId = project.get("projectManagerUserId")
        ? String(project.get("projectManagerUserId"))
        : null;

      const paymentLines = paymentLinesFromTemplate(
        (quotation.get("paymentTermsTemplate") as { milestones: { description: string; percentage: number; dueOnMilestone?: string | null }[] })
          .milestones,
        contractValuePaise,
      );
      const [schedule] = await PaymentScheduleModel.create(
        [
          {
            projectId: project._id,
            mouId: mou._id,
            lines: paymentLines,
          },
        ],
        { session },
      );

      const licenceTypes = await LicenceTypeModel.find().sort({ sortOrder: 1 }).session(session);
      if (licenceTypes.length === 0) {
        throw new HttpError(409, "No licence types are configured — add at least one under Admin › Licence Types before signing an MOU");
      }
      await LicenceModel.create(
        licenceTypes.map((type) => ({
          projectId: project._id,
          licenceTypeId: type._id,
          bundle: type.get("bundle"),
          authority: type.get("authority"),
          scope: type.get("scope") ?? null,
          status: "NOT_STARTED",
          visits: [],
          queries: [],
          // Every statutory approval should ideally be in hand before
          // commissioning — the MOU's own real date, not an invented offset.
          targetDate: mou.get("targetCommissioningDate"),
        })),
        // ordered: true is required by Mongoose when create() is given a
        // session and more than one document; without it the whole sign
        // transaction throws and rolls back.
        { session, ordered: true },
      );

      await InvoiceModel.create(
        [
          {
            projectId: project._id,
            mouId: mou._id,
            paymentScheduleId: schedule._id,
            number: invoiceNumber,
            clientName: lead.get("companyName"),
            kind: InvoiceKind.TAX_INVOICE,
            status: InvoiceStatus.TAX_INVOICE_ISSUED,
            placeOfSupply: place,
            taxablePaise: feePaise,
            cgstPaise: tax.cgstPaise,
            sgstPaise: tax.sgstPaise,
            igstPaise: tax.igstPaise,
            retentionPaise: 0,
            advanceRecoveredPaise: 0,
            totalPaise,
          },
        ],
        { session },
      );

      mou.set("status", MouStatus.SIGNED);
      mou.set("projectId", project._id);
      applyActor(mou, actorId, "mou_signed");
      signed = await mou.save({ session });

      const stage = String(lead.get("stage"));
      if (stage === LeadStage.MOU) {
        assertTransition("lead", stage, LeadStage.WON);
        lead.set("stage", LeadStage.WON);
        applyActor(lead, actorId, "status_transition");
        await lead.save({ session });
      }

      await writeAudit(
        {
          actorId: actorId ? new mongoose.Types.ObjectId(actorId) : undefined,
          action: "mou_signed_spinup",
          entityType: "Mou",
          entityId: mou._id as mongoose.Types.ObjectId,
          before: { status: fromStatus },
          after: { status: MouStatus.SIGNED, projectId: project._id },
        },
        session,
      );
    });

    // A side effect of the now-committed spin-up, not part of the
    // transaction itself — notifyUsers never throws. Only
    // `projectManagerUserId` exists on Project today (see the note above);
    // siteEngineerId/liaisonOfficerId are not real fields on this model and
    // are not invented here just to have something to notify.
    if (notifyProjectId && notifyProjectManagerId) {
      await notifyUsers([notifyProjectManagerId], {
        eventType: NotificationEventType.PROJECT_MANAGER_ASSIGNED,
        entityType: NotificationEntityType.PROJECT,
        entityId: notifyProjectId,
        actorUserId: actorId ?? null,
        title: "You were assigned as Project Manager",
        message: notifyCompanyName ?? "A new project was created.",
      });
    }

    return signed ?? (await getMou(id));
  } finally {
    await session.endSession();
  }
}
