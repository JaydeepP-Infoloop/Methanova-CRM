/**
 * One key namespace per resource, resource name first.
 *
 * This exists because it previously was not true: `createResourceApi` keyed on
 * the raw URL path (`["/api/crm/leads", id]`) while hand-written hooks keyed on
 * the domain name (`["leads", "list", …]`). A lead was therefore cached under
 * two unrelated namespaces, and every mutation had to remember to invalidate
 * both. Forgetting one produced the worst kind of bug: the write succeeded, the
 * toast confirmed it, and the screen kept showing stale data — indistinguishable
 * from a silent failure.
 *
 * With every key built from these helpers, `invalidateQueries({ queryKey:
 * queryKeys.resource("leads") })` reaches everything about a lead: its list, its
 * detail, its summary counts and its sub-collections.
 */
export const queryKeys = {
  /** The whole namespace — use this to invalidate everything about a resource. */
  resource: (resource: string) => [resource] as const,

  /** A collection, optionally narrowed by filters/pagination. */
  list: (resource: string, params?: unknown) =>
    (params === undefined ? [resource, "list"] : [resource, "list", params]) as readonly unknown[],

  /** One record by id. */
  detail: (resource: string, id: string | undefined) => [resource, "detail", id] as readonly unknown[],

  /** A sub-collection hanging off one record, e.g. a lead's activities. */
  sub: (resource: string, id: string | undefined, name: string) =>
    [resource, "detail", id, name] as readonly unknown[],

  /** A named non-CRUD query on a resource, e.g. the lead inbox summary counts. */
  op: (resource: string, name: string, params?: unknown) =>
    (params === undefined ? [resource, name] : [resource, name, params]) as readonly unknown[],
};

/**
 * Resource names are declared once so a typo cannot silently create a second
 * namespace — which is exactly how the original split happened.
 */
export const RESOURCE = {
  leads: "leads",
  activities: "activities",
  myDay: "myDay",
  quotations: "quotations",
  mous: "mous",
  projects: "projects",
  feasibilitySurveys: "feasibilitySurveys",
  dprs: "dprs",
  licences: "licences",
  documents: "documents",
  workPackages: "workPackages",
  progressUpdates: "progressUpdates",
  paymentSchedules: "paymentSchedules",
  invoices: "invoices",
  receipts: "receipts",
  reports: "reports",
  users: "users",
  roles: "roles",
  masterData: "masterData",
  /** Reference data the CRM reads: geography, lead sources, feedstock, criteria, colleagues. */
  masters: "masters",
  notifications: "notifications",
} as const;

export type ResourceName = (typeof RESOURCE)[keyof typeof RESOURCE];
