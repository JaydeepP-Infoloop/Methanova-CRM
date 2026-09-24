import { ActivityParentType, ActivityType, countsAsFirstResponse } from "@methanova/shared-types";
import mongoose from "mongoose";
import { nextSequence } from "../../../core/counters/index.js";
import { applyActor, writeAudit } from "../../../db/plugins/audit.plugin.js";
import { HttpError } from "../../../utils/http.js";
import { LeadModel } from "../leads/leads.model.js";
import { ActivityModel } from "./activities.model.js";
import type { ListActivitiesQuery } from "./activities.types.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const VISIT_TYPES = [ActivityType.PLANT_VISIT, ActivityType.SITE_VISIT];

function startOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

export async function listLeadActivities(leadId: string, limit = 100) {
  return ActivityModel.find({ parentType: ActivityParentType.LEAD, parentId: leadId })
    .sort({ occurredAt: -1, sequenceNo: -1 })
    .limit(limit)
    .populate("internalParticipantIds", "name email")
    .lean();
}

/**
 * A promise is "kept" when the activity that answered it happened on or
 * before the date it promised, "broken" when that activity landed later.
 * Shared by the flat Activity Log's per-row outcome and the lead detail's
 * `brokenPromiseCount` so the two can never disagree about what counts as
 * broken.
 */
export function classifyFollowUp(promisedDate: Date, answeredAt: Date | undefined): "PENDING" | "KEPT" | "BROKEN" {
  if (!answeredAt) return "PENDING";
  return new Date(answeredAt) > new Date(promisedDate) ? "BROKEN" : "KEPT";
}

/**
 * Reference fields must be cast for the same reason leads.service.ts casts
 * them before an aggregate: `Model.find()` casts a filter through the schema,
 * but a raw string compared against an ObjectId field in other query shapes
 * can silently match nothing.
 */
function toObjectId(value: string): mongoose.Types.ObjectId | null {
  return mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : null;
}

function buildActivityFilter(query: ListActivitiesQuery): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  if (query.type && query.type.length > 0) filter.type = { $in: query.type };
  if (query.parentType) filter.parentType = query.parentType;
  if (query.leadId) filter.parentId = toObjectId(query.leadId);
  if (query.loggedByUserId) filter.loggedByUserId = toObjectId(query.loggedByUserId);
  if (query.dateFrom || query.dateTo) {
    const occurredAt: Record<string, Date> = {};
    if (query.dateFrom) occurredAt.$gte = query.dateFrom;
    if (query.dateTo) occurredAt.$lte = query.dateTo;
    filter.occurredAt = occurredAt;
  }
  if (query.hasFollowUp) filter.nextFollowUpDate = { $ne: null };
  if (query.overdueFollowUp) filter.nextFollowUpDate = { $lt: startOfToday() };
  return filter;
}

/**
 * The flat, cross-lead Activity Log. What the old scaffold's bare
 * `find().sort().limit()` could not do: real filters, real pagination (the
 * old version silently truncated at `limit` with no `total` and no way to see
 * page two — an audit-grade log that cannot be paged through is not really an
 * audit-grade log), and a summary that describes exactly the filtered set,
 * the same rule `getInboxSummary` established for leads.
 */
