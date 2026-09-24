import { TRANSITION_MAP } from "@methanova/shared-types";
import mongoose from "mongoose";
import { applyActor } from "../../../db/plugins/audit.plugin.js";
import { LeadModel } from "../../crm/leads/leads.model.js";
import { expectedCbgFromFactors } from "../../crm/leads/leads.service.js";
import { FeedstockTypeModel } from "./geography.model.js";

/**
 * A stage with no legal move out of it is closed. Derived from the transition
 * map rather than hardcoding WON and LOST, so adding a terminal stage later
 * cannot leave this behind.
 */
const TERMINAL_LEAD_STAGES = Object.entries(TRANSITION_MAP.lead)
  .filter(([, targets]) => targets.length === 0)
  .map(([stage]) => stage);

interface OpenLead {
  _id: mongoose.Types.ObjectId;
  feedstockTypeIds: mongoose.Types.ObjectId[];
  feedstockQtyTpd: number;
  expectedCbgTpd: number;
}

function openLeadsQuery() {
  return LeadModel.find({ stage: { $nin: TERMINAL_LEAD_STAGES } }).select(
    "feedstockTypeIds feedstockQtyTpd expectedCbgTpd",
  );
}

async function currentFactors(): Promise<Map<string, number | null>> {
  const types = await FeedstockTypeModel.find().select("yieldFactor").lean();
  return new Map(types.map((type) => [String(type._id), (type.yieldFactor as number | null) ?? null]));
}

function recomputed(lead: OpenLead, factors: Map<string, number | null>): number {
  return expectedCbgFromFactors(
    lead.feedstockTypeIds.map((id) => factors.get(String(id)) ?? null),
    lead.feedstockQtyTpd,
  );
}

export interface FeedstockUsage {
  /** Lead count per feedstock type id — what blocks a removal, so it covers every lead. */
  leadsByType: Record<string, number>;
  openLeads: number;
  /**
   * Open leads whose stored expectedCbgTpd no longer matches what the current
   * factors would produce. This is the number that makes an edit meaningful:
   * without it the admin has no way to know the CRM is showing stale estimates.
   */
  staleOpenLeads: number;
}

export async function summariseFeedstockUsage(): Promise<FeedstockUsage> {
  const [types, factors, openLeads] = await Promise.all([
    FeedstockTypeModel.find().select("_id").lean(),
    currentFactors(),
    openLeadsQuery().lean<OpenLead[]>(),
  ]);

  const leadsByType: Record<string, number> = {};
  await Promise.all(
    types.map(async (type) => {
      leadsByType[String(type._id)] = await LeadModel.countDocuments({ feedstockTypeIds: type._id });
    }),
  );

  const staleOpenLeads = openLeads.filter(
    (lead) => recomputed(lead, factors) !== lead.expectedCbgTpd,
  ).length;

  return { leadsByType, openLeads: openLeads.length, staleOpenLeads };
}

export interface RecalculationResult {
  scanned: number;
  updated: number;
}

/**
 * Editing a yield factor does not touch leads that already exist — their
 * expectedCbgTpd was computed and stored at intake. That is the right default
 * (silently rewriting business records is worse than showing an old number),
 * but it leaves the CRM quoting assumptions nobody believes any more, so the
 * admin gets one explicit action to bring them forward.
 *
 * Only open leads are rewritten. A WON lead's estimate fed the MOU and the
 * project that followed it, and a LOST lead is history — neither should move
 * because an engineering assumption was revised afterwards.
 *
 * All-or-nothing in one replica-set transaction: a half-recalculated pipeline
 * is worse than an untouched one, because nothing would say which half.
 */
export async function recalculateExpectedCbg(actorId?: string): Promise<RecalculationResult> {
  const session = await mongoose.startSession();
  try {
    let result: RecalculationResult = { scanned: 0, updated: 0 };
    await session.withTransaction(async () => {
      const factors = await currentFactors();
      const leads = await openLeadsQuery().session(session);
      let updated = 0;

      for (const lead of leads) {
        const next = recomputed(lead.toObject() as unknown as OpenLead, factors);
        const previous = lead.get("expectedCbgTpd") as number;
        if (next === previous) continue;

        lead.set("expectedCbgTpd", next);
        // Saved one at a time rather than bulk-written so the audit plugin
        // records a before/after per lead — "why did this number change" has
        // to be answerable afterwards.
        applyActor(lead, actorId, "lead_expected_cbg_recalculated");
        await lead.save({ session });
        updated += 1;
      }

      // No separate summary audit row: each rewritten lead already carries the
      // actor and the `lead_expected_cbg_recalculated` action, so "who changed
      // this number and from what" is answerable without inventing an audit
      // entry that points at no entity.
      result = { scanned: leads.length, updated };
    });
    return result;
  } finally {
    await session.endSession();
  }
}
