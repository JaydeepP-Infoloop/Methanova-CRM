import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Skeleton } from "./Skeleton";

export interface StatDelta {
  /** Already-formatted, e.g. "+7.4%" or "-3 days". */
  value: string;
  direction: "up" | "down";
  /**
   * Whether the movement is good news. This is explicit rather than inferred
   * from `direction` because the two come apart constantly here: more open
   * leads is good, more overdue licences is not.
   */
  intent: "positive" | "negative" | "neutral";
}

export interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  delta?: StatDelta;
  isLoading?: boolean;
  /** Navigation only — never a filter toggle. */
  to?: string;
}

const DELTA_CLASSES: Record<StatDelta["intent"], string> = {
  positive: "bg-emerald-50 text-emerald-700",
  negative: "bg-rose-50 text-rose-700",
  neutral: "bg-slate-100 text-slate-600",
};

export function StatCard({ icon: Icon, label, value, delta, isLoading, to }: StatCardProps) {
  const DeltaArrow = delta?.direction === "down" ? ArrowDownRight : ArrowUpRight;

  const body = (
    <>
      <div className="flex items-start gap-2 text-slate-500">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p className="text-xs font-medium">{label}</p>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        {isLoading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <p className="text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
        )}
        {delta && !isLoading && (
          <span
            className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium ${DELTA_CLASSES[delta.intent]}`}
          >
            <DeltaArrow className="h-3 w-3" aria-hidden="true" />
            {delta.value}
          </span>
        )}
      </div>
    </>
  );

  const className =
    "flex h-full flex-col justify-between rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70 transition-colors duration-150 motion-reduce:transition-none";

  if (to) {
    return (
      <Link
        to={to}
        className={`${className} hover:ring-methanova-gold/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold`}
      >
        {body}
      </Link>
    );
  }

  return <div className={className}>{body}</div>;
}
