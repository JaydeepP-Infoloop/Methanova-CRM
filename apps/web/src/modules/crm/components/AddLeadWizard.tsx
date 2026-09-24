import {
  CIN_PATTERN,
  EMAIL_PATTERN,
  EntityType,
  FeedstockTieupStatus,
  GSTIN_PATTERN,
  MOBILE_PATTERN,
  PAN_PATTERN,
} from "@methanova/shared-types";
import { AlertTriangle, Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { Button } from "../../../components/Button";
import { Field, CONTROL_CLASS } from "../../../components/Field";
import { Modal } from "../../../components/Modal";
import { Stepper } from "../../../components/Stepper";
import { ApiError } from "../../../lib/apiClient";
import { croreToPaise, formatPaise } from "../../../lib/formatters";
import { useCreateLead, useDuplicateCheck, useExpectedCbg } from "../api/leads.api";
import {
  useDistricts,
  useFeedstockTypes,
  useLeadSources,
  useStates,
  useTalukas,
  useVillages,
} from "../api/masters.api";

interface ContactDraft {
  name: string;
  designation: string;
  mobile: string;
  email: string;
  isPrimary: boolean;
  isDecisionMaker: boolean;
}

interface LeadDraft {
  companyName: string;
  entityType: string;
  gstin: string;
  pan: string;
  cin: string;
  stateId: string;
  districtId: string;
  talukaId: string;
  villageId: string;
  registeredAddress: string;
  siteAddress: string;
  /** Held as the crore string the user typed; converted to integer paise on submit. */
  indicativeValueCrore: string;
  contacts: ContactDraft[];
  leadSourceId: string;
  sourceDetail: string;
  feedstockTypeIds: string[];
  feedstockQtyTpd: string;
  feedstockTieupStatus: string;
  nextAction: string;
  nextActionDate: string;
}

function tomorrowIso(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

const emptyContact = (isPrimary: boolean): ContactDraft => ({
  name: "",
  designation: "",
  mobile: "",
  email: "",
  isPrimary,
  isDecisionMaker: false,
});

const emptyDraft = (): LeadDraft => ({
  companyName: "",
  entityType: "",
  gstin: "",
  pan: "",
  cin: "",
  stateId: "",
  districtId: "",
  talukaId: "",
  villageId: "",
  registeredAddress: "",
  siteAddress: "",
  indicativeValueCrore: "",
  contacts: [emptyContact(true)],
  leadSourceId: "",
  sourceDetail: "",
  feedstockTypeIds: [],
  feedstockQtyTpd: "",
  feedstockTieupStatus: "",
  nextAction: "",
  nextActionDate: tomorrowIso(),
});

const STEPS = ["Company & Location", "Contact", "Source & Feedstock"];

/** Which step owns which field — used to route server-side validation errors back to their step. */
const FIELD_STEP: Record<string, number> = {
  companyName: 0, entityType: 0, gstin: 0, pan: 0, cin: 0,
  stateId: 0, districtId: 0, talukaId: 0, villageId: 0,
  registeredAddress: 0, siteAddress: 0, indicativeValuePaise: 0,
  contacts: 1,
  leadSourceId: 2, sourceDetail: 2, feedstockTypeIds: 2, feedstockQtyTpd: 2,
  feedstockTieupStatus: 2, nextAction: 2, nextActionDate: 2,
};

type Errors = Record<string, string>;

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function validateStep(step: number, draft: LeadDraft, detailRequired: boolean): Errors {
  const errors: Errors = {};
  const check = (condition: boolean, key: string, message: string) => {
    if (condition) errors[key] = message;
  };

  if (step === 0) {
    check(!draft.companyName.trim(), "companyName", "Company name is required");
    check(Boolean(draft.gstin) && !GSTIN_PATTERN.test(draft.gstin.toUpperCase()), "gstin", "GSTIN format looks wrong");
    check(Boolean(draft.pan) && !PAN_PATTERN.test(draft.pan.toUpperCase()), "pan", "PAN format looks wrong");
    check(Boolean(draft.cin) && !CIN_PATTERN.test(draft.cin.toUpperCase()), "cin", "CIN format looks wrong");
    check(!draft.stateId, "stateId", "State is required");
    check(!draft.districtId, "districtId", "District is required");
    check(!draft.talukaId, "talukaId", "Taluka is required");
  }

  if (step === 1) {
    draft.contacts.forEach((contact, index) => {
      check(!contact.name.trim(), `contacts.${index}.name`, "Name is required");
      check(!MOBILE_PATTERN.test(contact.mobile), `contacts.${index}.mobile`, "Mobile must be 10 digits");
      check(
        Boolean(contact.email) && !EMAIL_PATTERN.test(contact.email),
        `contacts.${index}.email`,
        "Enter a valid email",
      );
    });
    check(draft.contacts.filter((c) => c.isPrimary).length !== 1, "contacts", "Exactly one contact must be primary");
  }

  if (step === 2) {
    check(!draft.leadSourceId, "leadSourceId", "Lead source is required");
    check(detailRequired && !draft.sourceDetail.trim(), "sourceDetail", "This source needs a detail");
    check(draft.feedstockQtyTpd === "" || Number(draft.feedstockQtyTpd) < 0, "feedstockQtyTpd", "Enter a quantity");
    check(!draft.nextAction.trim(), "nextAction", "Next action is required");
    if (!draft.nextActionDate) {
      errors.nextActionDate = "Next action date is required";
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      check(new Date(draft.nextActionDate) < today, "nextActionDate", "Date cannot be in the past");
    }
  }

  return errors;
}

const inputClass = CONTROL_CLASS;

export interface AddLeadWizardProps {
  open: boolean;
  onClose: () => void;
  onCreated: (lead: { _id: string; leadCode: string }) => void;
}

export function AddLeadWizard({ open, onClose, onCreated }: AddLeadWizardProps) {
  const [draft, setDraft] = useState<LeadDraft>(emptyDraft);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [stepErrorFlags, setStepErrorFlags] = useState<boolean[]>([false, false, false]);
  const [touched, setTouched] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  const createLead = useCreateLead();

  const states = useStates();
  const districts = useDistricts(draft.stateId);
  const talukas = useTalukas(draft.districtId);
  const villages = useVillages(draft.talukaId);
  const leadSources = useLeadSources();
  const feedstockTypes = useFeedstockTypes();

  const selectedSource = leadSources.data?.find((source) => source._id === draft.leadSourceId);
  const detailRequired = Boolean(selectedSource?.detailRequired);

  const debouncedName = useDebounced(draft.companyName, 400);
  const duplicates = useDuplicateCheck(debouncedName);

  const debouncedFeedstock = useDebounced(draft.feedstockTypeIds, 400);
  const debouncedQty = useDebounced(draft.feedstockQtyTpd, 400);
  const expectedCbg = useExpectedCbg(debouncedFeedstock, Number(debouncedQty) || 0);

  // Reset to a clean draft each time the wizard opens, so a discarded attempt
  // never bleeds into the next one.
  useEffect(() => {
    if (open) {
      setDraft(emptyDraft());
      setStep(0);
      setErrors({});
      setStepErrorFlags([false, false, false]);
      setTouched(false);
      setBanner(null);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      window.setTimeout(() => firstFieldRef.current?.focus(), 50);
    }
  }, [open, step]);

  function patch(changes: Partial<LeadDraft>) {
    setTouched(true);
    setDraft((current) => ({ ...current, ...changes }));
  }

  /**
   * Derives the next value from current state rather than the closed-over
   * draft. Computing `[...draft.feedstockTypeIds, id]` outside the updater
   * loses a selection when two chips are clicked before React re-renders —
   * which a fast user does routinely.
   */
  function updateDraft(update: (current: LeadDraft) => LeadDraft) {
    setTouched(true);
    setDraft(update);
  }

  function toggleFeedstock(typeId: string) {
    updateDraft((current) => ({
      ...current,
      feedstockTypeIds: current.feedstockTypeIds.includes(typeId)
        ? current.feedstockTypeIds.filter((id) => id !== typeId)
        : [...current.feedstockTypeIds, typeId],
    }));
  }

  function addContact() {
    updateDraft((current) => ({ ...current, contacts: [...current.contacts, emptyContact(false)] }));
  }

  function patchContact(index: number, changes: Partial<ContactDraft>) {
    setTouched(true);
    setDraft((current) => ({
      ...current,
      contacts: current.contacts.map((contact, i) => (i === index ? { ...contact, ...changes } : contact)),
    }));
  }

  /** Primary is a radio across rows, not an independent checkbox: choosing one clears the rest. */
  function setPrimary(index: number) {
    setTouched(true);
    setDraft((current) => ({
      ...current,
      contacts: current.contacts.map((contact, i) => ({ ...contact, isPrimary: i === index })),
    }));
  }

  function removeContact(index: number) {
    setTouched(true);
    setDraft((current) => {
      const contacts = current.contacts.filter((_, i) => i !== index);
      // Removing the primary would leave none — promote the first survivor.
      if (!contacts.some((contact) => contact.isPrimary) && contacts.length > 0) {
        contacts[0] = { ...contacts[0], isPrimary: true };
      }
      return { ...current, contacts };
    });
  }

  function markStepValidity(index: number, isValid: boolean) {
    setStepErrorFlags((flags) => flags.map((flag, i) => (i === index ? !isValid : flag)));
  }

  function goNext() {
    const stepErrors = validateStep(step, draft, detailRequired);
    setErrors(stepErrors);
    markStepValidity(step, Object.keys(stepErrors).length === 0);
    if (Object.keys(stepErrors).length > 0) return;
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  }

  function goBack() {
    setBanner(null);
    setStep((current) => Math.max(current - 1, 0));
  }

  function requestClose() {
    if (touched) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  }

  async function submit() {
    setBanner(null);
    // Validate every step, not just the visible one, and land on the first
    // that fails rather than rejecting silently.
    const perStep = STEPS.map((_, index) => validateStep(index, draft, detailRequired));
    setStepErrorFlags(perStep.map((stepErrors) => Object.keys(stepErrors).length > 0));
    const firstInvalid = perStep.findIndex((stepErrors) => Object.keys(stepErrors).length > 0);
    if (firstInvalid !== -1) {
      setStep(firstInvalid);
      setErrors(perStep[firstInvalid]);
      return;
    }

    try {
      const created = await createLead.mutateAsync({
        companyName: draft.companyName.trim(),
        entityType: draft.entityType || null,
        gstin: draft.gstin ? draft.gstin.toUpperCase() : undefined,
        pan: draft.pan ? draft.pan.toUpperCase() : undefined,
        cin: draft.cin ? draft.cin.toUpperCase() : undefined,
        contacts: draft.contacts.map((contact) => ({
          name: contact.name.trim(),
          designation: contact.designation || undefined,
          mobile: contact.mobile.trim(),
          email: contact.email || undefined,
          isPrimary: contact.isPrimary,
          isDecisionMaker: contact.isDecisionMaker,
        })),
        stateId: draft.stateId,
        districtId: draft.districtId,
        talukaId: draft.talukaId,
        villageId: draft.villageId || null,
        registeredAddress: draft.registeredAddress || undefined,
        siteAddress: draft.siteAddress || undefined,
        indicativeValuePaise: croreToPaise(draft.indicativeValueCrore),
        leadSourceId: draft.leadSourceId,
        sourceDetail: draft.sourceDetail || undefined,
        feedstockTypeIds: draft.feedstockTypeIds,
        feedstockQtyTpd: Number(draft.feedstockQtyTpd),
        feedstockTieupStatus: draft.feedstockTieupStatus || null,
        nextAction: draft.nextAction.trim(),
        nextActionDate: draft.nextActionDate,
      });
      onCreated(created);
    } catch (caught) {
      if (caught instanceof ApiError && caught.body.fieldErrors) {
        // Route each server message to the step that owns its field and jump there.
        const serverErrors: Errors = {};
        let targetStep = step;
        let found = false;
        for (const [path, messages] of Object.entries(caught.body.fieldErrors)) {
          serverErrors[path] = messages[0];
          const owner = FIELD_STEP[path.split(".")[0]];
          if (owner !== undefined && !found) {
            targetStep = owner;
            found = true;
          }
        }
        setErrors(serverErrors);
        setStep(targetStep);
        setBanner(caught.body.error ?? "Please correct the highlighted fields.");
        return;
      }
      // Network or server fault: keep everything the user typed and let them retry.
      setBanner(caught instanceof Error ? caught.message : "Could not create the lead. Please try again.");
    }
  }

  function onKeyDownCapture(event: React.KeyboardEvent) {
    // Enter advances on the first two steps; on step three it would be
    // ambiguous with submitting, so the explicit button is required.
    if (event.key === "Enter" && step < 2) {
      const target = event.target as HTMLElement;
      if (target.tagName !== "TEXTAREA") {
        event.preventDefault();
        goNext();
      }
    }
  }

  const selectedFeedstockLabels = feedstockTypes.data
    ?.filter((type) => draft.feedstockTypeIds.includes(type._id))
    .map((type) => type.label);
  const stateName = states.data?.find((s) => s._id === draft.stateId)?.name;
  const districtName = districts.data?.find((d) => d._id === draft.districtId)?.name;
  const talukaName = talukas.data?.find((t) => t._id === draft.talukaId)?.name;

  return (
    <>
      <Modal
        open={open}
        title="Add Lead"
        description="Capture a new enquiry. It lands unassigned in the inbox."
        onRequestClose={requestClose}
        footer={
          <div className="flex items-center justify-between gap-3">
            <Button variant="secondary" onClick={requestClose}>
              Cancel
            </Button>
            <div className="flex items-center gap-2">
              {step > 0 && (
                <Button variant="secondary" onClick={goBack}>
                  Back
                </Button>
              )}
              {step < STEPS.length - 1 ? (
                <Button onClick={goNext}>Next</Button>
              ) : (
                <Button onClick={() => void submit()} isPending={createLead.isPending} pendingLabel="Creating…">
                  Create Lead
                </Button>
              )}
            </div>
          </div>
        }
      >
        <div onKeyDownCapture={onKeyDownCapture}>
          <Stepper
            steps={STEPS.map((label, index) => ({ label, hasError: index < step && stepErrorFlags[index] }))}
            current={step}
            onStepClick={(index) => index < step && setStep(index)}
          />

          {banner && (
            <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-600/20">
              {banner}
            </p>
          )}

          {step === 0 && (
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Company name" htmlFor="companyName" required error={errors.companyName}>
                  <input
                    id="companyName"
                    ref={firstFieldRef as React.RefObject<HTMLInputElement>}
                    className={inputClass}
                    value={draft.companyName}
                    onChange={(event) => patch({ companyName: event.target.value })}
                    placeholder="Registered name of the company"
                  />
                </Field>
                {duplicates.data && duplicates.data.length > 0 && (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-amber-700">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    Possible duplicate:{" "}
                    {duplicates.data.map((duplicate, index) => (
                      <span key={duplicate._id}>
                        {index > 0 && ", "}
                        <a
                          href={`/app/crm/leads/${duplicate._id}`}
                          className="font-medium underline underline-offset-2"
                        >
                          {duplicate.leadCode}
                        </a>
                      </span>
                    ))}
                    {" — you can continue anyway."}
                  </p>
                )}
              </div>

              <Field label="Entity type" htmlFor="entityType">
                <select
                  id="entityType"
                  className={inputClass}
                  value={draft.entityType}
                  onChange={(event) => patch({ entityType: event.target.value })}
                >
                  <option value="">Not specified</option>
                  {Object.values(EntityType).map((value) => (
                    <option key={value} value={value}>
                      {value.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="GSTIN" htmlFor="gstin" error={errors.gstin}>
                <input id="gstin" className={inputClass} value={draft.gstin} onChange={(e) => patch({ gstin: e.target.value })} placeholder="24AABCU9603R1ZM" />
              </Field>
              <Field label="PAN" htmlFor="pan" error={errors.pan}>
                <input id="pan" className={inputClass} value={draft.pan} onChange={(e) => patch({ pan: e.target.value })} placeholder="AABCU9603R" />
              </Field>
              <Field label="CIN" htmlFor="cin" error={errors.cin}>
                <input id="cin" className={inputClass} value={draft.cin} onChange={(e) => patch({ cin: e.target.value })} placeholder="U40100GJ2019PTC123456" />
              </Field>

              <Field label="State" htmlFor="stateId" required error={errors.stateId}>
                <select
                  id="stateId"
                  className={inputClass}
                  value={draft.stateId}
                  onChange={(e) => patch({ stateId: e.target.value, districtId: "", talukaId: "", villageId: "" })}
                >
                  <option value="">Select state</option>
                  {states.data?.map((option) => (
                    <option key={option._id} value={option._id}>{option.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="District" htmlFor="districtId" required error={errors.districtId}>
                <select
                  id="districtId"
                  className={inputClass}
                  disabled={!draft.stateId}
                  value={draft.districtId}
                  onChange={(e) => patch({ districtId: e.target.value, talukaId: "", villageId: "" })}
                >
                  <option value="">{draft.stateId ? "Select district" : "Select a state first"}</option>
                  {districts.data?.map((option) => (
                    <option key={option._id} value={option._id}>{option.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Taluka" htmlFor="talukaId" required error={errors.talukaId}>
                <select
                  id="talukaId"
                  className={inputClass}
                  disabled={!draft.districtId}
                  value={draft.talukaId}
                  onChange={(e) => patch({ talukaId: e.target.value, villageId: "" })}
                >
                  <option value="">{draft.districtId ? "Select taluka" : "Select a district first"}</option>
                  {talukas.data?.map((option) => (
                    <option key={option._id} value={option._id}>{option.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Village" htmlFor="villageId">
                <select
                  id="villageId"
                  className={inputClass}
                  disabled={!draft.talukaId}
                  value={draft.villageId}
                  onChange={(e) => patch({ villageId: e.target.value })}
                >
                  <option value="">{draft.talukaId ? "Select village (optional)" : "Select a taluka first"}</option>
                  {villages.data?.map((option) => (
                    <option key={option._id} value={option._id}>{option.name}</option>
                  ))}
                </select>
              </Field>

              <Field label="Registered address" htmlFor="registeredAddress">
                <textarea id="registeredAddress" rows={2} className={inputClass} value={draft.registeredAddress} onChange={(e) => patch({ registeredAddress: e.target.value })} />
              </Field>
              <Field label="Site address" htmlFor="siteAddress">
                <textarea id="siteAddress" rows={2} className={inputClass} value={draft.siteAddress} onChange={(e) => patch({ siteAddress: e.target.value })} />
              </Field>

              {/* Collected in crore because that is the unit these deals are
                  discussed in; converted to integer paise once, on submit. */}
              <Field label="Indicative value (₹ crore)" htmlFor="indicativeValueCrore" error={errors.indicativeValuePaise}>
                <input
                  id="indicativeValueCrore"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="e.g. 7.5"
                  className={inputClass}
                  value={draft.indicativeValueCrore}
                  onChange={(e) => patch({ indicativeValueCrore: e.target.value })}
                />
                <p className="mt-1 text-xs text-slate-500">
                  {draft.indicativeValueCrore.trim() === ""
                    ? "Optional — leave blank until there is a real number. Blank shows as an em dash, not ₹0."
                    : formatPaise(croreToPaise(draft.indicativeValueCrore) ?? 0)}
                </p>
              </Field>
            </div>
          )}

          {step === 1 && (
            <div className="mt-5 space-y-4">
              {errors.contacts && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-inset ring-rose-600/20">{errors.contacts}</p>
              )}
              {draft.contacts.map((contact, index) => (
                <div key={index} className="rounded-xl p-4 ring-1 ring-slate-200">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Contact {index + 1}</p>
                    {draft.contacts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeContact(index)}
                        aria-label={`Remove contact ${index + 1}`}
                        className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Name" htmlFor={`contact-name-${index}`} required error={errors[`contacts.${index}.name`]}>
                      <input
                        id={`contact-name-${index}`}
                        ref={index === 0 ? (firstFieldRef as React.RefObject<HTMLInputElement>) : undefined}
                        className={inputClass}
                        value={contact.name}
                        onChange={(e) => patchContact(index, { name: e.target.value })}
                      />
                    </Field>
                    <Field label="Designation" htmlFor={`contact-designation-${index}`}>
                      <input id={`contact-designation-${index}`} className={inputClass} value={contact.designation} onChange={(e) => patchContact(index, { designation: e.target.value })} />
                    </Field>
                    <Field label="Mobile" htmlFor={`contact-mobile-${index}`} required error={errors[`contacts.${index}.mobile`]}>
                      <input id={`contact-mobile-${index}`} inputMode="numeric" maxLength={10} className={inputClass} value={contact.mobile} onChange={(e) => patchContact(index, { mobile: e.target.value.replace(/\D/g, "") })} />
                    </Field>
                    <Field label="Email" htmlFor={`contact-email-${index}`} error={errors[`contacts.${index}.email`]}>
                      <input id={`contact-email-${index}`} type="email" className={inputClass} value={contact.email} onChange={(e) => patchContact(index, { email: e.target.value })} />
                    </Field>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2 text-xs text-slate-700">
                      <input
                        type="radio"
                        name="primaryContact"
                        checked={contact.isPrimary}
                        onChange={() => setPrimary(index)}
                        className="h-3.5 w-3.5 border-slate-300 text-methanova-green focus-visible:ring-methanova-gold"
                      />
                      Primary contact
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={contact.isDecisionMaker}
                        onChange={(e) => patchContact(index, { isDecisionMaker: e.target.checked })}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-methanova-green focus-visible:ring-methanova-gold"
                      />
                      Decision maker
                    </label>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addContact}
                className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Add another contact
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Lead source" htmlFor="leadSourceId" required error={errors.leadSourceId}>
                  <select
                    id="leadSourceId"
                    ref={firstFieldRef as React.RefObject<HTMLSelectElement>}
                    className={inputClass}
                    value={draft.leadSourceId}
                    onChange={(e) => patch({ leadSourceId: e.target.value })}
                  >
                    <option value="">Select source</option>
                    {leadSources.data?.map((source) => (
                      <option key={source._id} value={source._id}>{source.label}</option>
                    ))}
                  </select>
                </Field>
                <Field
                  label={selectedSource?.detailLabel ?? "Source detail"}
                  htmlFor="sourceDetail"
                  required={detailRequired}
                  error={errors.sourceDetail}
                >
                  <input
                    id="sourceDetail"
                    className={inputClass}
                    placeholder={selectedSource?.detailPlaceholder ?? "Optional context about where this came from"}
                    value={draft.sourceDetail}
                    onChange={(e) => patch({ sourceDetail: e.target.value })}
                  />
                </Field>
              </div>

              <Field label="Feedstock types" error={errors.feedstockTypeIds}>
                <div className="flex flex-wrap gap-2">
                  {feedstockTypes.data?.map((type) => {
                    const selected = draft.feedstockTypeIds.includes(type._id);
                    return (
                      <button
                        key={type._id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleFeedstock(type._id)}
                        className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold ${
                          selected
                            ? "bg-methanova-greenTint text-methanova-green ring-methanova-green/30"
                            : "bg-white text-slate-600 ring-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        {type.label}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Feedstock quantity (TPD)" htmlFor="feedstockQtyTpd" required error={errors.feedstockQtyTpd}>
                  <input id="feedstockQtyTpd" type="number" min="0" step="0.01" className={inputClass} value={draft.feedstockQtyTpd} onChange={(e) => patch({ feedstockQtyTpd: e.target.value })} />
                </Field>
                <Field label="Feedstock tie-up" htmlFor="feedstockTieupStatus">
                  <select id="feedstockTieupStatus" className={inputClass} value={draft.feedstockTieupStatus} onChange={(e) => patch({ feedstockTieupStatus: e.target.value })}>
                    <option value="">Not specified</option>
                    {Object.values(FeedstockTieupStatus).map((value) => (
                      <option key={value} value={value}>{value.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Expected CBG (TPD)" hint="Calculated from yield factors">
                  <div className="flex h-[38px] items-center gap-2 rounded-lg bg-slate-50 px-3 text-sm tabular-nums text-slate-700 ring-1 ring-inset ring-slate-200">
                    {expectedCbg.data && expectedCbg.data.unconfiguredTypes.length > 0 ? (
                      <>
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden="true" />
                        <span title={`No yield factor configured for ${expectedCbg.data.unconfiguredTypes.map((t) => t.label).join(", ")}`}>
                          —
                        </span>
                      </>
                    ) : expectedCbg.isFetching ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" aria-hidden="true" />
                    ) : (
                      <span>{expectedCbg.data ? expectedCbg.data.expectedCbgTpd : "—"}</span>
                    )}
                  </div>
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Next action" htmlFor="nextAction" required error={errors.nextAction}>
                  <input id="nextAction" className={inputClass} placeholder="e.g. Call to schedule a site visit" value={draft.nextAction} onChange={(e) => patch({ nextAction: e.target.value })} />
                </Field>
                <Field label="Next action date" htmlFor="nextActionDate" required error={errors.nextActionDate}>
                  <input id="nextActionDate" type="date" className={inputClass} value={draft.nextActionDate} onChange={(e) => patch({ nextActionDate: e.target.value })} />
                </Field>
              </div>

              <section className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Review</h3>
                <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
                  {[
                    ["Company", draft.companyName || "—"],
                    ["Entity type", draft.entityType ? draft.entityType.replace(/_/g, " ") : "—"],
                    ["GSTIN / PAN", [draft.gstin, draft.pan].filter(Boolean).join(" · ") || "—"],
                    ["Location", [talukaName, districtName, stateName].filter(Boolean).join(", ") || "—"],
                    ["Contacts", draft.contacts.map((c) => `${c.name || "—"}${c.isPrimary ? " (primary)" : ""}`).join(", ")],
                    ["Source", selectedSource?.label ?? "—"],
                    ["Feedstock", selectedFeedstockLabels?.join(", ") || "—"],
                    ["Quantity", draft.feedstockQtyTpd ? `${draft.feedstockQtyTpd} TPD` : "—"],
                    ["Next action", draft.nextAction || "—"],
                    ["Next action date", draft.nextActionDate || "—"],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-slate-500">{label}</dt>
                      <dd className="text-slate-800">{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDiscard}
        title="Discard this lead?"
        confirmLabel="Discard"
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={() => {
          setConfirmDiscard(false);
          onClose();
        }}
      >
        <p>Everything entered so far will be lost.</p>
      </ConfirmDialog>
    </>
  );
}
