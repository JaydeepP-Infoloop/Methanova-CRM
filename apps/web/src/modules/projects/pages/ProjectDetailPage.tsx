import { AccessLevel, AppModule, canAccess, nextStates, ProjectStatus, Role } from "@methanova/shared-types";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../../app/providers";
import { Breadcrumb } from "../../../components/Breadcrumb";
import { Button } from "../../../components/Button";
import { Card } from "../../../components/Card";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { Field } from "../../../components/Field";
import { FileDrop } from "../../../components/FileDrop";
import { LetterheadPreview } from "../../../components/LetterheadPreview";
import { PageHeader } from "../../../components/PagePrimitives";
import { Skeleton } from "../../../components/Skeleton";
import { useToast } from "../../../components/Toast";
import { ApiError } from "../../../lib/apiClient";
import { useAssignableUsers } from "../../crm/api/activities.api";
import { fileToDataUrl } from "../../admin/api/letterhead.api";
import {
  projectApi,
  useInheritProjectLetterhead,
  useProjectAudit,
  useReplaceMembers,
  useResetProjectLetterhead,
  useUploadProjectLetterhead,
} from "../api/project.api";
import { ProjectHeader } from "../components/ProjectHeader";
import { populatedId, populatedName, type ProjectMember, type ProjectRow } from "../types";

