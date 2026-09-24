import { ActivityParentType, LeadStage, TRANSITION_MAP, type MyDayRowDto, type MyDaySource } from "@methanova/shared-types";
import mongoose from "mongoose";
import { ActivityModel } from "../activities/activities.model.js";
import { LeadModel } from "../leads/leads.model.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function toObjectId(value: string): mongoose.Types.ObjectId | null {
  return mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : null;
}

/**
 * A stage with no legal move out of it is closed. Derived from the transition
 * map rather than hardcoding WON and LOST, so a future terminal stage cannot
 * leave this behind — same derivation feedstock.service.ts uses.
 */
const TERMINAL_LEAD_STAGES = Object.entries(TRANSITION_MAP.lead)
  .filter(([, targets]) => targets.length === 0)
  .map(([stage]) => stage);

/**
 * Unassigned leads are the Lead Inbox's concern, not My Day's — a lead nobody
 * owns cannot owe *someone* a follow-up. Scoping to "mine" further narrows to
 * one owner; "team" widens to every owned lead but never to unowned ones.
 */
function ownerFilter(scope: "mine" | "team", userId: string): Record<string, unknown> {
  return scope === "mine" ? { ownerUserId: toObjectId(userId) } : { ownerUserId: { $ne: null } };
}

interface LeadForQueue {
  _id: mongoose.Types.ObjectId;
  leadCode: string;
  companyName: string;
  temperature: string;
  stage: string;
  indicativeValuePaise: number | null;
  nextAction?: string;
  nextActionDate?: Date;
  nextActionSourceActivityId?: { sequenceNo: number } | null;
  nextActionPromisedAt?: Date | null;
  nextActionPromisedByUserId?: { _id: mongoose.Types.ObjectId; name: string } | null;
  parked?: { reason: string; revisitDate: Date } | null;
  reengageOn?: Date | null;
  competitor?: string | null;
}

function bucketNameFor(dueDate: Date, todayStart: Date, tomorrowStart: Date): "overdue" | "today" | "thisWeek" {
  if (dueDate < todayStart) return "overdue";
  if (dueDate < tomorrowStart) return "today";
  return "thisWeek";
}

function toRow(
  lead: LeadForQueue,
  source: MyDaySource,
  dueDate: Date,
  commitmentText: string,
  countByLead: Map<string, number>,
  todayStart: Date,
): MyDayRowDto {
  const provenance =
    source === "NEXT_ACTION" && lead.nextActionSourceActivityId
      ? {
          sequenceNo: lead.nextActionSourceActivityId.sequenceNo,
          promisedAt: (lead.nextActionPromisedAt as Date).toISOString(),
          promisedByUserId: lead.nextActionPromisedByUserId ? String(lead.nextActionPromisedByUserId._id) : null,
          promisedByUserName: lead.nextActionPromisedByUserId?.name ?? null,
        }
      : null;

  return {
    leadId: String(lead._id),
    leadCode: lead.leadCode,
    companyName: lead.companyName,
    temperature: lead.temperature as MyDayRowDto["temperature"],
    stage: lead.stage as MyDayRowDto["stage"],
    isParked: source === "PARKED_REVISIT",
    followUpsDoneCount: countByLead.get(String(lead._id)) ?? 0,
    indicativeValuePaise: lead.indicativeValuePaise ?? null,
    dueDate: dueDate.toISOString(),
    daysLate: Math.max(0, Math.floor((todayStart.getTime() - dueDate.getTime()) / DAY_MS)),
    source,
    commitmentText,
    provenance,
  };
}

/**
 * The per-user (or, for a Sales Head / Director, per-team) follow-up queue.
 * Reads three genuinely different date fields — `nextActionDate`, a parked
 * lead's `parked.revisitDate`, and a lost lead's `reengageOn` — because a
 * lead can owe a follow-up for three different reasons, and this is the one
 * place that reads all three side by side rather than only the first, which
 * is all the Lead Inbox ever looked at.
 *
 * `until` bounds every query to "overdue, or due within the next 7 days" —
 * a rolling window, not a calendar one, the same choice the inbox's source-mix
 * chart already made. There is deliberately no lower bound on "overdue": a
 * lead neglected for months should keep surfacing, not age out of the queue.
 */
