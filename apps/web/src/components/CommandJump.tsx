import { AccessLevel, AppModule, canAccess } from "@methanova/shared-types";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { NAV_SECTIONS } from "../app/nav";
import { useAuth } from "../app/providers";
import { useLeadList } from "../modules/crm/api/leads.api";
import type { AuthUser } from "../types/auth";

export interface CommandJumpProps {
  open: boolean;
  onClose: () => void;
}

interface JumpItem {
  id: string;
  label: string;
  hint?: string;
  to: string;
}

function destinationsFor(user: AuthUser | undefined): JumpItem[] {
  const items: JumpItem[] = [{ id: "dashboard", label: "Dashboard", to: "/app" }];
  if (user && canAccess(user.role, AppModule.crm, AccessLevel.READ)) {
    items.push({ id: "my-day", label: "My Day", to: "/app/my-day" });
  }
  if (!user) return items;
  for (const section of NAV_SECTIONS) {
    if (!section.modules.some((module) => canAccess(user.role, module, AccessLevel.READ))) continue;
    for (const item of section.items) {
      items.push({
        id: item.path,
        label: item.label,
        hint: section.label,
        to: `/app/${item.path}`,
      });
    }
  }
  return items;
}

/**
 * Route jumper — not a multi-entity search index. Lead hits reuse the inbox
 * list endpoint with `search`, then navigate to the existing detail route.
 */
export function CommandJump({ open, onClose }: CommandJumpProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [debounced, setDebounced] = useState("");

  const canSearchLeads = Boolean(user && canAccess(user.role, AppModule.crm, AccessLevel.READ));
  const routes = useMemo(() => destinationsFor(user), [user]);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(query.trim()), 300);
    return () => window.clearTimeout(handle);
  }, [query]);

  const leads = useLeadList(
    {
      page: 1,
      pageSize: 8,
      search: debounced,
      sort: "oldest",
    },
    { enabled: open && canSearchLeads && debounced.length >= 2 },
  );

  const routeHits = routes.filter((item) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return item.label.toLowerCase().includes(q) || (item.hint ?? "").toLowerCase().includes(q);
  });

  const leadHits: JumpItem[] =
    canSearchLeads && debounced.length >= 2
      ? (leads.data?.items ?? []).map((lead) => ({
          id: `lead-${lead.id}`,
          label: lead.companyName,
          hint: lead.leadCode,
          to: `/app/crm/leads/${lead.id}`,
        }))
      : [];

  const all = [...routeHits, ...leadHits];

  useEffect(() => {
    setActive(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  function go(item: JumpItem) {
    navigate(item.to);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[15vh]">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Jump to"
        className="relative w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-overlay ring-1 ring-slate-200"
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Jump to a page or lead…"
          aria-label="Jump to a page or lead"
          className="w-full border-b border-slate-200 px-4 py-3 text-sm focus-visible:outline-none"
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((value) => Math.min(value + 1, Math.max(all.length - 1, 0)));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((value) => Math.max(value - 1, 0));
            } else if (event.key === "Enter" && all[active]) {
              event.preventDefault();
              go(all[active]);
            }
          }}
        />
        <ul className="max-h-80 overflow-y-auto py-1">
          {all.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-slate-500">Nothing matches.</li>
          ) : (
            all.map((item, index) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => go(item)}
                  className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm ${
                    index === active ? "bg-methanova-goldTint" : "hover:bg-slate-50"
                  }`}
                >
                  <span className="text-slate-800">{item.label}</span>
                  {item.hint && <span className="text-xs text-slate-400">{item.hint}</span>}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
