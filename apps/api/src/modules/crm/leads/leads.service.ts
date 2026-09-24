import {
  ActivityParentType,
  computeQualificationScore,
  DEFAULT_LEAD_TEMPERATURE,
  LeadStage,
  NEW_LEAD_STAGE,
  nextStates,
  QualificationDecision,
  type LeadInboxSummaryDto,
} from "@methanova/shared-types";
import mongoose from "mongoose";
import { config } from "../../../config/index.js";
import { nextSequence } from "../../../core/counters/index.js";
import { assertTransition } from "../../../core/state-machine/index.js";
import { applyActor, writeAudit } from "../../../db/plugins/audit.plugin.js";
import {
  DistrictModel,
  FeedstockTypeModel,
  LeadSourceModel,
  QualificationCriterionModel,
  StateModel,
  TalukaModel,
  VillageModel,
} from "../../admin/master-data/geography.model.js";
import { HttpError } from "../../../utils/http.js";
import { ActivityModel } from "../activities/activities.model.js";
import { classifyFollowUp } from "../activities/activities.service.js";
import { LeadModel } from "./leads.model.js";
import type { LeadSourceMixDto, ListLeadsQuery, QualificationTallyDto } from "./leads.types.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

/**
 * Each level must actually belong to the one above it. Without this a client
 * could pair a Kutch taluka with an Ahmedabad district and the record would
 * look plausible forever.
 */
async function assertGeographyChain(input: {
  stateId: string;
  districtId: string;
  talukaId: string;
  villageId?: string | null;
}): Promise<void> {
  const state = await StateModel.findById(input.stateId);
  if (!state) throw new HttpError(400, "Unknown state");

  const district = await DistrictModel.findById(input.districtId);
  if (!district) throw new HttpError(400, "Unknown district");
  if (String(district.get("stateId")) !== String(state._id)) {
    throw new HttpError(400, "District does not belong to the selected state");
  }

  const taluka = await TalukaModel.findById(input.talukaId);
  if (!taluka) throw new HttpError(400, "Unknown taluka");
  if (String(taluka.get("districtId")) !== String(district._id)) {
    throw new HttpError(400, "Taluka does not belong to the selected district");
  }

  if (input.villageId) {
    const village = await VillageModel.findById(input.villageId);
    if (!village) throw new HttpError(400, "Unknown village");
    if (String(village.get("talukaId")) !== String(taluka._id)) {
      throw new HttpError(400, "Village does not belong to the selected taluka");
    }
  }
}

export interface ExpectedCbgResult {
  expectedCbgTpd: number;
  /** Types the caller selected that have no yield factor configured yet. */
  unconfiguredTypes: { id: string; label: string }[];
}

/**
 * The arithmetic on its own, so the feedstock admin screen can recompute a
 * whole batch of leads from one in-memory factor map without re-querying the
 * types per lead — and cannot drift from what intake stores.
 */
export function expectedCbgFromFactors(
  factors: (number | null | undefined)[],
  feedstockQtyTpd: number,
): number {
  const factorSum = factors.reduce<number>((sum, factor) => sum + (Number(factor) || 0), 0);
  // Two decimals: this is a sales-stage estimate, not an engineering figure.
  return Math.round(factorSum * feedstockQtyTpd * 100) / 100;
}

/**
 * expectedCbgTpd = Σ(yieldFactor) × qty. A selected type with no configured
 * factor contributes nothing and is reported back by name, so the UI can show
 * an em dash instead of a number that silently understates the estimate.
 */
export async function computeExpectedCbg(
  feedstockTypeIds: string[],
  feedstockQtyTpd: number,
): Promise<ExpectedCbgResult> {
  if (feedstockTypeIds.length === 0) {
    return { expectedCbgTpd: 0, unconfiguredTypes: [] };
  }
  const types = await FeedstockTypeModel.find({ _id: { $in: feedstockTypeIds } })
    .select("label yieldFactor")
    .lean();

  const unconfiguredTypes = types
    .filter((type) => type.yieldFactor === null || type.yieldFactor === undefined)
    .map((type) => ({ id: String(type._id), label: String(type.label) }));

  const expectedCbgTpd = expectedCbgFromFactors(
    types.map((type) => type.yieldFactor as number | null),
    feedstockQtyTpd,
  );

  return { expectedCbgTpd, unconfiguredTypes };
}

