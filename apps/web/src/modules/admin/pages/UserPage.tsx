import { ALL_ROLES } from "@methanova/shared-types";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "../../../components/Button";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { Field } from "../../../components/Field";
import { FilterBar, filterRows } from "../../../components/FilterBar";
import { IdentityCell } from "../../../components/IdentityCell";
import { Modal } from "../../../components/Modal";
import { PageHeader } from "../../../components/PagePrimitives";
import { ResourceTable, type ResourceColumn } from "../../../components/ResourceTable";
import { useToast } from "../../../components/Toast";
import { ApiError } from "../../../lib/apiClient";
import { emptyStateMessage } from "../../../lib/emptyState";
import { RoleBadge } from "../components/RoleBadge";
import { usersApi } from "../api/users.api";
import type { UserRow } from "../types";

const columns: ResourceColumn<UserRow>[] = [
  {
    key: "name",
    label: "Name",
    sortable: true,
    render: (row) => <IdentityCell name={row.name} secondary={row.email} />,
  },
  { key: "role", label: "Role", sortable: true, render: (row) => <RoleBadge role={row.role} /> },
];

type Draft = { name: string; email: string; role: string; password: string };

const emptyDraft: Draft = { name: "", email: "", role: ALL_ROLES[0], password: "" };

export function UserPage() {
  const { data, isLoading, error } = usersApi.useList();
  const create = usersApi.useCreate();
  const update = usersApi.useUpdate();
  const remove = usersApi.useRemove();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<UserRow | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [deactivating, setDeactivating] = useState<UserRow | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const rows = filterRows(data ?? [], search, ["name", "email", "role"]);

  function openNew() {
    setDraft(emptyDraft);
    setFormError(null);
    setEditing("new");
  }

  function openEdit(row: UserRow) {
    setDraft({ name: row.name, email: row.email, role: row.role, password: "" });
    setFormError(null);
    setEditing(row);
  }

  async function save() {
    setFormError(null);
    try {
      if (editing === "new") {
        await create.mutateAsync(draft as Partial<UserRow>);
        toast({ message: "User created" });
      } else if (editing) {
        const payload: Partial<UserRow> = { name: draft.name, email: draft.email, role: draft.role };
        if (draft.password) (payload as { password?: string }).password = draft.password;
        await update.mutateAsync({ id: editing._id, payload });
        toast({ message: "User updated" });
      }
      setEditing(null);
    } catch (caught) {
      setFormError(caught instanceof ApiError ? caught.message : "Could not save that user.");
    }
  }

  async function confirmDeactivate() {
    if (!deactivating) return;
    setFormError(null);
    try {
      await remove.mutateAsync(deactivating._id);
      toast({ message: "User deactivated" });
      setDeactivating(null);
    } catch (caught) {
      setFormError(caught instanceof ApiError ? caught.message : "Could not deactivate that user.");
    }
  }

  return (
    <div>
      <PageHeader title="Users" subtitle="One global role per person. Deactivating a Project Manager is refused until the plant is reassigned.">
        <Button icon={<Plus className="h-4 w-4" />} onClick={openNew}>
          Add user
        </Button>
      </PageHeader>
      <FilterBar search={search} onSearchChange={setSearch} placeholder="Search users by name, email or role…" />
      <ResourceTable
        rows={rows}
        columns={columns}
        isLoading={isLoading}
        error={error as Error | null}
        onRowClick={openEdit}
        rowActions={(row) => (
          <Button size="sm" variant="danger" onClick={() => { setFormError(null); setDeactivating(row); }}>
            Deactivate
          </Button>
        )}
        emptyHint={emptyStateMessage({ entityLabel: "users", hasSearch: Boolean(search) })}
      />
      <Modal
        open={Boolean(editing)}
        title={editing === "new" ? "Add user" : "Edit user"}
        onRequestClose={() => setEditing(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={() => void save()} isPending={create.isPending || update.isPending} pendingLabel="Saving…">
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Name" htmlFor="uname" required>
            <input id="uname" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          </Field>
          <Field label="Email" htmlFor="uemail" required>
            <input
              id="uemail"
              type="email"
              value={draft.email}
              onChange={(event) => setDraft({ ...draft, email: event.target.value })}
            />
          </Field>
          <Field label="Role" htmlFor="urole" required>
            <select id="urole" value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value })}>
              {ALL_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label={editing === "new" ? "Password" : "New password (optional)"}
            htmlFor="upass"
            required={editing === "new"}
            hint="At least 8 characters. A role change needs a new login before the JWT updates."
          >
            <input
              id="upass"
              type="password"
              value={draft.password}
              onChange={(event) => setDraft({ ...draft, password: event.target.value })}
            />
          </Field>
          {formError && <p className="text-sm text-rose-700">{formError}</p>}
        </div>
      </Modal>
      <ConfirmDialog
        open={Boolean(deactivating)}
        title="Deactivate this user?"
        confirmLabel="Deactivate"
        onConfirm={() => void confirmDeactivate()}
        onCancel={() => { setDeactivating(null); setFormError(null); }}
        isPending={remove.isPending}
        error={formError}
      >
        They will no longer appear in pickers. If they are still the Project Manager on a plant, the server will refuse
        with 409 until you reassign that seat.
      </ConfirmDialog>
    </div>
  );
}
