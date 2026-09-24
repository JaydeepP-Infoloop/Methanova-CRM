import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";

/** Shared control chrome — inputs, selects and textareas should use this instead of a local copy. */
export const CONTROL_CLASS =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold disabled:bg-slate-50 disabled:text-slate-400";

export function fieldControlClass(error?: string, extra = ""): string {
  return `${CONTROL_CLASS} ${error ? "border-rose-400" : ""} ${extra}`.trim();
}

export interface FieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}

/**
 * Label + control + one of hint or error. If `children` is a single native
 * control, aria-invalid / described-by / shared classes are applied here so
 * callers do not have to thread them by hand.
 */
export function Field({ label, htmlFor, error, hint, required, children }: FieldProps) {
  const errorId = htmlFor ? `${htmlFor}-error` : undefined;
  const hintId = htmlFor ? `${htmlFor}-hint` : undefined;
  const describedBy = [error ? errorId : null, !error && hint ? hintId : null].filter(Boolean).join(" ") || undefined;

  const childArray = Children.toArray(children);
  const only = childArray.length === 1 ? childArray[0] : null;
  const native =
    isValidElement(only) && typeof only.type === "string" && ["input", "select", "textarea"].includes(only.type);
  const control = native
    ? cloneElement(only as ReactElement<{ id?: string; className?: string; "aria-invalid"?: boolean; "aria-describedby"?: string }>, {
        id: (only as ReactElement<{ id?: string }>).props.id ?? htmlFor,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
        className: fieldControlClass(error, (only as ReactElement<{ className?: string }>).props.className),
      })
    : children;

  return (
    <div>
      <label htmlFor={htmlFor} className="block text-xs font-medium text-slate-700">
        {label}
        {required && (
          <span className="ml-0.5 text-rose-600" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <div className="mt-1">{control}</div>
      {error ? (
        <p id={errorId} className="mt-1 text-xs text-rose-600">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
