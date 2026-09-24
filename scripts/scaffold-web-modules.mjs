/**
 * One-shot scaffold for web feature modules. Mirrors scaffold-api-modules.mjs:
 * each module gets pages/, components/, api/, types.ts and constants.ts wired
 * to the matching Express resource routes via the generic apiResource factory.
 * Run once from repo root with node; re-running overwrites generated files.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcModules = join(root, "apps/web/src/modules");

function pascal(kebab) {
  return kebab.replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase());
}
function camel(kebab) {
  const p = pascal(kebab);
  return p.charAt(0).toLowerCase() + p.slice(1);
}

const modules = [
  {
    key: "crm",
    label: "CRM",
    badge: {
      name: "LeadStageBadge",
      prop: "stage",
      body: `import { StatusPill } from "../../../components/StatusPill";

export function LeadStageBadge({ stage }: { stage: string }) {
  return <StatusPill value={stage} />;
}
`,
    },
    entities: [
      {
        key: "leads",
        label: "Lead",
        title: "Leads",
        route: "/api/crm/leads",
        columns: [
          { key: "code", label: "Code" },
          { key: "organisationName", label: "Organisation" },
          { key: "contactName", label: "Contact" },
          { key: "stage", label: "Stage", kind: "status", badge: "LeadStageBadge", badgeProp: "stage" },
        ],
        fields: `code: string;
  organisationName: string;
  contactName: string;
  contactEmail?: string;
  siteLocation?: string;
  stage: string;`,
      },
      {
        key: "quotations",
        label: "Quotation",
        title: "Quotations",
        route: "/api/crm/quotations",
        columns: [
          { key: "leadId", label: "Lead" },
          { key: "revision", label: "Revision" },
          { key: "totalPaise", label: "Total", kind: "money" },
        ],
        fields: `leadId: string;
  revision: number;
  parentQuotationId?: string;
  totalPaise: number;
  notes?: string;`,
      },
      {
        key: "activities",
        label: "Activity",
        title: "Activities",
        route: "/api/crm/activities",
        columns: [
          { key: "leadId", label: "Lead" },
          { key: "type", label: "Type" },
          { key: "at", label: "When", kind: "date" },
          { key: "notes", label: "Notes" },
        ],
        fields: `leadId: string;
  type: string;
  notes: string;
  at: string;`,
      },
      {
        key: "mou",
        label: "Mou",
        title: "MOUs",
        route: "/api/crm/mou",
        columns: [
          { key: "code", label: "Code" },
          { key: "leadId", label: "Lead" },
          { key: "feePaise", label: "Fee", kind: "money" },
          { key: "status", label: "Status", kind: "status" },
        ],
        fields: `code: string;
  leadId: string;
  status: string;
  feePaise: number;
  projectId?: string;`,
      },
    ],
  },
  {
    key: "projects",
    label: "Projects",
    badge: {
      name: "ProjectStatusBadge",
      body: `import { StatusPill } from "../../../components/StatusPill";

export function ProjectStatusBadge({ status }: { status: string }) {
  return <StatusPill value={status} />;
}
`,
    },
    entities: [
      {
        key: "project",
        label: "Project",
        title: "Projects",
        route: "/api/projects",
        columns: [
          { key: "code", label: "Code" },
          { key: "name", label: "Name" },
          { key: "leadId", label: "Lead" },
          { key: "status", label: "Status", kind: "status", badge: "ProjectStatusBadge", badgeProp: "status" },
        ],
        fields: `code: string;
  name: string;
  leadId: string;
  mouId: string;
  status: string;`,
      },
      {
        key: "feasibility",
        label: "FeasibilitySurvey",
        title: "Feasibility Surveys",
        route: "/api/projects/feasibility",
        columns: [
          { key: "projectId", label: "Project" },
          { key: "version", label: "Version" },
          { key: "findings", label: "Findings" },
        ],
        fields: `projectId: string;
  version: number;
  findings?: string;
  statutoryNotes?: string;`,
      },
      {
        key: "drp",
        label: "Dpr",
        title: "Detailed Project Reports",
        route: "/api/projects/dpr",
        columns: [
          { key: "projectId", label: "Project" },
          { key: "version", label: "Version" },
          { key: "capacityNm3", label: "Capacity (Nm3)" },
        ],
        fields: `projectId: string;
  version: number;
  summary?: string;
  capacityNm3?: number;`,
      },
    ],
  },
  {
    key: "compliance",
    label: "Compliance",
    badge: {
      name: "LicenceStatusBadge",
      body: `import { StatusPill } from "../../../components/StatusPill";

export function LicenceStatusBadge({ status }: { status: string }) {
  return <StatusPill value={status} />;
}
`,
    },
    entities: [
      {
        key: "licences",
        label: "Licence",
        title: "Licences & NOCs",
        route: "/api/compliance/licences",
        columns: [
          { key: "projectId", label: "Project" },
          { key: "bundle", label: "Bundle" },
          { key: "authority", label: "Authority" },
          { key: "status", label: "Status", kind: "status", badge: "LicenceStatusBadge", badgeProp: "status" },
        ],
        fields: `projectId: string;
  bundle: string;
  authority: string;
  status: string;
  visits: Array<{ at: string; notes?: string; officer?: string }>;
  queries: Array<{ at: string; question: string; response?: string; status?: string }>;`,
      },
    ],
  },
  {
    key: "documents",
    label: "Documents",
    badge: {
      name: "DocumentKindBadge",
      body: `import { StatusPill } from "../../../components/StatusPill";

export function DocumentKindBadge({ kind }: { kind: string }) {
  return <StatusPill value={kind} />;
}
`,
    },
    entities: [
      {
        key: "documents",
        label: "DocumentRecord",
        title: "Documents",
        route: "/api/documents",
        columns: [
          { key: "filename", label: "File" },
          { key: "kind", label: "Kind", kind: "status", badge: "DocumentKindBadge", badgeProp: "kind" },
          { key: "version", label: "Version" },
          { key: "projectId", label: "Project" },
        ],
        fields: `projectId?: string;
  leadId?: string;
  kind: string;
  version: number;
  filename: string;
  storagePath: string;`,
      },
    ],
  },
  {
    key: "schedule",
    label: "Schedule",
    badge: {
      name: "WorkPackageStatusBadge",
      body: `import { StatusPill } from "../../../components/StatusPill";

export function WorkPackageStatusBadge({ status }: { status: string }) {
  return <StatusPill value={status} />;
}
`,
    },
    entities: [
      {
        key: "work-packages",
        label: "WorkPackage",
        title: "Work Packages",
        route: "/api/schedule/work-packages",
        columns: [
          { key: "name", label: "Work package" },
          { key: "sequence", label: "Seq" },
          { key: "status", label: "Status", kind: "status", badge: "WorkPackageStatusBadge", badgeProp: "status" },
          { key: "amountPaise", label: "Amount", kind: "money" },
        ],
        fields: `projectId: string;
  name: string;
  sequence: number;
  status: string;
  plannedStart?: string;
  plannedEnd?: string;
  amountPaise: number;`,
      },
      {
        key: "progress-updates",
        label: "ProgressUpdate",
        title: "Progress Updates",
        route: "/api/schedule/progress-updates",
        columns: [
          { key: "workPackageId", label: "Work package" },
          { key: "percentComplete", label: "% complete" },
          { key: "at", label: "When", kind: "date" },
        ],
        fields: `workPackageId: string;
  percentComplete: number;
  notes?: string;
  at: string;`,
      },
    ],
  },
  {
    key: "billing",
    label: "Billing",
    badge: {
      name: "InvoiceStatusBadge",
      body: `import { StatusPill } from "../../../components/StatusPill";

export function InvoiceStatusBadge({ status }: { status: string }) {
  return <StatusPill value={status} />;
}
`,
    },
    entities: [
      {
        key: "payment-schedules",
        label: "PaymentSchedule",
        title: "Payment Schedules",
        route: "/api/billing/payment-schedules",
        columns: [
          { key: "projectId", label: "Project" },
          { key: "mouId", label: "Mou" },
        ],
        fields: `projectId: string;
  mouId: string;
  lines: Array<{ description: string; amountPaise: number; dueOnMilestone?: string }>;`,
      },
      {
        key: "invoices",
        label: "Invoice",
        title: "Invoices",
        route: "/api/billing/invoices",
        columns: [
          { key: "number", label: "Number" },
          { key: "kind", label: "Kind" },
          { key: "status", label: "Status", kind: "status", badge: "InvoiceStatusBadge", badgeProp: "status" },
          { key: "totalPaise", label: "Total", kind: "money" },
        ],
        fields: `projectId?: string;
  mouId?: string;
  paymentScheduleId?: string;
  number: string;
  kind: string;
  status: string;
  placeOfSupply: string;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  retentionPaise: number;
  advanceRecoveredPaise: number;
  totalPaise: number;`,
      },
    ],
  },
  {
    key: "receivables",
    label: "Receivables",
    badge: {
      name: "AgeingBadge",
      body: `import { StatusPill } from "../../../components/StatusPill";

/** Buckets a receipt/invoice date into the ageing bands Accounts reports receivables ageing by. */
export function AgeingBadge({ since }: { since: string }) {
  const days = Math.floor((Date.now() - new Date(since).getTime()) / 86_400_000);
  const bucket = days <= 0 ? "CURRENT" : days <= 30 ? "0-30" : days <= 60 ? "31-60" : days <= 90 ? "61-90" : "90+";
  return <StatusPill value={bucket} />;
}
`,
    },
    entities: [
      {
        key: "receipts",
        label: "Receipt",
        title: "Receipts & Ageing",
        route: "/api/receivables/receipts",
        columns: [
          { key: "invoiceId", label: "Invoice" },
          { key: "amountPaise", label: "Amount", kind: "money" },
          { key: "receivedOn", label: "Received", kind: "date" },
          { key: "reference", label: "Reference" },
          { key: "ageing", field: "receivedOn", label: "Ageing", kind: "status", badge: "AgeingBadge", badgeProp: "since" },
        ],
        fields: `invoiceId: string;
  amountPaise: number;
  receivedOn: string;
  reference?: string;`,
      },
    ],
  },
  {
    key: "reports",
    label: "Reports",
    badge: {
      name: "MetricCard",
      body: `export function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-methanova-green">{value}</p>
    </div>
  );
}
`,
    },
    entities: [
      {
        key: "reports",
        label: "ReportSnapshot",
        title: "Reports",
        route: "/api/reports",
        columns: [
          { key: "name", label: "Report" },
          { key: "generatedAt", label: "Generated", kind: "date" },
        ],
        fields: `name: string;
  payload: Record<string, unknown>;
  generatedAt: string;`,
      },
    ],
  },
  {
    key: "admin",
    label: "Admin",
    badge: {
      name: "RoleBadge",
      body: `import { StatusPill } from "../../../components/StatusPill";