/**
 * Reference fields must be cast here rather than left as strings.
 * `Model.find()` casts a filter through the schema and would match either way,
 * but `Model.aggregate()` does not — a raw string in a `$match` against an
 * ObjectId field silently matches nothing. Since this filter now feeds both,
 * an uncast id produced a summary total of ₹0 for a perfectly valid source
 * filter: no error, no empty state, just a wrong number next to correct rows.
 *
 * An unparseable id yields a value nothing can match, which is the honest
 * outcome for a filter that names a record that cannot exist.
 */
function toObjectId(value: string): mongoose.Types.ObjectId | null {
  return mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : null;
}

/**
 * The one place the inbox's filter set is translated into a Mongo query.
 * Extracted because the summary now has to describe *the same* result set the
 * table is showing — a total value computed over a different filter than the
 * rows beneath it would be worse than no total at all.
 */
export function buildLeadFilter(query: ListLeadsQuery): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  if (query.search) {
    // Regex rather than $text so partial codes ("LEAD-000") match as typed.
    const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(escaped, "i");
    filter.$or = [{ companyName: pattern }, { leadCode: pattern }];
  }
  if (query.stage) filter.stage = query.stage;
  if (query.temperature) filter.temperature = query.temperature;
  if (query.leadSourceId) filter.leadSourceId = toObjectId(query.leadSourceId);
  if (query.districtId) filter.districtId = toObjectId(query.districtId);
  if (query.ownerUserId) filter.ownerUserId = toObjectId(query.ownerUserId);
  if (query.unassigned) filter.ownerUserId = null;
  if (query.noFirstResponse) filter.firstResponseAt = null;
  if (query.overdueNextAction) filter.nextActionDate = { $lt: startOfToday() };
  if (query.arrivedToday) filter.createdAt = { $gte: startOfToday() };

  return filter;
}

export async function listLeads(query: ListLeadsQuery) {
  const filter = buildLeadFilter(query);

  const sortMap: Record<string, Record<string, 1 | -1>> = {
    oldest: { createdAt: 1 },
    newest: { createdAt: -1 },
    nextActionDate: { nextActionDate: 1 },
    companyName: { companyName: 1 },
  };

  const [rows, total] = await Promise.all([
    LeadModel.find(filter)
      .sort(sortMap[query.sort])
      .skip((query.page - 1) * query.pageSize)
      .limit(query.pageSize)
      .populate("stateId", "name")
      .populate("districtId", "name")
      .populate("leadSourceId", "label")
      .populate("ownerUserId", "name email")
      .lean(),
    LeadModel.countDocuments(filter),
  ]);

  const now = Date.now();
  const items = rows.map((row) => {
    const createdAt = new Date(row.createdAt as Date);
    const daysWaiting = Math.max(0, Math.floor((now - createdAt.getTime()) / DAY_MS));
    const stageSince = row.stageSince ? new Date(row.stageSince as Date) : createdAt;
    const parked = row.parked as { isParked?: boolean } | null;
    return {
      id: String(row._id),
      leadCode: row.leadCode,
      companyName: row.companyName,
      stage: row.stage,
      temperature: row.temperature,
      stateName: (row.stateId as { name?: string } | null)?.name ?? null,
      districtName: (row.districtId as { name?: string } | null)?.name ?? null,
      sourceName: (row.leadSourceId as { label?: string } | null)?.label ?? null,
      feedstockQtyTpd: row.feedstockQtyTpd,
      expectedCbgTpd: row.expectedCbgTpd,
      // Null stays null all the way to the cell, which renders an em dash. A
      // `?? 0` here would turn "not priced" into "worth nothing".
      indicativeValuePaise: (row.indicativeValuePaise as number | null) ?? null,
      ownerUserId: row.ownerUserId ? String((row.ownerUserId as { _id: unknown })._id) : null,
      ownerName: (row.ownerUserId as { name?: string } | null)?.name ?? null,
      firstResponseAt: row.firstResponseAt ?? null,
      nextAction: row.nextAction,
      nextActionDate: row.nextActionDate,
      createdAt: row.createdAt,
      daysWaiting,
      daysInStage: Math.max(0, Math.floor((now - stageSince.getTime()) / DAY_MS)),
      isParked: Boolean(parked?.isParked),
      // A lead nobody has replied to past the threshold is the thing this
      // whole screen exists to make impossible to miss.
      slaBreached: row.firstResponseAt === null && daysWaiting >= config.leadFirstResponseSlaDays,
    };
  });

  return { items, total, page: query.page, pageSize: query.pageSize };
}

