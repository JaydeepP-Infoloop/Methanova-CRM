import {
  CIN_PATTERN,
  EMAIL_PATTERN,
  EntityType,
  FeedstockTieupStatus,
  GSTIN_PATTERN,
  LeadTemperature,
  MOBILE_PATTERN,
  PAN_PATTERN,
  QUALIFICATION_MAX_SCORE,
  QUALIFICATION_MIN_SCORE,
  QualificationDecision,
} from "@methanova/shared-types";
import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Must be a valid id");

/** Treats "" the same as omitted, so an untouched optional input doesn't fail format validation. */
const optionalText = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((value) => (value ? value : undefined));

function optionalPattern(pattern: RegExp, message: string) {
  return optionalText.refine((value) => value === undefined || pattern.test(value), { message });
}

/**
 * Day granularity, deliberately: a lead created at 16:00 with a commitment
 * dated "today" is not overdue, and a revisit date of today means "look at
 * this now", not "you are late".
 */
function isBeforeToday(value: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return value < today;
}

/**
 * An optional monetary amount, in integer paise (hard rule #1). Rejects
 * fractional input outright rather than rounding it: the client converts from
 * whatever unit it collects — the intake form takes crore — and a non-integer
 * arriving here means that conversion is wrong, which is worth surfacing
 * rather than silently absorbing. Null is preserved as "not known", distinct
 * from a genuine 0.
 */
const optionalPaise = z
  .number()
  .int("Amounts must be whole paise")
  .nonnegative("An amount cannot be negative")
  .nullable()
  .optional();

export const contactSchema = z.object({
  name: z.string().trim().min(1, "Contact name is required"),
  designation: optionalText,
  mobile: z.string().trim().regex(MOBILE_PATTERN, "Mobile must be 10 digits"),
  email: optionalPattern(EMAIL_PATTERN, "Enter a valid email address"),
  isPrimary: z.boolean().default(false),
  isDecisionMaker: z.boolean().default(false),
});

/**
 * Exactly one primary contact. Zero is ambiguous (who do we call?) and more
 * than one defeats the point of the flag.
 *
 * Extracted so create, the general lead PATCH and the dedicated contacts PATCH
 * all enforce the identical rule. Any partial update sends the *whole*
 * replacement array precisely so this can be checked: a rule about the shape
 * of a collection cannot be validated one element at a time.
 */
function assertExactlyOnePrimary(contacts: { isPrimary: boolean }[], ctx: z.RefinementCtx): void {
  const primaries = contacts.filter((contact) => contact.isPrimary).length;
  if (primaries === 1) return;
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path: ["contacts"],
    message: primaries === 0 ? "Mark one contact as primary" : "Only one contact can be primary",
  });
}

export const createLeadSchema = z
  .object({
    companyName: z.string().trim().min(1, "Company name is required"),
    entityType: z.enum(Object.values(EntityType) as [string, ...string[]]).optional().nullable(),
    gstin: optionalPattern(GSTIN_PATTERN, "GSTIN format looks wrong"),
    pan: optionalPattern(PAN_PATTERN, "PAN format looks wrong"),
    cin: optionalPattern(CIN_PATTERN, "CIN format looks wrong"),

    contacts: z.array(contactSchema).min(1, "At least one contact is required"),

    stateId: objectId,
    districtId: objectId,
    talukaId: objectId,
    villageId: objectId.optional().nullable(),

    registeredAddress: optionalText,
    siteAddress: optionalText,

    leadSourceId: objectId,
    sourceDetail: optionalText,

    feedstockTypeIds: z.array(objectId).default([]),
    feedstockQtyTpd: z.coerce.number().nonnegative("Feedstock quantity cannot be negative"),
    feedstockTieupStatus: z
      .enum(Object.values(FeedstockTieupStatus) as [string, ...string[]])
      .optional()
      .nullable(),

    indicativeValuePaise: optionalPaise,

    nextAction: z.string().trim().min(1, "Next action is required"),
    nextActionDate: z.coerce.date(),
  })
  .superRefine((value, ctx) => {
    assertExactlyOnePrimary(value.contacts, ctx);

    // Dates are compared at day granularity: a lead created at 16:00 with a
    // next action of "today" is not overdue.
    if (isBeforeToday(value.nextActionDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["nextActionDate"],
        message: "Next action date cannot be in the past",
      });
    }
  });

/**
 * A replacement contacts array on its own. The UI edits contacts as a unit —
 * add, change and remove rows, then save — so the endpoint takes the finished
 * array rather than a per-row patch, which is also what makes the one-primary
 * rule checkable server-side.
 */
export const updateContactsSchema = z
  .object({ contacts: z.array(contactSchema).min(1, "At least one contact is required") })
  .superRefine((value, ctx) => assertExactlyOnePrimary(value.contacts, ctx));

