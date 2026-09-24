import { Loader2 } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Disables the control and shows a spinner; use with `pendingLabel` for "Saving…". */
  isPending?: boolean;
  pendingLabel?: string;
  icon?: ReactNode;
}

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-methanova-gold text-methanova-greenDark hover:brightness-95 focus-visible:ring-methanova-green",
  secondary:
    "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-methanova-gold",
  ghost: "text-slate-600 hover:bg-slate-100 focus-visible:ring-methanova-gold",
  danger: "bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-600",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "gap-1 px-2.5 py-1.5 text-xs",
  md: "gap-1.5 px-3 py-2 text-sm",
};

/**
 * One CTA surface for the app. Gold is the primary action (create, confirm);
 * green fill is deliberately *not* a button variant — it was the login leftover.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    isPending = false,
    pendingLabel,
    icon,
    className = "",
    disabled,
    children,
    type = "button",
    ...rest
  },
  ref,
) {
  const busy = isPending || disabled;
  return (
    <button
      ref={ref}
      type={type}
      disabled={busy}
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 disabled:opacity-60 ${VARIANT[variant]} ${SIZE[size]} ${className}`}
      {...rest}
    >
      {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : icon}
      {isPending && pendingLabel ? pendingLabel : children}
    </button>
  );
});
