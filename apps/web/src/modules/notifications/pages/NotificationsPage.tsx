import type { NotificationDto } from "@methanova/shared-types";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../../components/Button";
import { PageHeader } from "../../../components/PagePrimitives";
import { SegmentedFilter } from "../../../components/SegmentedFilter";
import { Skeleton } from "../../../components/Skeleton";
import { formatRelativeTime } from "../../../lib/formatters";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationList,
} from "../api/notifications.api";
import { notificationRoute } from "../constants";

const PAGE_SIZE = 20;
type Segment = "all" | "unread";

function NotificationsSkeleton() {
  return (
    <div className="divide-y divide-slate-100 rounded-xl bg-white shadow-sm ring-1 ring-slate-200/70">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="flex gap-3 px-4 py-3.5">
          <Skeleton className="mt-1.5 h-2 w-2 shrink-0 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3.5 w-2/3" />
          </div>
          <Skeleton className="h-3 w-16 shrink-0" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl bg-white px-6 py-16 text-center shadow-sm ring-1 ring-slate-200/70">
      <p className="text-base font-medium text-slate-700">You&apos;re all caught up</p>
      <p className="mt-1 text-sm text-slate-500">New notifications will show up here as things happen.</p>
    </div>
  );
}

function NotificationRow({ item, onSelect }: { item: NotificationDto; onSelect: (item: NotificationDto) => void }) {
  const unread = !item.readAt;
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className={`flex w-full items-start gap-3 px-4 py-3.5 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-methanova-gold ${
        unread ? "bg-methanova-goldTint/30" : ""
      }`}
    >
      {/* Unread is marked by the dot plus bolder text, not colour alone. */}
      <span
        aria-hidden="true"
        className={`mt-2 h-2 w-2 shrink-0 rounded-full ${unread ? "bg-methanova-gold" : "bg-transparent"}`}
      />
      <span className="min-w-0 flex-1">
        <span className={`block text-sm ${unread ? "font-semibold text-slate-900" : "font-normal text-slate-500"}`}>
          {item.title}
        </span>
        <span className={`mt-0.5 block text-sm ${unread ? "text-slate-600" : "text-slate-400"}`}>{item.message}</span>
      </span>
      <span className="shrink-0 whitespace-nowrap text-xs text-slate-400">{formatRelativeTime(item.createdAt)}</span>
    </button>
  );
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const [segment, setSegment] = useState<Segment>("all");
  const [page, setPage] = useState(1);

  const list = useNotificationList({ page, pageSize: PAGE_SIZE, unreadOnly: segment === "unread" });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const items = list.data?.items ?? [];
  const total = list.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function changeSegment(value: Segment) {
    setSegment(value);
    setPage(1);
  }

  function handleSelect(item: NotificationDto) {
    if (!item.readAt) void markRead.mutateAsync(item.id);
    const route = notificationRoute(item.entityType, item.entityId);
    if (route) navigate(route);
  }

  return (
    <div>
      <PageHeader title="Notifications">
        <Button variant="secondary" size="sm" onClick={() => void markAllRead.mutateAsync()}>
          Mark all as read
        </Button>
      </PageHeader>

      <div className="mb-4">
        <SegmentedFilter
          label="Filter notifications"
          value={segment}
          onChange={changeSegment}
          options={[
            { value: "all", label: "All" },
            { value: "unread", label: "Unread" },
          ]}
        />
      </div>

      {list.isLoading ? (
        <NotificationsSkeleton />
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="divide-y divide-slate-100 rounded-xl bg-white shadow-sm ring-1 ring-slate-200/70">
            {items.map((item) => (
              <NotificationRow key={item.id} item={item} onSelect={handleSelect} />
            ))}
          </div>

          {total > PAGE_SIZE && (
            <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
              <p className="tabular-nums">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
              </p>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
                  Previous
                </Button>
                <span className="tabular-nums">
                  Page {page} of {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={page >= totalPages}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
