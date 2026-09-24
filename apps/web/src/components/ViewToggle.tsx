import { KanbanSquare, Table2 } from "lucide-react";

export type ListView = "table" | "kanban";

export interface ViewToggleProps {
  view: ListView;
  onChange: (view: ListView) => void;
  /**
   * The "kanban" slot is reused by pages that aren't literal boards — the
   * Activity Log uses it for its chronological timeline. Override the label
   * and icon for that case; defaults keep every existing board view unchanged.
   */
  secondLabel?: string;
  secondIcon?: typeof Table2;
}

export function ViewToggle({ view, onChange, secondLabel = "Kanban", secondIcon = KanbanSquare }: ViewToggleProps) {
  const options: { value: ListView; label: string; icon: typeof Table2 }[] = [
    { value: "table", label: "Table", icon: Table2 },
    { value: "kanban", label: secondLabel, icon: secondIcon },
  ];

  return (
    <div role="group" aria-label="View" className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={view === option.value}
          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold ${
            view === option.value ? "bg-methanova-greenTint font-medium text-methanova-green" : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          <option.icon className="h-3.5 w-3.5" aria-hidden="true" />
          {option.label}
        </button>
      ))}
    </div>
  );
}
