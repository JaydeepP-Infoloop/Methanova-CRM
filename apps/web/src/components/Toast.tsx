import { CheckCircle2, X, type LucideIcon } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type ToastTone = "success" | "error";

export interface ToastOptions {
  message: string;
  tone?: ToastTone;
  /** Optional follow-up, e.g. "View" on the record just created. */
  action?: { label: string; onClick: () => void };
  durationMs?: number;
}

interface ToastEntry extends ToastOptions {
  id: number;
  /** Set by `dismiss()`, never by the item itself — see the note there. */
  leaving?: boolean;
}

const ToastContext = createContext<((options: ToastOptions) => void) | null>(null);

const TONE: Record<ToastTone, { icon: LucideIcon; classes: string }> = {
  success: { icon: CheckCircle2, classes: "ring-emerald-600/20 bg-emerald-50 text-emerald-800" },
  error: { icon: X, classes: "ring-rose-600/20 bg-rose-50 text-rose-800" },
};

/** Matches the timeout in `dismiss()` below — the fade-out plays, then the toast actually leaves the array. */
const LEAVE_MS = 150;

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  // Two-phase removal: mark `leaving` so the item's own exit transition can
  // play, then remove it from the array once that transition has had time to
  // finish. Both the auto-dismiss timer and the manual × button call this
  // same function, so neither path skips the animation the other gets.
  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.map((toast) => (toast.id === id ? { ...toast, leaving: true } : toast)));
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, LEAVE_MS);
  }, []);

  const push = useCallback(
    (options: ToastOptions) => {
      const id = nextId++;
      setToasts((current) => [...current, { ...options, id }]);
      window.setTimeout(() => dismiss(id), options.durationMs ?? 6000);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={push}>
      {children}
      {/* aria-live so the confirmation reaches screen readers too — the visual
          toast is not the only channel this message travels on. */}
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastEntry; onDismiss: () => void }) {
  // Same mount-delay trick as Modal: start hidden, flip to shown on the next
  // frame so the browser has something to transition *from* rather than
  // rendering already-visible and skipping the slide-in entirely.
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const tone = TONE[toast.tone ?? "success"];
  const Icon = tone.icon;
  const shown = entered && !toast.leaving;

  return (
    <div
      className={`pointer-events-auto flex items-center gap-3 rounded-lg px-4 py-3 text-sm shadow-lg ring-1 transition-all duration-200 motion-reduce:transition-none ${
        shown ? "translate-x-0 translate-y-0 opacity-100" : "translate-x-3 opacity-0"
      } ${tone.classes}`}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action?.onClick();
            onDismiss();
          }}
          className="rounded font-semibold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold"
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="rounded p-0.5 opacity-60 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

export function useToast(): (options: ToastOptions) => void {
  const push = useContext(ToastContext);
  if (!push) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return push;
}
