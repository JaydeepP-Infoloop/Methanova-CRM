import { X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

export interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  /** Sticky footer content — actions live here so long bodies stay scrollable. */
  footer?: ReactNode;
  /**
   * Called for Escape, backdrop click and the × button alike. The caller
   * decides what that means: an untouched form closes instantly, a dirty one
   * asks first. The modal deliberately does not make that judgement itself.
   */
  onRequestClose: () => void;
  size?: "md" | "lg";
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The leave duration also drives the unmount timer below, so it has to stay
 * a real constant the two can share; the enter duration only ever appears as
 * the literal `duration-[180ms]` Tailwind class, since arbitrary-value
 * utilities have to be static strings for Tailwind's class scanner to see
 * them — interpolating a JS constant into that class name would compile to
 * nothing.
 */
const LEAVE_MS = 120;

export function Modal({
  open,
  title,
  description,
  children,
  footer,
  onRequestClose,
  size = "lg",
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  // `mounted` keeps the dialog in the DOM long enough to play its exit
  // transition instead of vanishing the instant `open` goes false. `shown`
  // is the state the transition animates toward; it starts false even while
  // `open` is already true so the first paint lands in the "hidden" class
  // combination, and only flips true on the next frame — collapsing that
  // into one render would apply the "shown" classes immediately and skip
  // the transition on every open, not just close.
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(raf);
    }
    setShown(false);
    const timeout = window.setTimeout(() => setMounted(false), LEAVE_MS);
    return () => window.clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onRequestClose();
        return;
      }
      if (event.key !== "Tab") return;
      // Focus trap: without it, tabbing walks out into the page behind the
      // overlay, which is disorienting and fails the a11y floor in §7.
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onRequestClose]);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center">
      <div
        className={`fixed inset-0 bg-slate-900/40 transition-opacity motion-reduce:transition-none ${
          shown ? "opacity-100 duration-[180ms]" : "opacity-0 duration-[120ms]"
        }`}
        onClick={onRequestClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative flex max-h-[92vh] w-full flex-col rounded-xl bg-white shadow-xl ring-1 ring-slate-200 transition-[opacity,transform] motion-reduce:transition-none ${
          shown ? "translate-y-0 scale-100 opacity-100 duration-[180ms]" : "translate-y-1 scale-95 opacity-0 duration-[120ms]"
        } ${size === "lg" ? "max-w-3xl" : "max-w-lg"}`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onRequestClose}
            aria-label="Close"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer && (
          <footer className="sticky bottom-0 border-t border-slate-200 bg-white px-6 py-4">{footer}</footer>
        )}
      </div>
    </div>
  );
}
