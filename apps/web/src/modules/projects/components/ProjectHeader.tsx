import { ProjectStatus } from "@methanova/shared-types";
import { LetterheadPreview } from "../../../components/LetterheadPreview";
import { StatusPill } from "../../../components/StatusPill";
import { populatedName, type ProjectRow } from "../types";

export function ProjectHeader({ project }: { project: ProjectRow }) {
  const displayName = project.shortName?.trim() || project.name;
  const fileId = project.letterhead?.fileId ?? null;
  const legalName = project.letterhead?.orgLegalName ?? "Methanova Pvt Ltd";
  const closed =
    project.status === ProjectStatus.HANDED_OVER || project.status === ProjectStatus.OM;

  return (
    <div className="mb-6 space-y-3">
      <LetterheadPreview
        fileId={fileId}
        legalName={legalName}
        projectName={displayName}
        projectCode={project.code}
      />
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill value={project.status} />
        {closed && <span className="text-xs text-slate-500">Identity is read-only after handover</span>}
        <span className="text-xs text-slate-500">PM {populatedName(project.projectManagerUserId)}</span>
        {project.capacityTpd != null && (
          <span className="text-xs text-slate-500">{project.capacityTpd} TPD</span>
        )}
      </div>
    </div>
  );
}