/**
 * Every number here is counted at query time — never read from a stored
 * counter that could drift.
 *
 * The groups have deliberately different scopes:
 *
 * - `unassigned`, `noFirstResponse` and `arrivedToday` are **whole-collection**
 *   counts, because each one is a *filter target* in the inbox's segmented
 *   bar. If they narrowed to the active filter, selecting "Unassigned" would
 *   make the Unassigned figure describe its own subset, and the number would
 *   stop being something to drive to zero.
 * - `open`, `openIndicativeValueTotalPaise` and `parkedDueForRevisit` are also
 *   **whole-collection** (open = not WON/LOST). The Dashboard CRM strip reads
 *   them as company pulse, not as a description of the inbox's current filter.
 * - `indicativeValueTotalPaise` and `slowestDaysWaiting` are **filtered**,
 *   because they describe what you are currently looking at. A pipeline value
 *   computed over a different set than the rows beneath it would mislead.
 *
 * `arrivedToday` and `slowestDaysWaiting` are computed here rather than in the
 * client from the returned page: the inbox sorts longest-waiting-first and
 * pages at 25, so today's arrivals sit on the *last* page and a client-side
 * count would read 0 on any real dataset. A number that is wrong by
 * construction is exactly what DESIGN_SYSTEM's no-fabricated-data rule forbids.
 */
export async function getInboxSummary(query: ListLeadsQuery): Promise<LeadInboxSummaryDto> {
  const filter = buildLeadFilter(query);

  // `deletedAt: null` is explicit on every count and aggregate here: the
  // soft-delete plugin hooks `/^find/`, which `countDocuments` and
  // `aggregate` are not, so a removed lead would otherwise still be counted.
  const openMatch = {
    stage: { $nin: [LeadStage.WON, LeadStage.LOST] },
    deletedAt: null,
  };
  const tomorrow = startOfToday();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [unassigned, noFirstResponse, arrivedToday, open, parkedDueForRevisit, openValueAgg, valueAgg, oldest] =
    await Promise.all([
      LeadModel.countDocuments({ ownerUserId: null, deletedAt: null }),
      LeadModel.countDocuments({ firstResponseAt: null, deletedAt: null }),
      LeadModel.countDocuments({ createdAt: { $gte: startOfToday() }, deletedAt: null }),
      LeadModel.countDocuments(openMatch),
      LeadModel.countDocuments({
        "parked.isParked": true,
        "parked.revisitDate": { $lt: tomorrow },
        deletedAt: null,
      }),
      LeadModel.aggregate<{ total: number }>([
        { $match: openMatch },
        { $group: { _id: null, total: { $sum: { $ifNull: ["$indicativeValuePaise", 0] } } } },
        { $project: { _id: 0, total: 1 } },
      ]),
      LeadModel.aggregate<{ total: number }>([
        { $match: { ...filter, deletedAt: null } },
        { $group: { _id: null, total: { $sum: { $ifNull: ["$indicativeValuePaise", 0] } } } },
        { $project: { _id: 0, total: 1 } },
      ]),
      LeadModel.find(filter).sort({ createdAt: 1 }).select("createdAt").limit(1).lean(),
    ]);

  const oldestCreatedAt = oldest[0]?.createdAt as Date | undefined;

  return {
    unassigned,
    noFirstResponse,
    arrivedToday,
    open,
    openIndicativeValueTotalPaise: openValueAgg[0]?.total ?? 0,
    parkedDueForRevisit,
    // Summing nulls as 0 is correct *for a total* — an unpriced lead adds
    // nothing. That is not the same as displaying it as ₹0, which the row
    // renderer still refuses to do.
    indicativeValueTotalPaise: valueAgg[0]?.total ?? 0,
    slowestDaysWaiting: oldestCreatedAt
      ? Math.max(0, Math.floor((Date.now() - new Date(oldestCreatedAt).getTime()) / DAY_MS))
      : 0,
  };
}

/**
 * Two thin aggregations for the inbox's own charts. They are deliberately
 * narrow: counts by source and tallies by criterion, nothing else.
 * Stage-conversion, loss-analysis and geography breakdowns belong to the full
 * CRM Reports feature and are not started here — see MODULE_MAP.md.
 */
const SOURCE_MIX_WINDOW_DAYS = 90;

