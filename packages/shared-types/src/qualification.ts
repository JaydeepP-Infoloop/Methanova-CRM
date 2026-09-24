/**
 * The three screening dimensions PROJECT_CONTEXT §2 names for qualification:
 * "feedstock availability, site viability, budget". They are seeded into a
 * master collection rather than hardcoded, because weights and thresholds are
 * commercial judgement that will be tuned once there are real leads to look
 * at — and tuning data is cheaper than tuning code.
 */
export const QualificationCriterionKey = {
  FEEDSTOCK_AVAILABILITY: "FEEDSTOCK_AVAILABILITY",
  SITE_VIABILITY: "SITE_VIABILITY",
  BUDGET_FINANCE: "BUDGET_FINANCE",
} as const;
export type QualificationCriterionKey =
  (typeof QualificationCriterionKey)[keyof typeof QualificationCriterionKey];

export const QualificationDecision = {
  QUALIFIED: "QUALIFIED",
  DISQUALIFIED: "DISQUALIFIED",
} as const;
export type QualificationDecision =
  (typeof QualificationDecision)[keyof typeof QualificationDecision];

/** Each criterion is scored on this scale. 0 means "no basis to judge yet", not "bad". */
export const QUALIFICATION_MIN_SCORE = 0;
export const QUALIFICATION_MAX_SCORE = 5;

export interface QualificationCriterionInput {
  criterionKey: string;
  score: number;
  note?: string | null;
}

export interface QualificationCriterionWeight {
  key: string;
  weight: number;
}

/**
 * Weighted percentage, 0-100.
 *
 * Shared between the API and the qualification modal on purpose: the score a
 * user sees while moving the sliders must be the number that gets stored, and
 * two implementations of the same formula would eventually disagree.
 *
 * Criteria with no submitted score are excluded from both sides of the ratio
 * rather than counted as zero — a dimension you have not assessed should not
 * drag the score down and make an unassessed lead look bad.
 */
export function computeQualificationScore(
  scores: QualificationCriterionInput[],
  weights: QualificationCriterionWeight[],
): number {
  const weightByKey = new Map(weights.map((weight) => [weight.key, weight.weight]));
  let weightedTotal = 0;
  let weightSum = 0;

  for (const entry of scores) {
    const weight = weightByKey.get(entry.criterionKey);
    if (weight === undefined) continue;
    weightedTotal += entry.score * weight;
    weightSum += weight;
  }

  if (weightSum === 0) return 0;
  return Math.round((weightedTotal / (weightSum * QUALIFICATION_MAX_SCORE)) * 100);
}

export interface QualificationScoreDto {
  criterionKey: string;
  score: number;
  note?: string | null;
}

export interface QualificationDto {
  scores: QualificationScoreDto[];
  totalScore: number;
  decision: QualificationDecision | null;
  decidedAt: string | null;
  decidedByUserId: string | null;
  disqualificationReason?: string | null;
}