type Tab = "overview" | "team" | "identity" | "documents" | "audit";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "team", label: "Team" },
  { id: "identity", label: "Identity" },
  { id: "documents", label: "Documents" },
  { id: "audit", label: "Audit" },
];

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data: project, isLoading, error } = projectApi.useItem(id);
  const [tab, setTab] = useState<Tab>("overview");
  const canManage = Boolean(user && canAccess(user.role, AppModule.projects, AccessLevel.FULL));

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (error || !project) {
    return <p className="text-sm text-rose-700">{error instanceof Error ? error.message : "Project not found."}</p>;
  }

  return (
    <div>
      <Breadcrumb items={[{ label: "Projects", to: "/app/projects" }, { label: project.code }]} />
      <PageHeader title={project.shortName?.trim() || project.name} subtitle={project.code} />
      <ProjectHeader project={project} />
      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`border-b-2 px-3 py-2 text-sm ${
              tab === item.id
                ? "border-methanova-gold font-medium text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {tab === "overview" && <OverviewTab project={project} canManage={canManage} />}
      {tab === "team" && <TeamTab project={project} canManage={canManage} />}
      {tab === "identity" && <IdentityTab project={project} canManage={canManage} />}
      {tab === "documents" && <DocumentsTab project={project} />}
      {tab === "audit" && <AuditTab id={project._id} />}
    </div>
  );
}

function OverviewTab({ project, canManage }: { project: ProjectRow; canManage: boolean }) {
  const transition = projectApi.useTransition();
  const toast = useToast();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const targets = nextStates("project", project.status);
  const setup = project.setup;

  async function confirm() {
    if (!pending) return;
    setError(null);
    try {
      await transition.mutateAsync({ id: project._id, to: pending });
      toast({ message: `Moved to ${pending.replaceAll("_", " ")}` });
      setPending(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not change status.");
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h2 className="text-sm font-semibold text-slate-900">Plant</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-slate-500">Client</dt>
            <dd>{project.name}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Site</dt>
            <dd>{project.siteAddress || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Capacity</dt>
            <dd>{project.capacityTpd != null ? `${project.capacityTpd} TPD` : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Feedstock</dt>
            <dd>{project.feedstockBasis || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Civil scope</dt>
            <dd>{project.civilScope || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Target commissioning</dt>
            <dd>
              {project.targetCommissioningDate
                ? new Date(project.targetCommissioningDate).toLocaleDateString("en-IN")
                : "—"}
            </dd>
          </div>
        </dl>
        {project.description && <p className="mt-3 text-sm text-slate-600">{project.description}</p>}
      </Card>
      <Card>
        <h2 className="text-sm font-semibold text-slate-900">Setup checklist</h2>
        <ul className="mt-3 space-y-2 text-sm">
          <CheckItem done={setup?.mouSigned} label="MOU signed — this plant exists because of that" />
          <CheckItem done={setup?.projectManagerAssigned} label="Project Manager assigned" />
          <CheckItem done={setup?.teamAssigned} label="Internal team listed" />
          <CheckItem done={setup?.letterheadReady} label="Letterhead available (plant or Methanova)" />
        </ul>
        {canManage && targets.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {targets.map((to) => (
              <Button key={to} size="sm" variant="secondary" onClick={() => setPending(to)}>
                Move to {to.replaceAll("_", " ")}
              </Button>
            ))}
          </div>
        )}
      </Card>
      <ConfirmDialog
        open={Boolean(pending)}
        title="Change project status?"
        confirmLabel={pending ? `Move to ${pending.replaceAll("_", " ")}` : "Confirm"}
        onConfirm={() => void confirm()}
        onCancel={() => {
          setPending(null);
          setError(null);
        }}
        isPending={transition.isPending}
        error={error}
      >
        Legal transitions only. Status colours stay the system StatusPill map.
      </ConfirmDialog>
    </div>
  );
}

function CheckItem({ done, label }: { done?: boolean; label: string }) {
  return (
    <li className="flex gap-2">
      <span className={done ? "text-emerald-700" : "text-slate-400"}>{done ? "Done" : "Open"}</span>
      <span>{label}</span>
    </li>
  );
}

function TeamTab({ project, canManage }: { project: ProjectRow; canManage: boolean }) {
  const users = useAssignableUsers();
  const update = projectApi.useUpdate();
  const replace = useReplaceMembers();
  const toast = useToast();
  const colleagues = users.data ?? [];
  const [pmId, setPmId] = useState(populatedId(project.projectManagerUserId) ?? "");
  const [selected, setSelected] = useState<string[]>(() =>
    (project.members ?? [])
      .map((row) => populatedId(typeof row.userId === "object" ? row.userId : row.userId))
      .filter((value): value is string => Boolean(value)),
  );
  const [error, setError] = useState<string | null>(null);

  const managers = colleagues.filter((row) => row.role === Role.PROJECT_MANAGER || row.role === Role.DIRECTOR);

  async function save() {
    setError(null);
    try {
      await update.mutateAsync({
        id: project._id,
        payload: { projectManagerUserId: pmId || null } as Partial<ProjectRow>,
      });
      await replace.mutateAsync({ id: project._id, userIds: selected });
      toast({ message: "Team updated" });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not save the team.");
    }
  }

  return (
    <Card>
      <p className="text-sm text-slate-600">
        Everyone keeps their global role. Membership records who is on this plant; it does not rewrite
        permissions today.
      </p>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Field label="Project Manager" htmlFor="pm">
          <select
            id="pm"
            disabled={!canManage}
            value={pmId}
            onChange={(event) => setPmId(event.target.value)}
          >
            <option value="">Unassigned</option>
            {managers.map((row) => (
              <option key={row._id} value={row._id}>
                {row.name} · {row.role}
              </option>
            ))}
          </select>
        </Field>
        <div>
          <p className="text-xs font-medium text-slate-700">Members</p>
          <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto text-sm">
            {colleagues.map((row) => (
              <li key={row._id}>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    disabled={!canManage}
                    checked={selected.includes(row._id)}
                    onChange={(event) => {
                      setSelected((current) =>
                        event.target.checked ? [...current, row._id] : current.filter((id) => id !== row._id),
                      );
                    }}
                  />
                  <span>
                    {row.name}{" "}
                    <span className="text-xs text-slate-500">{row.role.replaceAll("_", " ")}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}
      {canManage && (
        <div className="mt-4">
          <Button onClick={() => void save()} isPending={update.isPending || replace.isPending} pendingLabel="Saving…">
            Save team
          </Button>
        </div>
      )}
      {!canManage && (
        <ul className="mt-4 text-sm text-slate-600">
          {(project.members ?? []).map((row: ProjectMember) => (
            <li key={populatedId(typeof row.userId === "object" ? row.userId : row.userId) ?? String(row.userId)}>
              {populatedName(typeof row.userId === "object" ? row.userId : row.userId)}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function IdentityTab({ project, canManage }: { project: ProjectRow; canManage: boolean }) {
  const closed =
    project.status === ProjectStatus.HANDED_OVER || project.status === ProjectStatus.OM;
  const update = projectApi.useUpdate();
  const upload = useUploadProjectLetterhead();
  const inherit = useInheritProjectLetterhead();
  const reset = useResetProjectLetterhead();
  const toast = useToast();
  const [name, setName] = useState(project.name);
  const [shortName, setShortName] = useState(project.shortName ?? "");
  const [description, setDescription] = useState(project.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"inherit" | "reset" | null>(null);

  const readOnly = !canManage || closed;

  async function saveIdentity() {
    setError(null);
    try {
      await update.mutateAsync({
        id: project._id,
        payload: { name, shortName: shortName || null, description: description || null } as Partial<ProjectRow>,
      });
      toast({ message: "Identity saved" });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not save identity.");
    }
  }

  async function onLogo(file: File) {
    setError(null);
    try {
      const dataBase64 = await fileToDataUrl(file);
      await upload.mutateAsync({ id: project._id, filename: file.name, dataBase64 });
      toast({ message: "Letterhead updated" });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Upload refused.");
    }
  }

  async function runConfirm() {
    if (!confirm) return;
    setError(null);
    try {
      if (confirm === "inherit") await inherit.mutateAsync(project._id);
      else await reset.mutateAsync(project._id);
      toast({ message: confirm === "inherit" ? "Now inheriting the org letterhead" : "Copied the org letterhead onto this plant" });
      setConfirm(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not change letterhead.");
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-sm font-semibold text-slate-900">Names</h2>
        <p className="mt-1 text-xs text-slate-500">Code is immutable. Legal name can change after the plant is ACTIVE.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Client / plant name" htmlFor="pname" required>
            <input id="pname" value={name} disabled={readOnly} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="Short name (header)" htmlFor="pshort">
            <input id="pshort" value={shortName} disabled={readOnly} onChange={(event) => setShortName(event.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description" htmlFor="pdesc">
              <textarea id="pdesc" rows={3} value={description} disabled={readOnly} onChange={(event) => setDescription(event.target.value)} />
            </Field>
          </div>
        </div>
        {canManage && !closed && (
          <div className="mt-4">
            <Button onClick={() => void saveIdentity()} isPending={update.isPending} pendingLabel="Saving…">
              Save names
            </Button>
          </div>
        )}
      </Card>
      <Card>
        <h2 className="text-sm font-semibold text-slate-900">Letterhead</h2>
        <p className="mt-1 text-xs text-slate-500">
          Source: {project.letterhead?.source ?? "none"}. This mark is for the header and future PDFs — not the app chrome.
        </p>
        <div className="mt-3">
          <LetterheadPreview
            fileId={project.letterhead?.fileId}
            legalName={project.letterhead?.orgLegalName ?? "Methanova Pvt Ltd"}
            projectName={project.shortName?.trim() || project.name}
            projectCode={project.code}
          />
        </div>
        {canManage && (
          <div className="mt-4 space-y-3">
            <FileDrop disabled={upload.isPending} onFile={(file) => void onLogo(file)} />
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => setConfirm("inherit")}>
                Inherit org letterhead
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setConfirm("reset")}>
                Copy org letterhead onto this plant
              </Button>
            </div>
          </div>
        )}
      </Card>
      {error && <p className="text-sm text-rose-700">{error}</p>}
      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm === "reset" ? "Copy the Methanova logo onto this plant?" : "Drop the plant override?"}
        confirmLabel="Confirm"
        onConfirm={() => void runConfirm()}
        onCancel={() => setConfirm(null)}
        isPending={inherit.isPending || reset.isPending}
        error={error}
      >
        {confirm === "reset"
          ? "The plant will store the current org file id. Later org replacements will not rewrite this override."
          : "The plant will inherit whatever the org letterhead is, including future replacements."}
      </ConfirmDialog>
    </div>
  );
}

function DocumentsTab({ project }: { project: ProjectRow }) {
  const required = [
    { key: "mou", label: "Signed MOU", done: true },
    { key: "pm", label: "Project Manager assigned", done: Boolean(project.setup?.projectManagerAssigned) },
    { key: "letterhead", label: "Letterhead on file", done: Boolean(project.setup?.letterheadReady) },
  ];
  return (
    <Card>
      <h2 className="text-sm font-semibold text-slate-900">Required documents</h2>
      <p className="mt-1 text-sm text-slate-600">
        Kinds stay a fixed list. File uploads for MOU/SOW records are still the existing document stub — this
        checklist is the plant setup view, not a per-project form builder.
      </p>
      <ul className="mt-3 space-y-2 text-sm">
        {required.map((row) => (
          <CheckItem key={row.key} done={row.done} label={row.label} />
        ))}
      </ul>
      <p className="mt-4 text-sm">
        <Link className="text-methanova-green underline" to="/app/documents">
          Open Documents
        </Link>
      </p>
    </Card>
  );
}

function AuditTab({ id }: { id: string }) {
  const { data, isLoading, error } = useProjectAudit(id);
  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (error) return <p className="text-sm text-rose-700">{(error as Error).message}</p>;
  const rows = data ?? [];
  if (rows.length === 0) return <p className="text-sm text-slate-500">No audited changes on this project yet.</p>;
  return (
    <ol className="space-y-3">
      {rows.map((row) => (
        <li key={row._id} className="rounded-lg bg-white p-3 text-sm ring-1 ring-slate-200">
          <div className="flex flex-wrap justify-between gap-2">
            <span className="font-medium">{row.action.replaceAll("_", " ")}</span>
            <span className="text-xs text-slate-500">{new Date(row.at).toLocaleString("en-IN")}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {typeof row.actorId === "object" && row.actorId ? row.actorId.name : "System"}
          </p>
        </li>
      ))}
    </ol>
  );
}