export async function getSourceMix(): Promise<LeadSourceMixDto> {
  const since = new Date(Date.now() - SOURCE_MIX_WINDOW_DAYS * DAY_MS);

  const rows = await LeadModel.aggregate<{ _id: unknown; count: number }>([
    { $match: { createdAt: { $gte: since }, deletedAt: null } },
    { $group: { _id: "$leadSourceId", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  // Resolve labels from the master rows rather than storing them on the lead:
  // renaming a source in the admin screen should rename it here too.
  const sources = await LeadSourceModel.find().select("label").lean();
  const labelById = new Map(sources.map((source) => [String(source._id), String(source.label)]));

  return {
    windowDays: SOURCE_MIX_WINDOW_DAYS,
    totalLeads: rows.reduce((sum, row) => sum + row.count, 0),
    items: rows.map((row) => ({
      leadSourceId: String(row._id),
      label: labelById.get(String(row._id)) ?? "Unknown source",
      count: row.count,
    })),
  };
}

/**
 * Per-criterion tallies over every recorded qualification, scored exactly the
 * way QualifyLeadModal scores: a 0 means "not assessed" and is excluded from
 * both the count and the average rather than dragging it down. That is the
 * same exclusion `computeQualificationScore` applies, so this chart and the
 * scores it summarises cannot tell different stories.
 */
export async function getCriteriaTally(): Promise<QualificationTallyDto> {
  const rows = await LeadModel.aggregate<{ _id: string; assessedCount: number; averageScore: number }>([
    { $match: { "qualification.scores.0": { $exists: true }, deletedAt: null } },
    { $unwind: "$qualification.scores" },
    { $match: { "qualification.scores.score": { $gt: 0 } } },
    {
      $group: {
        _id: "$qualification.scores.criterionKey",
        assessedCount: { $sum: 1 },
        averageScore: { $avg: "$qualification.scores.score" },
      },
    },
  ]);

  const criteria = await QualificationCriterionModel.find().sort({ sortOrder: 1, label: 1 }).select("key label").lean();
  const tallyByKey = new Map(rows.map((row) => [row._id, row]));

  // Same `deletedAt: null` as the aggregate above — otherwise the denominator
  // would count soft-deleted leads the numerator has already excluded.
  const leadsScored = await LeadModel.countDocuments({
    "qualification.scores.0": { $exists: true },
    deletedAt: null,
  });

  // Driven by the criteria list, not by what happens to have scores, so a
  // criterion nobody has assessed yet shows as an honest empty bar rather
  // than vanishing from the chart.
  return {
    leadsScored,
    items: criteria.map((criterion) => {
      const tally = tallyByKey.get(String(criterion.key));
      return {
        criterionKey: String(criterion.key),
        label: String(criterion.label),
        assessedCount: tally?.assessedCount ?? 0,
        averageScore: tally ? Math.round(tally.averageScore * 10) / 10 : 0,
      };
    }),
  };
}

export async function getLead(id: string) {
  const doc = await LeadModel.findById(id)
    .populate("stateId", "name")
    .populate("districtId", "name")
    .populate("talukaId", "name")
    .populate("villageId", "name")
    .populate("leadSourceId", "key label")
    .populate("feedstockTypeIds", "key label yieldFactor")
    .populate("ownerUserId", "name email")
    .populate("nextActionSourceActivityId", "sequenceNo type occurredAt")
    .populate("nextActionPromisedByUserId", "name email");
  if (!doc) throw new HttpError(404, "Lead not found");
  return doc;
}

/**
 * The detail page's own view of a lead: everything `getLead` already
 * resolves, plus figures that only make sense computed at read time —
 * age, days in the current stage, how many follow-ups have actually been
 * logged (so the UI can say "3 follow-ups done" and label its button "Log
 * follow-up 4"), and how many of those follow-ups broke their own promise.
 *
 * Kept separate from `getLead` rather than folded into it: every other
 * caller of `getLead` (contacts, transitions, park/unpark, qualify) wants the
 * live document to mutate and save, not a read-only snapshot with derived
 * fields bolted on — computing `activitiesLoggedCount` on every one of those
 * writes would be wasted work they never asked for.
 */
export async function getLeadDetail(id: string) {
  const doc = await getLead(id);
  const createdAt = doc.get("createdAt") as Date;
  const stageSince = doc.get("stageSince") as Date;

  const activities = await ActivityModel.find({ parentType: ActivityParentType.LEAD, parentId: doc._id })
    .sort({ sequenceNo: 1 })
    .select("occurredAt nextFollowUpDate")
    .lean();

  // Broken exactly as classifyFollowUp defines it: this activity promised a
  // date, and the *next* activity on this lead landed after it. The most
  // recent activity's own promise is excluded on purpose — with nothing yet
  // to answer it, it is a live commitment (what nextActionDate tracks), not
  // a broken one.
  let brokenPromiseCount = 0;
  for (let i = 0; i < activities.length - 1; i += 1) {
    const promised = activities[i].nextFollowUpDate as Date | null;
    if (promised && classifyFollowUp(promised, activities[i + 1].occurredAt as Date) === "BROKEN") {
      brokenPromiseCount += 1;
    }
  }

  return {
    ...doc.toObject(),
    ageDays: Math.max(0, Math.floor((Date.now() - createdAt.getTime()) / DAY_MS)),
    daysInStage: Math.max(0, Math.floor((Date.now() - stageSince.getTime()) / DAY_MS)),
    activitiesLoggedCount: activities.length,
    brokenPromiseCount,
  };
}

/** Non-blocking duplicate hint for the intake form — case-insensitive exact-ish match on name. */
export async function findDuplicatesByName(companyName: string) {
  const escaped = companyName.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!escaped) return [];
  return LeadModel.find({ companyName: new RegExp(`^${escaped}$`, "i") })
    .select("leadCode companyName stage")
    .limit(5)
    .lean();
}

export async function createLead(payload: Record<string, unknown>, actorId?: string) {
  const input = payload as {
    stateId: string;
    districtId: string;
    talukaId: string;
    villageId?: string | null;
    leadSourceId: string;
    sourceDetail?: string;
    feedstockTypeIds: string[];
    feedstockQtyTpd: number;
  };

  await assertGeographyChain(input);

  const source = await LeadSourceModel.findById(input.leadSourceId);
  if (!source) throw new HttpError(400, "Unknown lead source");

  // The master row is the only authority. This used to OR the row flag with a
  // hardcoded key list, which meant an admin could untick "detail required"
  // on a source and the server would quietly keep enforcing it — and the
  // intake form, which reads the row alone, would disagree with the server.
  const detailRequired = Boolean(source.get("detailRequired"));
  if (detailRequired && !input.sourceDetail) {
    throw new HttpError(400, `${source.get("label")} requires source detail`);
  }

  const { expectedCbgTpd } = await computeExpectedCbg(input.feedstockTypeIds, input.feedstockQtyTpd);

  const seq = await nextSequence(config.leadCodePrefix);
  const leadCode = `${config.leadCodePrefix}-${String(seq).padStart(5, "0")}`;

  const doc = new LeadModel({
    ...payload,
    leadCode,
    stage: NEW_LEAD_STAGE,
    stageSince: new Date(),
    temperature: DEFAULT_LEAD_TEMPERATURE,
    ownerUserId: null,
    firstResponseAt: null,
    expectedCbgTpd,
  });

  applyActor(doc, actorId, "lead_created");
  return doc.save();
}

export async function updateLead(id: string, payload: Record<string, unknown>, actorId?: string) {
  const doc = await getLead(id);
  Object.assign(doc, payload);

  // A manual reschedule through this general PATCH is not "promised at an
  // activity" any more — the commitment card's provenance line would
  // otherwise keep pointing at whichever follow-up last set it, crediting
  // that activity for a date it never actually promised.
  if ("nextAction" in payload || "nextActionDate" in payload) {
    doc.set("nextActionSourceActivityId", null);
    doc.set("nextActionPromisedAt", null);
    doc.set("nextActionPromisedByUserId", null);
  }

  // Either input changing invalidates the stored estimate, so recompute from
  // whatever the document now holds rather than from the patch alone.
  if ("feedstockTypeIds" in payload || "feedstockQtyTpd" in payload) {
    const { expectedCbgTpd } = await computeExpectedCbg(
      (doc.get("feedstockTypeIds") as unknown[]).map((value) => String((value as { _id?: unknown })?._id ?? value)),
      Number(doc.get("feedstockQtyTpd")),
    );
    doc.set("expectedCbgTpd", expectedCbgTpd);
  }

  applyActor(doc, actorId, "update");
  return doc.save();
}

export async function softDeleteLead(id: string, actorId?: string) {
  const doc = await getLead(id);
  return doc.softDelete(actorId);
}

export interface ContactInput {
  name: string;
  designation?: string;
  mobile: string;
  email?: string;
  isPrimary: boolean;
  isDecisionMaker: boolean;
}

/**
 * Replaces the whole contacts array. The one-primary rule is a property of the
 * collection, not of any single row, so a per-contact endpoint could not
 * enforce it without reading its siblings anyway — the replacement array is
 * both simpler and the only shape the rule can be checked against.
 *
 * The audit entry carries the full before and after array rather than a diff:
 * "who was the primary contact in March" is the question this gets asked, and
 * a diff would make answering it a replay exercise.
 */
export async function updateLeadContacts(id: string, contacts: ContactInput[], actorId?: string) {
  const doc = await getLead(id);
  const before = doc.get("contacts") as unknown[];

  doc.set("contacts", contacts);
  applyActor(doc, actorId, "lead_contacts_updated");
  await doc.save();

  await writeAudit({
    actorId: actorId ? new mongoose.Types.ObjectId(actorId) : undefined,
    action: "lead_contacts_updated",
    entityType: "Lead",
    entityId: doc._id as mongoose.Types.ObjectId,
    before: { contacts: JSON.parse(JSON.stringify(before)) as unknown },
    after: { contacts },
  });

  return getLead(id);
}

export interface TransitionExtras {
  reason?: string;
  /** Both only apply to the LOST move; ignored on any other target. */
  competitor?: string;
  reengageOn?: Date | null;
}

export async function transitionLead(
  id: string,
  to: string,
  actorId?: string,
  extras: TransitionExtras = {},
) {
  const doc = await getLead(id);
  const from = String(doc.get("stage"));
  assertTransition("lead", from, to);

  const reason = extras.reason?.trim();

  // A lead can only be lost for a reason, and that reason is the most useful
  // thing about the record afterwards. The competitor and the re-engagement
  // date ride along on the same move rather than through a separate "mark
  // dead" endpoint: moving the rail to LOST *is* the dead exit, and a second
  // endpoint would mean two ways to record the same event.
  if (to === LeadStage.LOST) {
    if (!reason) {
      throw new HttpError(400, "A reason is required when marking a lead lost");
    }
    doc.set("lostReason", reason);
    if (extras.competitor?.trim()) doc.set("competitor", extras.competitor.trim());
    if (extras.reengageOn) doc.set("reengageOn", extras.reengageOn);
  }

  doc.set("stage", to);
  doc.set("stageSince", new Date());
  applyActor(doc, actorId, "status_transition");
  await doc.save();

  await writeAudit({
    actorId: actorId ? new mongoose.Types.ObjectId(actorId) : undefined,
    action: "lead_stage_transition",
    entityType: "Lead",
    entityId: doc._id as mongoose.Types.ObjectId,
    before: { stage: from },
    after: {
      stage: to,
      reason: reason ?? null,
      competitor: to === LeadStage.LOST ? extras.competitor?.trim() ?? null : null,
      reengageOn: to === LeadStage.LOST ? extras.reengageOn ?? null : null,
    },
  });

  return doc;
}

/**
 * Parking is orthogonal to the stage — see the comment on `parkedSchema`. The
 * lead stays exactly where it is on the rail; only this sub-document changes.
 *
 * Terminal leads cannot be parked. Parking is a promise to come back, and
 * there is nothing to come back to on a lead that is already won or lost.
 */
export async function parkLead(
  id: string,
  input: { reason: string; revisitDate: Date },
  actorId?: string,
) {
  const doc = await getLead(id);

  if ((doc.get("parked") as { isParked?: boolean } | null)?.isParked) {
    throw new HttpError(409, "This lead is already parked");
  }
  const stage = String(doc.get("stage"));
  if (nextStates("lead", stage).length === 0) {
    throw new HttpError(409, `A ${stage.replace(/_/g, " ").toLowerCase()} lead cannot be parked`);
  }

  const parked = {
    isParked: true,
    reason: input.reason.trim(),
    revisitDate: input.revisitDate,
    parkedFromStage: stage,
    parkedAt: new Date(),
  };
  doc.set("parked", parked);
  applyActor(doc, actorId, "lead_parked");
  await doc.save();

  await writeAudit({
    actorId: actorId ? new mongoose.Types.ObjectId(actorId) : undefined,
    action: "lead_parked",
    entityType: "Lead",
    entityId: doc._id as mongoose.Types.ObjectId,
    before: { parked: null },
    after: { parked },
  });

  return doc;
}

/**
 * Unparking clears the sub-document and nothing else. There is no stage to
 * restore because the stage never moved — `parkedFromStage` is recorded so the
 * audit trail can answer "where was this when we shelved it", and so a drift
 * between then and now is visible rather than silently overwritten.
 */
export async function unparkLead(id: string, actorId?: string) {
  const doc = await getLead(id);
  const before = doc.get("parked") as { isParked?: boolean; parkedFromStage?: string } | null;

  if (!before?.isParked) {
    throw new HttpError(409, "This lead is not parked");
  }

  doc.set("parked", null);
  applyActor(doc, actorId, "lead_unparked");
  await doc.save();

  await writeAudit({
    actorId: actorId ? new mongoose.Types.ObjectId(actorId) : undefined,
    action: "lead_unparked",
    entityType: "Lead",
    entityId: doc._id as mongoose.Types.ObjectId,
    before: { parked: JSON.parse(JSON.stringify(before)) as unknown },
    after: { parked: null, resumedAtStage: String(doc.get("stage")) },
  });

  return doc;
}

/**
 * Qualification is one operation with two consequences: the assessment is
 * recorded and the lead moves. They go in a transaction because a lead shown
 * as QUALIFICATION with no qualification attached — or scored but still
 * sitting in ENQUIRY — is worse than neither.
 *
 * The score is computed here from the stored criteria weights; the client's
 * preview is advisory and never trusted. The decision itself stays human:
 * the threshold produces a recommendation, not an automatic verdict.
 */
export async function qualifyLead(
  id: string,
  input: {
    scores: { criterionKey: string; score: number; note?: string }[];
    decision: QualificationDecision;
    disqualificationReason?: string;
    budgetMinPaise?: number | null;
    budgetMaxPaise?: number | null;
  },
  actorId?: string,
) {
  const criteria = await QualificationCriterionModel.find().select("key weight").lean();
  const knownKeys = new Set(criteria.map((criterion) => String(criterion.key)));
  const unknown = input.scores.find((entry) => !knownKeys.has(entry.criterionKey));
  if (unknown) {
    throw new HttpError(400, `Unknown qualification criterion: ${unknown.criterionKey}`);
  }

  if (input.decision === QualificationDecision.DISQUALIFIED && !input.disqualificationReason?.trim()) {
    throw new HttpError(400, "A reason is required when disqualifying a lead");
  }

  const totalScore = computeQualificationScore(
    input.scores,
    criteria.map((criterion) => ({ key: String(criterion.key), weight: Number(criterion.weight) })),
  );

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const lead = await LeadModel.findById(id).session(session);
      if (!lead) throw new HttpError(404, "Lead not found");

      const from = String(lead.get("stage"));
      const to =
        input.decision === QualificationDecision.QUALIFIED ? LeadStage.QUALIFICATION : LeadStage.LOST;
      // Still routed through the state machine — qualification is not a licence
      // to make an illegal jump.
      assertTransition("lead", from, to);

      lead.set("qualification", {
        scores: input.scores,
        totalScore,
        decision: input.decision,
        decidedAt: new Date(),
        decidedByUserId: actorId ?? null,
        disqualificationReason: input.disqualificationReason?.trim() ?? null,
        // `?? null` rather than omitting: the whole sub-document is replaced
        // here, so an absent key would silently drop a band recorded earlier.
        budgetMinPaise: input.budgetMinPaise ?? null,
        budgetMaxPaise: input.budgetMaxPaise ?? null,
      });
      lead.set("stage", to);
      lead.set("stageSince", new Date());
      if (to === LeadStage.LOST) {
        lead.set("lostReason", input.disqualificationReason?.trim() ?? null);
      }

      applyActor(lead, actorId, "lead_qualified");
      result = await lead.save({ session });

      await writeAudit(
        {
          actorId: actorId ? new mongoose.Types.ObjectId(actorId) : undefined,
          action: "lead_qualified",
          entityType: "Lead",
          entityId: lead._id as mongoose.Types.ObjectId,
          before: { stage: from, qualification: null },
          after: { stage: to, decision: input.decision, totalScore },
        },
        session,
      );
    });
    return result;
  } finally {
    await session.endSession();
  }
}

export { mongoose };