export async function listActivities(query: ListActivitiesQuery) {
  const filter = buildActivityFilter(query);

  const [rows, total] = await Promise.all([
    ActivityModel.find(filter)
      .sort({ occurredAt: -1, sequenceNo: -1 })
      .skip((query.page - 1) * query.pageSize)
      .limit(query.pageSize)
      .populate("internalParticipantIds", "name email")
      .populate("loggedByUserId", "name")
      .lean(),
    ActivityModel.countDocuments(filter),
  ]);

  // Denormalise companyName/leadCode onto each row with one extra query
  // rather than a populate per row, so the web page stops resolving these
  // labels itself against a second, unpaginated fetch of every lead.
  const leadIds = [
    ...new Set(
      rows.filter((row) => row.parentType === ActivityParentType.LEAD).map((row) => String(row.parentId)),
    ),
  ];
  const leads = leadIds.length
    ? await LeadModel.find({ _id: { $in: leadIds } }).select("leadCode companyName").lean()
    : [];
  const leadById = new Map(leads.map((lead) => [String(lead._id), lead]));

  // Follow-up outcomes need each row's own lead's full sequence, not just the
  // current page, so "kept or broken" is resolved with one grouped query
  // rather than per-row — the answering activity may not be on this page,
  // or may even be filtered out of it entirely.
  const siblingRows = leadIds.length
    ? await ActivityModel.find({ parentType: ActivityParentType.LEAD, parentId: { $in: leadIds } })
        .select("parentId sequenceNo occurredAt")
        .lean()
    : [];
  const siblingsByLead = new Map<string, { sequenceNo: number; occurredAt: Date }[]>();
  for (const sibling of siblingRows) {
    const key = String(sibling.parentId);
    const list = siblingsByLead.get(key) ?? [];
    list.push({ sequenceNo: sibling.sequenceNo, occurredAt: sibling.occurredAt as Date });
    siblingsByLead.set(key, list);
  }
  for (const list of siblingsByLead.values()) list.sort((a, b) => a.sequenceNo - b.sequenceNo);

  const items = rows.map((row) => {
    const lead = row.parentType === ActivityParentType.LEAD ? leadById.get(String(row.parentId)) : undefined;
    const nextFollowUpDate = row.nextFollowUpDate as Date | null;
    const answeringActivity = nextFollowUpDate
      ? siblingsByLead.get(String(row.parentId))?.find((sibling) => sibling.sequenceNo > row.sequenceNo)
      : undefined;

    return {
      id: String(row._id),
      parentType: row.parentType,
      parentId: String(row.parentId),
      leadCode: lead?.leadCode ?? null,
      companyName: lead?.companyName ?? null,
      sequenceNo: row.sequenceNo,
      type: row.type,
      occurredAt: row.occurredAt,
      loggedByUserId: row.loggedByUserId ? String((row.loggedByUserId as { _id: unknown })._id) : null,
      loggedByUserName: (row.loggedByUserId as { name?: string } | null)?.name ?? null,
      internalParticipants: (row.internalParticipantIds as { _id: unknown; name: string }[]).map((user) => ({
        id: String(user._id),
        name: user.name,
      })),
      externalContactNames: row.externalContactNames,
      summary: row.summary,
      outcomeCategory: row.outcomeCategory,
      outcome: row.outcome,
      nextFollowUpDate: row.nextFollowUpDate,
      nextFollowUpAction: row.nextFollowUpAction,
      followUpOutcome: nextFollowUpDate ? classifyFollowUp(nextFollowUpDate, answeringActivity?.occurredAt) : null,
    };
  });

  // The summary is scoped to the same filter as the rows above it — the same
  // rule getInboxSummary follows, so the KPI strip never describes a
  // different set of activities than the table beneath it. `type` is
  // deliberately dropped for the calls/visits/emails breakdown: it answers
  // "what's the mix", which is a meaningless question once you have already
  // filtered down to one type. `occurredAt` is dropped for the rolling-7-days
  // count for the same reason — "logged this week" is its own window, not the
  // filter bar's date range intersected with one.
  const { type: _typeFilter, occurredAt: _occurredAtFilter, ...filterWithoutTypeOrDate } = filter;
  const since = new Date(Date.now() - 7 * DAY_MS);
  const [loggedThisWeek, calls, visits, emails, followUpsCommitted, promisesOverdue] = await Promise.all([
    ActivityModel.countDocuments({ ...filterWithoutTypeOrDate, occurredAt: { $gte: since } }),
    ActivityModel.countDocuments({ ...filterWithoutTypeOrDate, type: ActivityType.CALL }),
    ActivityModel.countDocuments({ ...filterWithoutTypeOrDate, type: { $in: VISIT_TYPES } }),
    ActivityModel.countDocuments({ ...filterWithoutTypeOrDate, type: ActivityType.EMAIL }),
    ActivityModel.countDocuments({ ...filter, nextFollowUpDate: { $gte: startOfToday() } }),
    ActivityModel.countDocuments({ ...filter, nextFollowUpDate: { $lt: startOfToday() } }),
  ]);

  return {
    items,
    total,
    page: query.page,
    pageSize: query.pageSize,
    summary: { loggedThisWeek, calls, visits, emails, followUpsCommitted, promisesOverdue },
  };
}

/**
 * Logging an activity is three writes that must agree with each other: the
 * activity itself, the lead's first-response stamp, and the lead's next
 * commitment. If the activity saved but the lead did not, the inbox would
 * keep showing the lead as never contacted while the timeline said otherwise
 * — so they go in one replica-set transaction, like the MOU spin-up.
 */