export const updateLeadSchema = z.object({
  companyName: z.string().trim().min(1).optional(),
  entityType: z.enum(Object.values(EntityType) as [string, ...string[]]).optional().nullable(),
  gstin: optionalPattern(GSTIN_PATTERN, "GSTIN format looks wrong"),
  pan: optionalPattern(PAN_PATTERN, "PAN format looks wrong"),
  cin: optionalPattern(CIN_PATTERN, "CIN format looks wrong"),
  contacts: z.array(contactSchema).min(1).optional(),
  registeredAddress: optionalText,
  siteAddress: optionalText,
  sourceDetail: optionalText,
  feedstockTypeIds: z.array(objectId).optional(),
  feedstockQtyTpd: z.coerce.number().nonnegative().optional(),
  feedstockTieupStatus: z
    .enum(Object.values(FeedstockTieupStatus) as [string, ...string[]])
    .optional()
    .nullable(),
  temperature: z.enum(Object.values(LeadTemperature) as [string, ...string[]]).optional(),
  indicativeValuePaise: optionalPaise,
  nextAction: z.string().trim().min(1).optional(),
  nextActionDate: z.coerce.date().optional(),
})
  // This route already accepted a contacts array, and until the contacts
  // editor was built it did so without checking the primary rule — so the
  // general PATCH was a way around a constraint create enforced. Same rule,
  // both doors.
  .superRefine((value, ctx) => {
    if (value.contacts) assertExactlyOnePrimary(value.contacts, ctx);
  });

export const transitionLeadSchema = z.object({
  to: z.string().min(1),
  /** Required by the service when moving to LOST; optional context otherwise. */
  reason: optionalText,
  /**
   * Both only meaningful on the LOST move. They are optional there too: the
   * mandatory `reason` is the floor, and demanding a competitor name for a
   * lead that simply went cold would get "n/a" typed into it.
   */
  competitor: optionalText,
  reengageOn: z.coerce.date().optional().nullable(),
});

export const parkLeadSchema = z.object({
  /**
   * Both required, unlike the LOST extras. A park with no reason and no date
   * is indistinguishable from a neglected lead, which is the exact thing the
   * inbox exists to surface — parking has to be a deliberate commitment to
   * come back, or it is just hiding.
   */
  reason: z.string().trim().min(1, "A reason is required when parking a lead"),
  revisitDate: z.coerce.date(),
}).superRefine((value, ctx) => {
  if (isBeforeToday(value.revisitDate)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["revisitDate"],
      message: "Revisit date cannot be in the past",
    });
  }
});

export const qualifyLeadSchema = z.object({
  scores: z
    .array(
      z.object({
        criterionKey: z.string().trim().min(1),
        score: z.coerce
          .number()
          .int()
          .min(QUALIFICATION_MIN_SCORE)
          .max(QUALIFICATION_MAX_SCORE),
        note: optionalText,
      }),
    )
    .min(1, "Score at least one criterion"),
  decision: z.enum(Object.values(QualificationDecision) as [string, ...string[]]),
  disqualificationReason: optionalText,
  /** Recorded with the assessment, not on the lead root — see the model comment. */
  budgetMinPaise: optionalPaise,
  budgetMaxPaise: optionalPaise,
}).superRefine((value, ctx) => {
  // Only checked when both ends are given: half a band is a legitimate answer
  // ("at least 5 crore", "no more than 8"), an inverted one never is.
  if (
    typeof value.budgetMinPaise === "number" &&
    typeof value.budgetMaxPaise === "number" &&
    value.budgetMinPaise > value.budgetMaxPaise
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["budgetMaxPaise"],
      message: "The top of the range cannot be below the bottom",
    });
  }
});

const booleanFlag = z
  .enum(["true", "false"])
  .optional()
  .transform((value) => value === "true");

export const listLeadsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().optional(),
  stage: z.string().trim().optional(),
  ownerUserId: z.string().trim().optional(),
  leadSourceId: z.string().trim().optional(),
  districtId: z.string().trim().optional(),
  temperature: z.string().trim().optional(),
  unassigned: booleanFlag,
  noFirstResponse: booleanFlag,
  overdueNextAction: booleanFlag,
  /** Leads created since midnight — the "what landed today" segment of the inbox. */
  arrivedToday: booleanFlag,
  /** Default is longest-waiting-first; the inbox exists to surface neglect. */
  sort: z.enum(["oldest", "newest", "nextActionDate", "companyName"]).default("oldest"),
});

export const expectedCbgSchema = z.object({
  feedstockTypeIds: z.array(objectId).default([]),
  feedstockQtyTpd: z.coerce.number().nonnegative().default(0),
});
