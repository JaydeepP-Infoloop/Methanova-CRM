import { useState } from "react";
import { Outlet } from "react-router-dom";
import { useAuth } from "../providers";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

const COLLAPSE_KEY = "methanova.sidebarCollapsed";

/** Per-viewer convenience only — losing it (private window, cleared storage) is harmless. */
function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "true";
  } catch {
    return false;
  }
}

export function AppShell() {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(readCollapsed);

  if (!user) {
    return null;
  }

  function toggleSidebar() {
    setCollapsed((previous) => {
      const next = !previous;
      try {
        localStorage.setItem(COLLAPSE_KEY, String(next));
      } catch {
        // Storage unavailable; the toggle still works for this session.
      }
      return next;
    });
  }

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar role={user.role} collapsed={collapsed} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar user={user} collapsed={collapsed} onToggleSidebar={toggleSidebar} />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-[1600px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
