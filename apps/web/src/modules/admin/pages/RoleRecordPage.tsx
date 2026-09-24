import { AccessLevel, AppModule, PERMISSION_MATRIX, Role } from "@methanova/shared-types";
import { Card } from "../../../components/Card";
import { PageHeader } from "../../../components/PagePrimitives";
import { StatusPill } from "../../../components/StatusPill";
import { rolesApi } from "../api/roles.api";

/**
 * Rows and columns are derived from the enums, never a parallel hardcoded
 * list — `Object.values` is the only place either order is decided, so a role
 * or module added to shared-types shows up here without this file changing.
 */
const MODULES = Object.values(AppModule);
const ROLES = Object.values(Role);

const LEGEND: { level: AccessLevel; description: string }[] = [
  { level: AccessLevel.NONE, description: "No access — the module is not even readable" },
  { level: AccessLevel.READ, description: "Can view" },
  { level: AccessLevel.WRITE, description: "Can view and edit" },
  { level: AccessLevel.FULL, description: "Full control, including destructive actions" },
];

/** "SALES_HEAD_BDE" -> "Sales Head Bde". Only ever seen as a fallback — see roleLabel below. */
function titleCaseFromKey(rawKey: string): string {
  return rawKey
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

/** "crm" is an acronym and reads oddly title-cased; every other module key is one plain word. */
function moduleLabel(module: AppModule): string {
  return module === AppModule.crm ? "CRM" : titleCaseFromKey(module);
}

export function RoleRecordPage() {
  // The matrix itself never depends on this request — PERMISSION_MATRIX,
  // Role and AppModule are all compiled into shared-types. This is read only
  // to upgrade a row header from its raw key to the label an admin actually
  // wrote for it, so the grid renders immediately and the label quietly
  // improves once (if) the request resolves — never a blocked grid.
  const { data } = rolesApi.useList();
  const recordByKey = new Map((data ?? []).map((row) => [row.key, row]));

  /** The record's own label when it has loaded; a readable fallback otherwise — never blank. */
  function roleLabel(role: Role): string {
    return recordByKey.get(role)?.label ?? titleCaseFromKey(role);
  }

  return (
    <div>
      <PageHeader
        title="Roles"
        subtitle="What every role can see and change, module by module. This grid is read-only: the matrix is compiled into packages/shared-types/src/permissions.ts, and retuning it is a product decision made there, not from this screen."
      />

      {/* This exact four-value encoding does not appear anywhere else in the
          app, so a first-time viewer gets it spelled out once, here, rather
          than having to infer it from colour alone. */}
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl bg-white px-4 py-3 text-xs text-slate-600 shadow-sm ring-1 ring-slate-200/70">
        <span className="font-semibold uppercase tracking-wide text-slate-400">Access levels</span>
        {LEGEND.map(({ level, description }) => (
          <span key={level} className="inline-flex items-center gap-1.5">
            {level === AccessLevel.NONE ? (
              <span aria-hidden="true" className="text-sm text-slate-300">
                —
              </span>
            ) : (
              <StatusPill value={level} />
            )}
            {description}
          </span>
        ))}
      </div>

      <Card bodyPadding={false}>
        {/* One scroll container for both axes, bounded so the sticky header
            row and sticky role column have somewhere to stay pinned against —
            nine module columns do not fit the 1280px responsive floor
            DESIGN_SYSTEM.md commits to, so this scrolls rather than squashing. */}
        <div className="max-h-[65vh] overflow-auto rounded-xl">
          <table className="w-full border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 top-0 z-30 whitespace-nowrap border-b border-r border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  Role
                </th>
                {MODULES.map((module) => (
                  <th
                    key={module}
                    scope="col"
                    className="sticky top-0 z-20 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    {moduleLabel(module)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ROLES.map((role) => (
                <tr key={role}>
                  <th
                    scope="row"
                    className="sticky left-0 z-10 whitespace-nowrap border-r border-slate-200 bg-white px-4 py-2.5 text-left text-sm font-medium text-slate-800"
                  >
                    {roleLabel(role)}
                  </th>
                  {MODULES.map((module) => {
                    const level = PERMISSION_MATRIX[role][module];
                    return (
                      <td key={module} className="bg-white px-4 py-2.5 text-center">
                        {/* NONE renders as a bare dash, not a coloured pill —
                            the module explicitly treats "nothing here"
                            differently from a real value everywhere else in
                            this app (feedstock yield factors, empty progress
                            notes), and a real level should never have to
                            compete with it for attention. */}
                        {level === AccessLevel.NONE ? (
                          <span aria-label={`${role} has no access to ${module}`} className="text-slate-300">
                            —
                          </span>
                        ) : (
                          <StatusPill value={level} />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
