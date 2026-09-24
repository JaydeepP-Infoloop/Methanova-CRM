import { AccessLevel, AppModule, canAccess, type Role } from "@methanova/shared-types";
import { LayoutDashboard, Sunrise } from "lucide-react";
import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";
import { Tooltip } from "../../components/Tooltip";
import methanovaCbgIcon from "../../assets/methanova-cbg-icon.png";
import { NAV_SECTIONS } from "../nav";

const itemClasses = ({ isActive }: { isActive: boolean }) =>
  `relative block rounded-lg py-1.5 pl-5 pr-2 text-sm transition-colors ${
    isActive ? "bg-white/10 font-medium text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
  }`;

/** The gold bar that marks the active destination in both expanded and collapsed modes. */
function ActiveBar({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <span aria-hidden="true" className="absolute inset-y-1 left-1 w-0.5 rounded-full bg-methanova-gold" />
  ) : null;
}

export function Sidebar({ role, collapsed }: { role: Role; collapsed: boolean }) {
  const sections = NAV_SECTIONS.filter((section) =>
    section.modules.some((module) => canAccess(role, module, AccessLevel.READ)),
  );

  return (
    <aside
      className={`flex shrink-0 flex-col bg-methanova-greenDark transition-[width] duration-200 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      <div className={`flex h-14 items-center gap-2 ${collapsed ? "justify-center px-2" : "px-4"}`}>
        <img src={methanovaCbgIcon} alt="CBG CRM" className="h-8 w-8 shrink-0 object-contain" />
        {!collapsed && <span className="truncate text-sm font-semibold text-white">Methanova CRM</span>}
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-2 pb-4">
        {/* Above Dashboard, not inside the CRM section: this is the screen
            the sales team opens every morning, not a sub-item to find. Gated
            on crm:READ like the section used to gate it, since the page is
            entirely about leads and would 403 for anyone without that. */}
        {canAccess(role, AppModule.crm, AccessLevel.READ) && (
          <CollapsedTip collapsed={collapsed} label="My Day">
            <NavLink to="/app/my-day" className={itemClasses}>
              {({ isActive }) => (
                <>
                  <ActiveBar isActive={isActive} />
                  {collapsed ? <Sunrise className="mx-auto h-4 w-4" aria-label="My Day" /> : "My Day"}
                </>
              )}
            </NavLink>
          </CollapsedTip>
        )}
        <CollapsedTip collapsed={collapsed} label="Dashboard">
          <NavLink to="/app" end className={itemClasses}>
            {({ isActive }) => (
              <>
                <ActiveBar isActive={isActive} />
                {collapsed ? (
                  <LayoutDashboard className="mx-auto h-4 w-4" aria-label="Dashboard" />
                ) : (
                  "Dashboard"
                )}
              </>
            )}
          </NavLink>
        </CollapsedTip>

        {sections.map((section) =>
          collapsed ? (
            // No room for labels, so one icon per section links to its first
            // destination. With ~20 leaf routes, an icon per item would be an
            // unreadable stack of near-identical glyphs.
            <CollapsedTip key={section.key} collapsed label={section.label}>
              <NavLink to={`/app/${section.items[0].path}`} className={itemClasses}>
                {({ isActive }) => (
                  <>
                    <ActiveBar isActive={isActive} />
                    <section.icon className="mx-auto h-4 w-4" aria-label={section.label} />
                  </>
                )}
              </NavLink>
            </CollapsedTip>
          ) : (
            <div key={section.key}>
              {/* /60 rather than /40: at 12px uppercase on the dark rail, /40 measures ~3.5:1 against the §7 floor of 4.5:1. */}
              <p className="flex items-center gap-2 px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-white/60">
                <section.icon className="h-3.5 w-3.5" aria-hidden="true" />
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavLink key={item.path} to={`/app/${item.path}`} className={itemClasses}>
                    {({ isActive }) => (
                      <>
                        <ActiveBar isActive={isActive} />
                        {item.label}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ),
        )}
      </nav>
    </aside>
  );
}

function CollapsedTip({
  collapsed,
  label,
  children,
}: {
  collapsed: boolean;
  label: string;
  children: ReactNode;
}) {
  if (!collapsed) return children;
  return (
    <Tooltip label={label} className="flex w-full">
      {children}
    </Tooltip>
  );
}
