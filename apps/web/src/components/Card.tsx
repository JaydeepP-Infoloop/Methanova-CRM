import type { ReactNode } from "react";

export interface CardProps {
  title?: string;
  /** Right-hand slot in the header row — a "View all" link, a filter, an action button. */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Tables manage their own edge padding, so they opt out of the body padding. */
  bodyPadding?: boolean;
}

/** The standard white surface. Everything that sits on the slate-50 page background uses this. */
export function Card({ title, action, children, className = "", bodyPadding = true }: CardProps) {
  return (
    <div className={`overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200/70 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          {title && <h2 className="text-sm font-semibold text-slate-900">{title}</h2>}
          {action}
        </div>
      )}
      <div className={bodyPadding ? (title || action ? "px-5 pb-5" : "p-5") : ""}>{children}</div>
    </div>
  );
}
