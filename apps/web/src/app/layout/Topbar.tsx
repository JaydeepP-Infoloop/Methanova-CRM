import { LogOut, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../providers";
import { Button } from "../../components/Button";
import { CommandJump } from "../../components/CommandJump";
import { IconButton } from "../../components/IconButton";
import methanovaLogo from "../../assets/methanova-logo-full.png";

export interface TopbarProps {
  user: { name?: string; email: string; role: string };
  collapsed: boolean;
  onToggleSidebar: () => void;
}

export function Topbar({ user, collapsed, onToggleSidebar }: TopbarProps) {
  const { logout } = useAuth();
  const [jumpOpen, setJumpOpen] = useState(false);
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setJumpOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-6">
      <div className="flex items-center gap-3">
        <img src={methanovaLogo} alt="Methanova CRM" className="h-8 w-auto shrink-0" />
        <IconButton
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={onToggleSidebar}
        >
          <ToggleIcon className="h-4 w-4" aria-hidden="true" />
        </IconButton>
        <Button
          variant="secondary"
          icon={<Search className="h-3.5 w-3.5" aria-hidden="true" />}
          onClick={() => setJumpOpen(true)}
        >
          Jump
          <kbd className="ml-2 hidden rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-normal text-slate-400 sm:inline">
            ⌘K
          </kbd>
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-medium text-slate-800">{user.name ?? user.email}</p>
          <p className="text-xs text-slate-500">{user.role.replace(/_/g, " ")}</p>
        </div>
        <Button variant="secondary" icon={<LogOut className="h-3.5 w-3.5" aria-hidden="true" />} onClick={() => void logout()}>
          Sign out
        </Button>
      </div>

      <CommandJump open={jumpOpen} onClose={() => setJumpOpen(false)} />
    </header>
  );
}
