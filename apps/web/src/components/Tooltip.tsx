import type { ReactNode } from "react";

export interface TooltipProps {
  label: string;
  children: ReactNode;
  className?: string;
}

/**
 * Visible on hover and keyboard focus. Collapsed-nav destinations use this
 * instead of the native `title` attribute, which is delayed and mouse-only.
 */
export function Tooltip({ label, children, className = "inline-flex" }: TooltipProps) {
  return (
    <span className={`relative group/tooltip ${className}`}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-full top-1/2 z-30 ml-2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-xs text-white opacity-0 shadow-overlay transition-opacity duration-150 motion-reduce:transition-none group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}
