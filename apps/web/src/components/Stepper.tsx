import { AlertCircle, Check } from "lucide-react";

export interface StepperStep {
  label: string;
  /** A completed step that has since become invalid shows a red dot rather than a tick. */
  hasError?: boolean;
}

export interface StepperProps {
  steps: StepperStep[];
  /** Zero-based. */
  current: number;
  onStepClick?: (index: number) => void;
  /**
   * Explicit list of clickable step indices. Without it the stepper is a
   * wizard: only already-completed steps are reachable, because each step
   * gates the next one's validation. With it the caller decides — the lead
   * stage rail passes the legal transition targets, which can be forwards.
   */
  clickableSteps?: number[];
}

/**
 * Navigation is backwards-only: a user may revisit a step they have already
 * completed, but jumping forward would skip the validation each step gates,
 * so forward nodes are inert rather than disabled-looking-but-clickable.
 */
export function Stepper({ steps, current, onStepClick, clickableSteps }: StepperProps) {
  return (
    <div>
      {/* Below 640px a three-node bar becomes unreadable, so it collapses to a
          single progress line plus a text position indicator. */}
      <div className="sm:hidden">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-methanova-green transition-[width] duration-300"
            style={{ width: `${((current + 1) / steps.length) * 100}%` }}
          />
        </div>
        <p className="mt-2 text-xs font-medium text-slate-600">
          Step {current + 1} of {steps.length} · {steps[current]?.label}
        </p>
      </div>

      <ol className="hidden items-center sm:flex">
        {steps.map((step, index) => {
          const isCompleted = index < current;
          const isActive = index === current;
          const canNavigate = Boolean(onStepClick) && (clickableSteps ? clickableSteps.includes(index) : isCompleted);

          return (
            <li key={step.label} className={index === steps.length - 1 ? "flex items-center" : "flex flex-1 items-center"}>
              <button
                type="button"
                onClick={canNavigate ? () => onStepClick?.(index) : undefined}
                aria-current={isActive ? "step" : undefined}
                aria-label={`Step ${index + 1}: ${step.label}${step.hasError ? " (has errors)" : ""}`}
                tabIndex={canNavigate ? 0 : -1}
                className={`flex items-center gap-2 rounded-lg px-1 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold ${
                  canNavigate ? "cursor-pointer" : "cursor-default"
                }`}
              >
                <span
                  className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-1 ${
                    isActive
                      ? "bg-methanova-green text-white ring-methanova-green"
                      : isCompleted
                        ? "bg-methanova-greenTint text-methanova-green ring-methanova-green/30"
                        : // A reachable-but-not-yet-visited step gets the gold
                          // accent, so a legal move reads as available rather
                          // than looking identical to an unreachable one.
                          canNavigate
                          ? "bg-methanova-goldTint text-methanova-greenDark ring-methanova-gold"
                          : "bg-white text-slate-400 ring-slate-300"
                  }`}
                >
                  {isCompleted && !step.hasError ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : index + 1}
                  {step.hasError && (
                    <AlertCircle
                      className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-white text-rose-600"
                      aria-hidden="true"
                    />
                  )}
                </span>
                <span
                  className={`text-xs font-medium ${
                    isActive ? "text-slate-900" : isCompleted ? "text-slate-600" : "text-slate-400"
                  }`}
                >
                  {step.label}
                </span>
              </button>

              {index < steps.length - 1 && (
                <span aria-hidden="true" className="mx-2 h-px flex-1 bg-slate-200">
                  <span
                    className="block h-px bg-methanova-green transition-[width] duration-300"
                    style={{ width: isCompleted ? "100%" : "0%" }}
                  />
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
