import type { z } from "zod";
import type { createLeadSchema, listLeadsQuerySchema, updateLeadSchema } from "./leads.validation.js";

export type LeadId = string;

/** Parsed query — defaults already applied, booleans already coerced. */
export type ListLeadsQuery = z.infer<typeof listLeadsQuerySchema>;
export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;

export interface LeadListResult<Item> {
  items: Item[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Shapes for the two thin inbox aggregations. They live here rather than in
 * `packages/shared-types` because, unlike `LeadListItemDto`, nothing outside
 * the CRM module speaks them yet — when the full Reports feature lands and a
 * second consumer appears, that is the moment to promote them.
 */
export interface LeadSourceMixDto {
  /** The trailing window the counts cover, echoed back so the panel can label itself. */
  windowDays: number;
  totalLeads: number;
  items: { leadSourceId: string; label: string; count: number }[];
}

export interface QualificationTallyDto {
  /** Leads with any recorded qualification — the denominator the panel quotes. */
  leadsScored: number;
  items: {
    criterionKey: string;
    label: string;
    /** Leads scored 1–5 on this criterion. A 0 means "not assessed" and is excluded. */
    assessedCount: number;
    /** Mean of the assessed scores only, to one decimal. 0 when nothing is assessed. */
    averageScore: number;
  }[];
}