export async function getMyDay(userId: string, scope: "mine" | "team") {
  const filter = ownerFilter(scope, userId);
  const todayStart = startOfToday();
  const tomorrowStart = new Date(todayStart.getTime() + DAY_MS);
  const weekEnd = new Date(todayStart.getTime() + 8 * DAY_MS);

  const [nextActionLeads, parkedLeads, reengageLeads] = await Promise.all([
    LeadModel.find({
      ...filter,
      deletedAt: null,
      "parked.isParked": { $ne: true },
      stage: { $nin: TERMINAL_LEAD_STAGES },
      nextActionDate: { $lt: weekEnd },
    })
      .select(
        "leadCode companyName temperature stage indicativeValuePaise nextAction nextActionDate nextActionSourceActivityId nextActionPromisedAt nextActionPromisedByUserId",
      )
      .populate("nextActionSourceActivityId", "sequenceNo")
      .populate("nextActionPromisedByUserId", "name")
      .lean<LeadForQueue[]>(),

    LeadModel.find({
      ...filter,
      deletedAt: null,
      "parked.isParked": true,
      "parked.revisitDate": { $lt: weekEnd },
    })
      .select("leadCode companyName temperature stage indicativeValuePaise parked")
      .lean<LeadForQueue[]>(),

    LeadModel.find({
      ...filter,
      deletedAt: null,
      stage: LeadStage.LOST,
      reengageOn: { $ne: null, $lt: weekEnd },
    })
      .select("leadCode companyName temperature stage indicativeValuePaise reengageOn competitor")
      .lean<LeadForQueue[]>(),
  ]);

  const allLeadIds = [...nextActionLeads, ...parkedLeads, ...reengageLeads].map((lead) => lead._id);
  const followUpCounts = allLeadIds.length
    ? await ActivityModel.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
        { $match: { parentType: ActivityParentType.LEAD, parentId: { $in: allLeadIds } } },
        { $group: { _id: "$parentId", count: { $sum: 1 } } },
      ])
    : [];
  const countByLead = new Map(followUpCounts.map((entry) => [String(entry._id), entry.count]));

  const buckets: Record<"overdue" | "today" | "thisWeek", MyDayRowDto[]> = {
    overdue: [],
    today: [],
    thisWeek: [],
  };

  for (const lead of nextActionLeads) {
    const dueDate = lead.nextActionDate as Date;
    buckets[bucketNameFor(dueDate, todayStart, tomorrowStart)].push(
      toRow(lead, "NEXT_ACTION", dueDate, lead.nextAction ?? "", countByLead, todayStart),
    );
  }
  for (const lead of parkedLeads) {
    const dueDate = (lead.parked as { revisitDate: Date }).revisitDate;
    const reason = (lead.parked as { reason: string }).reason;
    buckets[bucketNameFor(dueDate, todayStart, tomorrowStart)].push(
      toRow(lead, "PARKED_REVISIT", dueDate, `Parked — ${reason}`, countByLead, todayStart),
    );
  }
  for (const lead of reengageLeads) {
    const dueDate = lead.reengageOn as Date;
    const text = lead.competitor ? `Re-engage — lost to ${lead.competitor}` : "Re-engage — worth trying again";
    buckets[bucketNameFor(dueDate, todayStart, tomorrowStart)].push(
      toRow(lead, "REENGAGE", dueDate, text, countByLead, todayStart),
    );
  }

  // Longest-overdue and soonest-due first in every bucket — the same
  // "neglect surfaces first" ordering the Lead Inbox defaults to.
  for (const bucket of Object.values(buckets)) {
    bucket.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }

  function summarize(items: MyDayRowDto[]) {
    return {
      count: items.length,
      valueTotalPaise: items.reduce((sum, item) => sum + (item.indicativeValuePaise ?? 0), 0),
      items,
    };
  }

  const [inboxNeedingAction, completedToday] = await Promise.all([
    LeadModel.countDocuments({
      ...filter,
      deletedAt: null,
      "parked.isParked": { $ne: true },
      stage: { $nin: TERMINAL_LEAD_STAGES },
      firstResponseAt: null,
    }),
    ActivityModel.countDocuments({
      ...(scope === "mine" ? { loggedByUserId: toObjectId(userId) } : {}),
      occurredAt: { $gte: todayStart, $lt: tomorrowStart },
    }),
  ]);

  return {
    scope,
    summary: {
      overdueFollowUps: buckets.overdue.length,
      dueToday: buckets.today.length,
      restOfWeek: buckets.thisWeek.length,
      inboxNeedingAction,
      completedToday,
    },
    overdue: summarize(buckets.overdue),
    today: summarize(buckets.today),
    thisWeek: summarize(buckets.thisWeek),
  };
}
