import { useProject } from "../modules/projects/api/project.api";
import { Button } from "./Button";

export interface UrlFilterNoticeProps {
  /** Plain-language description of each active filter, e.g. "Delayed only". */
  labels: string[];
  /** When the list is narrowed to one project, its code is looked up and named. */
  projectId?: string;
  onClear: () => void;
}

/** Says what a drill-down link narrowed this list to, with one way back to the full list. */
export function UrlFilterNotice({ labels, projectId, onClear }: UrlFilterNoticeProps) {
  const project = useProject(projectId);
  const projectLabel = projectId
    ? `Project ${(project.data as { code?: string } | undefined)?.code ?? "…"}`
    : null;
  const all = [...(projectLabel ? [projectLabel] : []), ...labels];
  if (all.length === 0) return null;
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-methanova-green/5 px-3 py-2 text-sm text-slate-700 ring-1 ring-inset ring-methanova-green/20">
      <p>
        <span className="font-medium">Filtered:</span> {all.join(" · ")}
      </p>
      <Button size="sm" variant="secondary" onClick={onClear}>
        Show all
      </Button>
    </div>
  );
}
