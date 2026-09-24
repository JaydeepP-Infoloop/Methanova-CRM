import { ACTIVITY_OUTCOME_CATEGORY_LABELS } from "@methanova/shared-types";
import {
  CalendarClock,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Presentation,
  StickyNote,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { formatDate } from "../lib/formatters";
import { RefCell } from "./RefCell";
import { Skeleton } from "./Skeleton";
import { StatusPill } from "./StatusPill";

const TYPE_ICON: Record<string, LucideIcon> = {
  CALL: Phone,
  EMAIL: Mail,
  WHATSAPP: MessageSquare,
  MEETING: Users,
  PRESENTATION: Presentation,
  PLANT_VISIT: Presentation,
  SITE_VISIT: MapPin,
  NOTE: StickyNote,
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** "Today" / "This week" / a month name — the date-group separators the timeline is organised under. */
function groupLabel(occurredAt: Date, now: Date): string {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = startOfDay(now);
  const day = startOfDay(occurredAt);
  if (day.getTime() === today.getTime()) return "Today";
  const diffDays = Math.floor((today.getTime() - day.getTime()) / DAY_MS);
  if (diffDays > 0 && diffDays <= 7) return "This week";
  const sameYear = occurredAt.getFullYear() === now.getFullYear();
  return occurredAt.toLocaleDateString("en-IN", {
    month: "long",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

export interface ActivityRailItem {
  id: string;
  sequenceNo: number;
  type: string;
  occurredAt: string;
  summary: string;
  outcomeCategory?: string | null;
  outcome?: string | null;
  externalContactNames: string[];
  internalParticipants: { id: string; name: string }[];
  nextFollowUpDate?: string | null;
  nextFollowUpAction?: string | null;
  /**
   * Whether this activity's own committed follow-up was answered on time.
   * `null`/absent means no follow-up was committed here at all — there is
   * nothing to have kept or broken. Only the flat Activity Log computes this
   * today (it can see across the whole collection); a single lead's timeline
   * can leave it undefined and the chip simply omits the kept/broken badge.
   */
  followUpOutcome?: "PENDING" | "KEPT" | "BROKEN" | null;
  loggedByUserName?: string | null;
  leadId?: string | null;
  leadCode?: string | null;
  companyName?: string | null;
}

export interface ActivityRailProps {
  items: ActivityRailItem[];
  /** Renders a Lead column via RefCell. The flat Activity Log needs it; a single lead's own timeline already knows which lead it's on. */
  showLead?: boolean;
  emptyState?: React.ReactNode;
  /** Shows a handful of skeleton timeline rows instead of `items`/`emptyState`. Both call sites used to hand-roll their own "Loading…" text around this component; folding it in here means a fix reaches both. */
  isLoading?: boolean;
}

const FOLLOW_UP_OUTCOME_BADGE: Record<
  "PENDING" | "KEPT" | "BROKEN",
  { icon: LucideIcon; label: string; classes: string }
> = {
  PENDING: { icon: Clock, label: "Follow-up pending", classes: "bg-amber-50 text-amber-700 ring-amber-600/20" },
  KEPT: { icon: Check, label: "Followed up on time", classes: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" },
  BROKEN: { icon: X, label: "Followed up late", classes: "bg-rose-50 text-rose-700 ring-rose-600/20" },
};

/**
 * The shared timeline. Built once, used by both the lead detail workspace and
 * the flat Activity Log — the two used to be separate hand-rolled lists (one
 * inline in LeadDetailPage, one a bare table), which meant a formatting fix
 * in one never reached the other. This is a pure presentational component:
 * it renders whatever page of activities its caller already fetched and
 * filtered, and does not fetch anything itself.
 */
export function ActivityRail({ items, showLead = false, emptyState, isLoading = false }: ActivityRailProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const now = new Date();

  if (isLoading) {
    return (
      <ol className="divide-y divide-slate-100">
        {Array.from({ length: 4 }).map((_, index) => (
          <li key={index} className="flex gap-3 px-5 py-4">
            <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3 w-1/4" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </li>
        ))}
      </ol>
    );
  }

  if (items.length === 0) {
    return (
      emptyState ?? (
        <div className="px-5 py-10 text-center">
          <p className="text-sm font-medium text-slate-900">Nothing logged yet</p>
        </div>
      )
    );
  }

  function toggleExpanded(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Group consecutively — the list already arrives newest-first, so a group
  // boundary is simply "the label changed since the last row".
  const groups: { label: string; rows: ActivityRailItem[] }[] = [];
  for (const item of items) {
    const label = groupLabel(new Date(item.occurredAt), now);
    const currentGroup = groups[groups.length - 1];
    if (currentGroup?.label === label) currentGroup.rows.push(item);
    else groups.push({ label, rows: [item] });
  }

  return (
    <div className="divide-y divide-slate-100">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="bg-slate-50/60 px-5 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {group.label}
          </p>
          <ol className="divide-y divide-slate-100">
            {group.rows.map((activity) => {
              const Icon = TYPE_ICON[activity.type] ?? StickyNote;
              const isLong = activity.summary.length > 160;
              const isExpanded = expanded.has(activity.id);
              const badge = activity.followUpOutcome ? FOLLOW_UP_OUTCOME_BADGE[activity.followUpOutcome] : null;
              const BadgeIcon = badge?.icon;

              return (
                <li key={activity.id} className="flex gap-3 px-5 py-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-methanova-greenTint text-methanova-green">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold tabular-nums text-slate-400">
                        #{activity.sequenceNo}
                      </span>
                      <StatusPill value={activity.type} tone="neutral" />
                      <span className="text-xs tabular-nums text-slate-500">{formatDate(activity.occurredAt)}</span>
                      {activity.loggedByUserName && (
                        <span className="text-xs text-slate-400">by {activity.loggedByUserName}</span>
                      )}
                      {showLead && (activity.companyName || activity.leadId) && (
                        <span className="ml-auto">
                          <RefCell
                            id={activity.leadId ?? ""}
                            name={activity.companyName ?? undefined}
                            secondary={activity.leadCode ?? undefined}
                            to={activity.leadId ? `/app/crm/leads/${activity.leadId}` : undefined}
                          />
                        </span>
                      )}
                      {activity.externalContactNames.length > 0 && (
                        <span className="text-xs text-slate-500">
                          with {activity.externalContactNames.join(", ")}
                        </span>
                      )}
                    </div>

                    <p className={`mt-1 text-sm text-slate-800 ${isLong && !isExpanded ? "line-clamp-2" : ""}`}>
                      {activity.summary}
                    </p>
                    {isLong && (
                      <button
                        type="button"
                        onClick={() => toggleExpanded(activity.id)}
                        className="mt-0.5 inline-flex items-center gap-0.5 text-xs font-medium text-methanova-green hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold"
                      >
                        {isExpanded ? "Show less" : "Show more"}
                        {isExpanded ? (
                          <ChevronUp className="h-3 w-3" aria-hidden="true" />
                        ) : (
                          <ChevronDown className="h-3 w-3" aria-hidden="true" />
                        )}
                      </button>
                    )}

                    {activity.outcomeCategory && (
                      <p className="mt-1 text-xs text-slate-600">
                        Outcome:{" "}
                        <span className="font-medium">
                          {ACTIVITY_OUTCOME_CATEGORY_LABELS[
                            activity.outcomeCategory as keyof typeof ACTIVITY_OUTCOME_CATEGORY_LABELS
                          ] ?? activity.outcomeCategory}
                        </span>
                        {activity.outcome ? ` — ${activity.outcome}` : ""}
                      </p>
                    )}

                    {activity.nextFollowUpDate && (
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <p className="inline-flex items-center gap-1 text-xs text-slate-500">
                          <CalendarClock className="h-3 w-3" aria-hidden="true" />
                          Committed to follow up {formatDate(activity.nextFollowUpDate)}
                          {activity.nextFollowUpAction ? ` — ${activity.nextFollowUpAction}` : ""}
                        </p>
                        {/* The kept-or-broken link between a promise and
                            whatever activity answered it — a self-contained
                            badge rather than a cross-row pointer, since the
                            answering activity may sit in a different group,
                            a different page, or be filtered out entirely. */}
                        {badge && BadgeIcon && (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${badge.classes}`}
                          >
                            <BadgeIcon className="h-3 w-3" aria-hidden="true" />
                            {badge.label}
                          </span>
                        )}
                      </div>
                    )}

                    {activity.internalParticipants.length > 0 && (
                      <p className="mt-0.5 text-xs text-slate-400">
                        Internal: {activity.internalParticipants.map((p) => p.name).join(", ")}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}