export function RoleBadge({ role }: { role: string }) {
  return <StatusPill value={role} />;
}
`,
    },
    entities: [
      {
        key: "users",
        label: "User",
        title: "Users",
        route: "/api/admin/users",
        columns: [
          { key: "name", label: "Name" },
          { key: "email", label: "Email" },
          { key: "role", label: "Role", kind: "status", badge: "RoleBadge", badgeProp: "role" },
        ],
        fields: `email: string;
  name: string;
  role: string;`,
      },
      {
        key: "roles",
        label: "RoleRecord",
        title: "Roles",
        route: "/api/admin/roles",
        columns: [
          { key: "key", label: "Key" },
          { key: "label", label: "Label" },
          { key: "description", label: "Description" },
        ],
        fields: `key: string;
  label: string;
  description?: string;`,
      },
      {
        key: "master-data",
        label: "MasterData",
        title: "Master Data",
        route: "/api/admin/master-data",
        columns: [
          { key: "key", label: "Key" },
          { key: "label", label: "Label" },
        ],
        fields: `key: string;
  label: string;
  payload: Record<string, unknown>;`,
      },
    ],
  },
];

for (const mod of modules) {
  const dir = join(srcModules, mod.key);
  mkdirSync(join(dir, "pages"), { recursive: true });
  mkdirSync(join(dir, "components"), { recursive: true });
  mkdirSync(join(dir, "api"), { recursive: true });

  // types.ts
  const typesBody = `export interface BaseRecord {
  _id: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

${mod.entities
    .map(
      (e) => `export interface ${e.label}Row extends BaseRecord {
  ${e.fields}
}`,
    )
    .join("\n\n")}
`;
  writeFileSync(join(dir, "types.ts"), typesBody);

  // constants.ts
  const constantsBody = `import { AppModule } from "@methanova/shared-types";

export const ${mod.key.toUpperCase().replace(/-/g, "_")}_MODULE = AppModule.${mod.key};

export const ${mod.key.toUpperCase().replace(/-/g, "_")}_NAV = [
${mod.entities.map((e) => `  { path: "${e.key}", label: "${e.label.replace(/([A-Z])/g, " $1").trim()}" },`).join("\n")}
] as const;
`;
  writeFileSync(join(dir, "constants.ts"), constantsBody);

  // one flagship component per module
  writeFileSync(join(dir, "components", `${mod.badge.name}.tsx`), mod.badge.body);

  for (const e of mod.entities) {
    const entityCamel = camel(e.key);
    const pageName = `${e.label}Page`;

    // api/<entity>.api.ts
    // The resource name is the cache namespace and must also exist in
    // RESOURCE (lib/queryKeys.ts). Keying on the URL path instead would
    // recreate the two-namespace split that made mutations silently leave
    // stale data on screen.
    const apiBody = `import { createResourceApi } from "../../../lib/apiResource";
import { RESOURCE } from "../../../lib/queryKeys";
import type { ${e.label}Row } from "../types";

export const ${entityCamel}Api = createResourceApi<${e.label}Row>("${e.route}", RESOURCE.${entityCamel});
`;
    writeFileSync(join(dir, "api", `${e.key}.api.ts`), apiBody);

    // pages/<Entity>Page.tsx
    const usesMoney = e.columns.some((c) => c.kind === "money");
    const usesDate = e.columns.some((c) => c.kind === "date");
    const formatterNames = [usesMoney && "formatPaise", usesDate && "formatDate"].filter(Boolean);
    const badgeImports = [...new Set(e.columns.filter((c) => c.badge).map((c) => c.badge))];
    const columnsCode = e.columns
      .map((c) => {
        const field = c.field ?? c.key;
        if (c.kind === "money") {
          return `  { key: "${c.key}", label: "${c.label}", render: (row) => formatPaise(row.${field} as number) },`;
        }
        if (c.kind === "date") {
          return `  { key: "${c.key}", label: "${c.label}", render: (row) => formatDate(row.${field} as string) },`;
        }
        if (c.kind === "status" && c.badge) {
          return `  { key: "${c.key}", label: "${c.label}", render: (row) => <${c.badge} ${c.badgeProp}={row.${field} as string} /> },`;
        }
        if (c.kind === "status") {
          return `  { key: "${c.key}", label: "${c.label}", render: (row) => <StatusPill value={row.${field} as string} /> },`;
        }
        return `  { key: "${c.key}", label: "${c.label}" },`;
      })
      .join("\n");
    const usesPlainStatusPill = e.columns.some((c) => c.kind === "status" && !c.badge);

    const pageBody = `import { PageHeader } from "../../../components/PagePrimitives";
import { ResourceTable, type ResourceColumn } from "../../../components/ResourceTable";
${usesPlainStatusPill ? `import { StatusPill } from "../../../components/StatusPill";\n` : ""}${badgeImports.map((b) => `import { ${b} } from "../components/${b}";\n`).join("")}${formatterNames.length ? `import { ${formatterNames.join(", ")} } from "../../../lib/formatters";\n` : ""}import { ${entityCamel}Api } from "../api/${e.key}.api";
import type { ${e.label}Row } from "../types";

const columns: ResourceColumn<${e.label}Row>[] = [
${columnsCode}
];

export function ${pageName}() {
  const { data, isLoading, error } = ${entityCamel}Api.useList();
  return (
    <div>
      <PageHeader title="${e.title}" />
      <ResourceTable rows={data ?? []} columns={columns} isLoading={isLoading} error={error as Error | null} />
    </div>
  );
}
`;
    writeFileSync(join(dir, "pages", `${pageName}.tsx`), pageBody);
  }
}

console.log("Wrote", modules.length, "web modules");