export async function createLeadActivity(
  leadId: string,
  payload: {
    type: string;
    occurredAt: Date;
    internalParticipantIds: string[];
    externalContactNames: string[];
    summary: string;
    outcomeCategory?: string | null;
    outcome?: string;
    nextFollowUpDate?: Date | null;
    nextFollowUpAction?: string;
    plantVisit?: Record<string, unknown> | null;
    siteVisit?: Record<string, unknown> | null;
  },
  actorId?: string,
) {
  const session = await mongoose.startSession();
  try {
    let created: unknown;
    await session.withTransaction(async () => {
      const lead = await LeadModel.findById(leadId).session(session);
      if (!lead) throw new HttpError(404, "Lead not found");

      // Per-lead running number from the atomic counter, so two people
      // logging at once cannot both take "4".
      const sequenceNo = await nextSequence(`activity:${leadId}`, session);

      const [activity] = await ActivityModel.create(
        [
          {
            parentType: ActivityParentType.LEAD,
            parentId: lead._id,
            sequenceNo,
            type: payload.type,
            occurredAt: payload.occurredAt,
            loggedByUserId: actorId ?? null,
            internalParticipantIds: payload.internalParticipantIds,
            externalContactNames: payload.externalContactNames,
            summary: payload.summary,
            outcomeCategory: payload.outcomeCategory ?? null,
            outcome: payload.outcome ?? null,
            nextFollowUpDate: payload.nextFollowUpDate ?? null,
            nextFollowUpAction: payload.nextFollowUpAction ?? null,
            plantVisit: payload.plantVisit ?? null,
            siteVisit: payload.siteVisit ?? null,
          },
        ],
        { session, ordered: true },
      );
      created = activity;

      const previousFirstResponseAt = lead.get("firstResponseAt") as Date | null;
      let stampedFirstResponse = false;

      // A NOTE is internal record-keeping, not contact with the client, so it
      // must not clear the "no first response" flag.
      if (previousFirstResponseAt === null && countsAsFirstResponse(payload.type)) {
        lead.set("firstResponseAt", payload.occurredAt);
        stampedFirstResponse = true;
      }

      // The commitment made during the conversation belongs on the lead,
      // which is where the inbox and My Day read what is due. The three
      // provenance fields are written together with it, every time — a lead's
      // `nextAction` can otherwise only be traced back to AddLeadWizard, which
      // sets it at intake with no activity behind it at all, so "which
      // activity promised this" cannot be derived later by querying the
      // latest activity; it has to be recorded at the exact moment the
      // commitment changes.
      if (payload.nextFollowUpDate) {
        lead.set("nextActionDate", payload.nextFollowUpDate);
        lead.set("nextActionSourceActivityId", activity._id);
        lead.set("nextActionPromisedAt", payload.occurredAt);
        lead.set("nextActionPromisedByUserId", actorId ?? null);
        if (payload.nextFollowUpAction) {
          lead.set("nextAction", payload.nextFollowUpAction);
        }
      }

      applyActor(lead, actorId, stampedFirstResponse ? "lead_first_response" : "lead_activity_logged");
      await lead.save({ session });

      await writeAudit(
        {
          actorId: actorId ? new mongoose.Types.ObjectId(actorId) : undefined,
          action: "activity_logged",
          entityType: "Activity",
          entityId: activity._id as mongoose.Types.ObjectId,
          before: { firstResponseAt: previousFirstResponseAt },
          after: {
            leadId,
            sequenceNo,
            type: payload.type,
            firstResponseAt: lead.get("firstResponseAt"),
          },
        },
        session,
      );
    });
    return created;
  } finally {
    await session.endSession();
  }
}

/**
 * Assignment records who held the lead before and after. Reassignment history
 * is therefore queryable from the existing polymorphic audit_logs collection
 * — no separate ownership-history collection is needed.
 */
export async function assignLead(leadId: string, userId: string | null, actorId?: string) {
  const lead = await LeadModel.findById(leadId);
  if (!lead) throw new HttpError(404, "Lead not found");

  const previousOwner = lead.get("ownerUserId") as mongoose.Types.ObjectId | null;
  lead.set("ownerUserId", userId);
  applyActor(lead, actorId, previousOwner ? "lead_reassigned" : "lead_assigned");
  await lead.save();

  await writeAudit({
    actorId: actorId ? new mongoose.Types.ObjectId(actorId) : undefined,
    action: previousOwner ? "lead_reassigned" : "lead_assigned",
    entityType: "Lead",
    entityId: lead._id as mongoose.Types.ObjectId,
    before: { ownerUserId: previousOwner ? String(previousOwner) : null },
    after: { ownerUserId: userId },
  });

  return LeadModel.findById(leadId).populate("ownerUserId", "name email");
}
