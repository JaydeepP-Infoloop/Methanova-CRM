import type { NotificationDto } from "@methanova/shared-types";
import { Bell } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { IconButton } from "../../../components/IconButton";
import { Skeleton } from "../../../components/Skeleton";
import { formatRelativeTime } from "../../../lib/formatters";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationList,
  useUnreadCount,
} from "../api/notifications.api";
import { notificationRoute } from "../constants";

/** Same open-transition treatment as LeadDetailPage's "⋯" menu panel (`MenuPanel` there) — closing unmounts instantly, so only the open side needs one. */
function BellPanel({ children }: { children: ReactNode }) {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div
      className={`absolute right-0 z-20 mt-1 w-96 origin-top-right overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-slate-200 transition-[opacity,transform] duration-150 motion-reduce:transition-none ${
        entered ? "scale-100 opacity-100" : "scale-95 opacity-0"
      }`}
    >
      {children}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="px-4 py-8 text-center">
      <p className="text-sm font-medium text-slate-700">You&apos;re all caught up</p>
      <p className="mt-1 text-xs text-slate-500">New notifications will show up here.</p>
    </div>
  );
}

function NotificationRow({ item, onSelect }: { item: NotificationDto; onSelect: (item: NotificationDto) => void }) {
  const unread = !item.readAt;
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(item)}
        className={`flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-methanova-gold ${
          unread ? "bg-methanova-goldTint/40" : ""
        }`}
      >
        {/* Unread is marked by the dot plus bolder text, not colour alone. */}
        <span
          aria-hidden="true"
          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${unread ? "bg-methanova-gold" : "bg-transparent"}`}
        />
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-sm ${unread ? "font-semibold text-slate-900" : "font-normal text-slate-500"}`}>
            {item.title}
          </span>
          <span className={`block truncate text-xs ${unread ? "text-slate-600" : "text-slate-400"}`}>{item.message}</span>
          <span className="mt-0.5 block text-[11px] text-slate-400">{formatRelativeTime(item.createdAt)}</span>
        </span>
      </button>
    </li>
  );
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const unread = useUnreadCount();
  const list = useNotificationList({ page: 1, pageSize: 10 });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  useEffect(() => {
    if (!open) return;
    function onClickAway(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, [open]);

  const count = unread.data?.count ?? 0;
  const items = list.data?.items ?? [];

  function handleSelect(item: NotificationDto) {
    if (!item.readAt) void markRead.mutateAsync(item.id);
    const route = notificationRoute(item.entityType, item.entityId);
    setOpen(false);
    if (route) navigate(route);
  }

  return (
    <div className="relative" ref={containerRef}>
      <IconButton
        aria-label={count > 0 ? `Notifications, ${count} unread` : "Notifications"}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="relative inline-flex">
          <Bell className="h-4 w-4" aria-hidden="true" />
          {count > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold leading-none text-white">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </span>
      </IconButton>
      {open && (
        <BellPanel>
          <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
            <p className="text-sm font-semibold text-slate-800">Notifications</p>
            {count > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead.mutateAsync()}
                className="rounded text-xs font-medium text-methanova-green hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold"
              >
                Mark all as read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {list.isLoading ? (
              <div className="space-y-3 p-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="flex gap-2">
                    <Skeleton className="mt-1.5 h-2 w-2 shrink-0 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-2/3" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              <EmptyState />
            ) : (
              <ul>
                {items.map((item) => (
                  <NotificationRow key={item.id} item={item} onSelect={handleSelect} />
                ))}
              </ul>
            )}
          </div>
          <div className="border-t border-slate-200 px-3 py-2 text-center">
            <Link
              to="/app/notifications"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-methanova-green hover:underline"
            >
              View all
            </Link>
          </div>
        </BellPanel>
      )}
    </div>
  );
}
