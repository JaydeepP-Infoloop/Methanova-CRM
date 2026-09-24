import { EMAIL_PATTERN, MOBILE_PATTERN } from "@methanova/shared-types";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../../../components/Button";
import { CONTROL_CLASS } from "../../../components/Field";
import { Modal } from "../../../components/Modal";
import { useToast } from "../../../components/Toast";
import { ApiError } from "../../../lib/apiClient";
import { useUpdateLeadContacts, type ContactPayload } from "../api/leads.api";

const inputClass = CONTROL_CLASS;

export interface ContactDraft {
  name: string;
  designation: string;
  mobile: string;
  email: string;
  isPrimary: boolean;
  isDecisionMaker: boolean;
}

export interface EditContactsModalProps {
  open: boolean;
  leadId?: string;
  leadLabel: string;
  contacts: {
    name: string;
    designation?: string;
    mobile: string;
    email?: string;
    isPrimary: boolean;
    isDecisionMaker: boolean;
  }[];
  onClose: () => void;
}

const emptyContact = (isPrimary: boolean): ContactDraft => ({
  name: "",
  designation: "",
  mobile: "",
  email: "",
  isPrimary,
  isDecisionMaker: false,
});

export function EditContactsModal({ open, leadId, leadLabel, contacts, onClose }: EditContactsModalProps) {
  const toast = useToast();
  const update = useUpdateLeadContacts(leadId);
  const [rows, setRows] = useState<ContactDraft[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  // Re-seed from the server copy each time the modal opens, so a cancelled
  // edit leaves nothing behind for the next one to inherit.
  useEffect(() => {
    if (!open) return;
    setRows(
      contacts.map((contact) => ({
        name: contact.name,
        designation: contact.designation ?? "",
        mobile: contact.mobile,
        email: contact.email ?? "",
        isPrimary: contact.isPrimary,
        isDecisionMaker: contact.isDecisionMaker,
      })),
    );
    setErrors({});
    setFormError(null);
  }, [open, contacts]);

  /**
   * Every updater derives from current state rather than the closed-over
   * `rows`. Two quick clicks before React re-renders would otherwise drop one
   * of them — the same stale-closure bug the intake wizard's feedstock chips hit.
   */
  function patchRow(index: number, changes: Partial<ContactDraft>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...changes } : row)));
  }

  function addRow() {
    setRows((current) => [...current, emptyContact(current.length === 0)]);
  }

  /** Primary is a radio across rows, not an independent checkbox: choosing one clears the rest. */
  function setPrimary(index: number) {
    setRows((current) => current.map((row, i) => ({ ...row, isPrimary: i === index })));
  }

  function removeRow(index: number) {
    setRows((current) => {
      const next = current.filter((_, i) => i !== index);
      // Removing the primary would leave none — promote the first survivor
      // rather than letting the user hit a server rejection for it.
      if (next.length > 0 && !next.some((row) => row.isPrimary)) {
        next[0] = { ...next[0], isPrimary: true };
      }
      return next;
    });
  }

  function validate(): boolean {
    const found: Record<string, string> = {};
    rows.forEach((row, index) => {
      if (!row.name.trim()) found[`${index}.name`] = "Name is required";
      if (!MOBILE_PATTERN.test(row.mobile)) found[`${index}.mobile`] = "Mobile must be 10 digits";
      if (row.email && !EMAIL_PATTERN.test(row.email)) found[`${index}.email`] = "Enter a valid email";
    });
    setErrors(found);

    if (rows.length === 0) {
      setFormError("A lead needs at least one contact");
      return false;
    }
    if (rows.filter((row) => row.isPrimary).length !== 1) {
      setFormError("Exactly one contact must be primary");
      return false;
    }
    setFormError(Object.keys(found).length > 0 ? "Fix the highlighted fields" : null);
    return Object.keys(found).length === 0;
  }

  async function save() {
    if (!validate()) return;
    const payload: ContactPayload[] = rows.map((row) => ({
      name: row.name.trim(),
      designation: row.designation.trim() || undefined,
      mobile: row.mobile.trim(),
      email: row.email.trim() || undefined,
      isPrimary: row.isPrimary,
      isDecisionMaker: row.isDecisionMaker,
    }));

    try {
      await update.mutateAsync(payload);
      toast({ message: `Contacts updated for ${leadLabel}` });
      onClose();
    } catch (caught) {
      setFormError(caught instanceof ApiError ? caught.message : "Could not save the contacts");
    }
  }

  return (
    <Modal
      open={open}
      title="Edit contacts"
      description={`Who we speak to at ${leadLabel}. Exactly one must be the primary contact.`}
      onRequestClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void save()} isPending={update.isPending} pendingLabel="Saving…">
            Save contacts
          </Button>
        </div>
      }
    >
      {formError && (
        <p role="alert" className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-600/20">
          {formError}
        </p>
      )}

      <div className="space-y-3">
        {rows.map((row, index) => (
          <div key={index} className="rounded-lg border border-slate-200 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Contact {index + 1}
              </span>
              <button
                type="button"
                onClick={() => removeRow(index)}
                aria-label={`Remove contact ${index + 1}`}
                className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Name" htmlFor={`contact-name-${index}`} required error={errors[`${index}.name`]}>
                <input
                  id={`contact-name-${index}`}
                  className={inputClass}
                  value={row.name}
                  onChange={(event) => patchRow(index, { name: event.target.value })}
                />
              </Field>
              <Field label="Designation" htmlFor={`contact-designation-${index}`}>
                <input
                  id={`contact-designation-${index}`}
                  className={inputClass}
                  value={row.designation}
                  onChange={(event) => patchRow(index, { designation: event.target.value })}
                />
              </Field>
              <Field label="Mobile" htmlFor={`contact-mobile-${index}`} required error={errors[`${index}.mobile`]}>
                <input
                  id={`contact-mobile-${index}`}
                  inputMode="numeric"
                  maxLength={10}
                  className={inputClass}
                  value={row.mobile}
                  onChange={(event) => patchRow(index, { mobile: event.target.value.replace(/\D/g, "") })}
                />
              </Field>
              <Field label="Email" htmlFor={`contact-email-${index}`} error={errors[`${index}.email`]}>
                <input
                  id={`contact-email-${index}`}
                  type="email"
                  className={inputClass}
                  value={row.email}
                  onChange={(event) => patchRow(index, { email: event.target.value })}
                />
              </Field>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="radio"
                  name="primaryContact"
                  checked={row.isPrimary}
                  onChange={() => setPrimary(index)}
                  className="h-3.5 w-3.5 border-slate-300 text-methanova-green focus-visible:ring-methanova-gold"
                />
                Primary contact
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={row.isDecisionMaker}
                  onChange={(event) => patchRow(index, { isDecisionMaker: event.target.checked })}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-methanova-green focus-visible:ring-methanova-gold"
                />
                Decision maker
              </label>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Add another contact
        </button>
      </div>
    </Modal>
  );
}

function Field({
  label,
  htmlFor,
  required,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-xs font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-rose-600">*</span>}
      </label>
      <div className="mt-1">{children}</div>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
