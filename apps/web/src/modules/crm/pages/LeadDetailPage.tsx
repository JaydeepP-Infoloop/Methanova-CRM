import { LEAD_STAGE_ORDER, LeadStage, LeadTemperature, nextStates } from "@methanova/shared-types";
import {
  CalendarClock,
  CornerDownRight,
  Mail,
  MoreHorizontal,
  Phone,
  Plus,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { ActivityRail, type ActivityRailItem } from "../../../components/ActivityRail";
import { Breadcrumb } from "../../../components/Breadcrumb";
import { Button } from "../../../components/Button";
import { Card } from "../../../components/Card";
import { Field } from "../../../components/Field";
import { IconButton } from "../../../components/IconButton";
import { IdentityCell } from "../../../components/IdentityCell";
import { PageHeader } from "../../../components/PagePrimitives";
import { Skeleton } from "../../../components/Skeleton";
import { Stepper } from "../../../components/Stepper";
import { StatusPill } from "../../../components/StatusPill";
import { useToast } from "../../../components/Toast";
import { formatDate, formatPaise } from "../../../lib/formatters";
import { useAssignableUsers, useAssignLead, useLeadActivities } from "../api/activities.api";
import { leadsApi, usePatchLead, useUnparkLead } from "../api/leads.api";
import { useTransitionLeadStage } from "../api/qualification.api";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { EditContactsModal } from "../components/EditContactsModal";
import { LogActivityModal } from "../components/LogActivityModal";
import { ParkLeadModal } from "../components/ParkLeadModal";
import { QualifyLeadModal } from "../components/QualifyLeadModal";
import { RescheduleNextActionModal } from "../components/RescheduleNextActionModal";

/**
 * The rail's own spine — the six stages a lead actually advances through in
 * order. WON and LOST are excluded here on purpose: the old rail rendered
 * all eight `LEAD_STAGE_ORDER` entries as one straight line, which made LOST
 * read as "the step after WON" (step 8 following step 7) when the two are
 * really two different exits off the same spine — WON only reachable from
 * MOU, LOST reachable from anywhere on it. They render as branch chips below
 * the spine instead of steps 7 and 8 on it.
 */
const LEAD_LINEAR_STAGES = LEAD_STAGE_ORDER.filter(
  (stage) => stage !== LeadStage.WON && stage !== LeadStage.LOST,
);

interface NamedRef {
  name: string;
}

interface PopulatedLead {
  _id: string;
  leadCode: string;
  companyName: string;
  stage: string;
  stageSince?: string;
  temperature: string;
  districtId?: NamedRef | null;
  stateId?: NamedRef | null;
  leadSourceId?: { label: string } | null;
  indicativeValuePaise?: number | null;
  feedstockTypeIds?: { label: string }[];
  feedstockQtyTpd: number;
  expectedCbgTpd: number;
  contacts?: {
    name: string;
    designation?: string;
    mobile: string;
    email?: string;
    isPrimary: boolean;
    isDecisionMaker: boolean;
  }[];
  nextAction: string;
  nextActionDate: string;
  /** Provenance for the commitment above — null when it was set at intake, with no activity behind it yet. */
  nextActionSourceActivityId?: { sequenceNo: number; type: string; occurredAt: string } | null;
  nextActionPromisedAt?: string | null;
  nextActionPromisedByUserId?: { name: string; email?: string } | null;
  ownerUserId?: { _id: string; name: string } | null;
  firstResponseAt?: string | null;
  lostReason?: string | null;
  competitor?: string | null;
  reengageOn?: string | null;
  /** Orthogonal to `stage` — a parked lead keeps the stage it was parked at. */
  parked?: {
    isParked: boolean;
    reason?: string | null;
    revisitDate?: string | null;
    parkedFromStage?: string | null;
    parkedAt?: string | null;
  } | null;
  qualification?: {
    scores: { criterionKey: string; score: number; note?: string | null }[];
    totalScore: number;
    decision: string | null;
    decidedAt: string | null;
    disqualificationReason?: string | null;
  } | null;
  /** Computed at read time by the server — see `getLeadDetail`. */
  ageDays: number;
  daysInStage: number;
  activitiesLoggedCount: number;
  brokenPromiseCount: number;
}

function isOverdue(value: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(value) < today;
}

function daysLate(value: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000));
}

/** Shaped like the loaded page — header band, stage rail, timeline and rail cards — so the layout doesn't jump once the lead arrives. */
function LeadDetailSkeleton() {
  return (
    <div>
      <Skeleton className="mb-3 h-4 w-32" />
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <Skeleton className="h-7 w-56" />
          <Skeleton className="mt-2 h-4 w-24" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <Skeleton className="mb-4 h-14 w-full rounded-xl" />
      <Skeleton className="mb-4 h-24 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * The "⋯" menu's dropdown panel. Closing is already instant — it fully
 * unmounts via the caller's `{menuOpen && (...)}` — so only the open side
 * needs a transition. Each open is a fresh mount, so a local `entered` flag
 * flipped one frame after mount is enough: no leave-delay bookkeeping like
 * Modal's, because there is nothing to keep mounted for.
 */
function MenuPanel({ children }: { children: React.ReactNode }) {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className={`absolute right-0 z-20 mt-1 w-56 origin-top-right rounded-lg bg-white p-1 shadow-lg ring-1 ring-slate-200 transition-[opacity,transform] duration-150 motion-reduce:transition-none ${
        entered ? "scale-100 opacity-100" : "scale-95 opacity-0"
      }`}
    >
      {children}
    </div>
  );
}

export function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const { data, isLoading, error } = leadsApi.useItem(id);
  const activities = useLeadActivities(id);
  const assign = useAssignLead();
  const users = useAssignableUsers();

  const [logOpen, setLogOpen] = useState(false);
  const [qualifyOpen, setQualifyOpen] = useState(false);
  const [contactsOpen, setContactsOpen] = useState(false);
  const [parkOpen, setParkOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  /** The stage the user clicked on the rail, pending confirmation. */
  const [pendingStage, setPendingStage] = useState<string | null>(null);
  const [stageReason, setStageReason] = useState("");
  /** Both only collected on the LOST move, and both optional even there. */
  const [lostCompetitor, setLostCompetitor] = useState("");
  const [lostReengageOn, setLostReengageOn] = useState("");
  const [stageError, setStageError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const transitionStage = useTransitionLeadStage(id);
  const unpark = useUnparkLead(id);
  const patchLead = usePatchLead(id);

  useEffect(() => {
    if (!menuOpen && !assignOpen) return;
    function onClickAway(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
        setAssignOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, [menuOpen, assignOpen]);

  if (isLoading) return <LeadDetailSkeleton />;
  if (error) return <p className="text-sm text-rose-600">{(error as Error).message}</p>;
  if (!data) return null;

  const lead = data as unknown as PopulatedLead;
  const contactNames = (lead.contacts ?? []).map((contact) => contact.name);

  // Over the full eight-stage order, used only to tell whether this lead
  // passed QUALIFICATION without ever being screened — WON and LOST both
  // still sort after it here, which is exactly what that check needs.
  const fullStageIndex = LEAD_STAGE_ORDER.indexOf(lead.stage as (typeof LEAD_STAGE_ORDER)[number]);
  const qualificationStageIndex = LEAD_STAGE_ORDER.indexOf(LeadStage.QUALIFICATION);
  const pastQualificationUnscored = fullStageIndex > qualificationStageIndex && !lead.qualification?.decision;

  const linearStageIndex = LEAD_LINEAR_STAGES.indexOf(lead.stage as (typeof LEAD_LINEAR_STAGES)[number]);
  const legalTargets = nextStates("lead", lead.stage);
  const linearClickableIndices = legalTargets
    .map((target) => LEAD_LINEAR_STAGES.indexOf(target as (typeof LEAD_LINEAR_STAGES)[number]))
    .filter((index) => index >= 0);
  const canReachWon = legalTargets.includes(LeadStage.WON);
  const canReachLost = legalTargets.includes(LeadStage.LOST);
  const requiresReason = pendingStage === LeadStage.LOST;
  const isParked = Boolean(lead.parked?.isParked);
  /**
   * Parking a won or lost lead is meaningless — there is nothing to come back
   * to — and the server refuses it. The menu simply does not offer it, so the
   * refusal is never reached from here.
   */
  const canPark = legalTargets.length > 0;

  function openStageConfirm(stage: string) {
    setStageReason("");
    setLostCompetitor("");
    setLostReengageOn("");
    setStageError(null);
    setPendingStage(stage);
  }

  async function confirmStageMove() {
    if (!pendingStage) return;
    if (requiresReason && !stageReason.trim()) {
      setStageError("A reason is required when marking a lead lost");
      return;
    }
    setStageError(null);
    try {
      await transitionStage.mutateAsync({
        to: pendingStage,
        reason: stageReason.trim() || undefined,
        // Only sent on the LOST move; the server ignores them elsewhere, but
        // there is no reason to put them on the wire for a normal advance.
        competitor: requiresReason ? lostCompetitor.trim() || undefined : undefined,
        reengageOn: requiresReason ? lostReengageOn || undefined : undefined,
      });
      toast({ message: `Moved to ${pendingStage.replace(/_/g, " ")}` });
      setPendingStage(null);
    } catch (caught) {
      setStageError(caught instanceof Error ? caught.message : "Could not move the stage.");
    }
  }

  async function handleUnpark() {
    setMenuOpen(false);
    try {
      await unpark.mutateAsync();
      toast({ message: `Back on ${lead.stage.replace(/_/g, " ")}` });
    } catch (caught) {
      toast({
        message: caught instanceof Error ? caught.message : "Could not unpark this lead",
        tone: "error",
      });
    }
  }

  async function handleAssign(userId?: string) {
    if (!id) return;
    await assign.mutateAsync({ leadId: id, userId });
    setMenuOpen(false);
    setAssignOpen(false);
    toast({ message: userId ? "Owner updated" : "Assigned to you" });
  }

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Lead Inbox", to: "/app/crm/leads" },
          { label: lead.leadCode },
        ]}
      />
      <a
        href="#lead-activity"
        className="sr-only focus:not-sr-only focus:mb-3 focus:inline-block focus:rounded focus:bg-methanova-goldTint focus:px-2 focus:py-1 focus:text-sm"
      >
        Skip to activity
      </a>

      <div className="sticky top-0 z-10 -mx-6 mb-4 bg-slate-50/95 px-6 py-3 backdrop-blur-sm">
      <PageHeader title={lead.companyName} subtitle={lead.leadCode}>
        <Button icon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={() => setLogOpen(true)}>
          Log activity
        </Button>
        <div className="relative" ref={menuRef}>
          <IconButton
            aria-label="More actions"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </IconButton>
          {menuOpen && (
            <MenuPanel>
              {/* There is no "Mark dead" item: moving the stage rail to Lost is
                  that action, and a second control for it would be two ways to
                  record one event. Park is here because it is genuinely a
                  different thing — the stage does not move. */}
              {isParked ? (
                <button
                  type="button"
                  onClick={() => void handleUnpark()}
                  disabled={unpark.isPending}
                  className="block w-full rounded px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold disabled:opacity-50"
                >
                  Unpark lead
                </button>
              ) : (
                canPark && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setParkOpen(true);
                    }}
                    className="block w-full rounded px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold"
                  >
                    Park lead…
                  </button>
                )
              )}
              {!lead.ownerUserId && (
                <button
                  type="button"
                  onClick={() => void handleAssign()}
                  className="block w-full rounded px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold"
                >
                  Assign to me
                </button>
              )}
              <button
                type="button"
                onClick={() => setAssignOpen((value) => !value)}
                className="block w-full rounded px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold"
              >
                {lead.ownerUserId ? "Reassign owner…" : "Assign to colleague…"}
              </button>
              {assignOpen && (
                <ul className="mt-1 max-h-48 overflow-y-auto border-t border-slate-100 pt-1">
                  {users.data?.map((user) => (
                    <li key={user._id}>
                      <button
                        type="button"
                        onClick={() => void handleAssign(user._id)}
                        className="block w-full rounded px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold"
                      >
                        {user.name} <span className="text-slate-400">· {user.role.replace(/_/g, " ")}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </MenuPanel>
          )}
        </div>
      </PageHeader>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-white px-5 py-3 shadow-sm ring-1 ring-slate-200/70">
        <StatusPill value={lead.stage} />
        {/* Sits beside the stage rather than replacing it, because that is
            exactly the relationship: the lead is still at this stage, it has
            just gone quiet until the revisit date. */}
        {isParked && (
          <StatusPill
            value={
              lead.parked?.revisitDate
                ? `Parked · revisit ${formatDate(lead.parked.revisitDate)}`
                : "Parked"
            }
            tone="waiting"
          />
        )}
        <div className="w-36">
          <Field label="Temperature" htmlFor="lead-temperature">
            <select
              id="lead-temperature"
              value={lead.temperature}
              disabled={patchLead.isPending}
              onChange={(event) => {
                const next = event.target.value;
                void patchLead
                  .mutateAsync({ temperature: next })
                  .then(() => toast({ message: `Temperature set to ${next}` }))
                  .catch((caught: unknown) =>
                    toast({
                      message: caught instanceof Error ? caught.message : "Could not update temperature",
                      tone: "error",
                    }),
                  );
              }}
            >
              {Object.values(LeadTemperature).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {lead.ownerUserId ? (
          <span className="text-sm text-slate-700">Owner: {lead.ownerUserId.name}</span>
        ) : (
          <StatusPill value="Unassigned" tone="neutral" />
        )}
        <span className="text-sm tabular-nums text-slate-700">
          {lead.indicativeValuePaise === null || lead.indicativeValuePaise === undefined
            ? "No value set"
            : formatPaise(lead.indicativeValuePaise)}
        </span>
        <span className="text-sm text-slate-500">{lead.leadSourceId?.label ?? "Source unknown"}</span>
        <span className="text-sm tabular-nums text-slate-500">{lead.daysInStage} days in stage</span>
        <span className="text-sm tabular-nums text-slate-500">{lead.ageDays} days old</span>
        {!lead.firstResponseAt && <StatusPill value="No first response" tone="problem" />}
      </div>

      <div className="mb-4 rounded-xl bg-white px-5 py-4 shadow-sm ring-1 ring-slate-200/70">
        {lead.stage === LeadStage.LOST ? (
          // LOST is reachable from every stage on the spine, so unlike WON
          // there is no single point on it this lead can honestly be shown
          // to have completed — "Why this was lost" below carries the detail.
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-700 ring-1 ring-inset ring-rose-600/20">
              Lost
            </span>
            <p className="text-xs text-slate-500">
              Exited the pipeline before reaching Won — see “Why this was lost” for the reason.
            </p>
          </div>
        ) : (
          <>
            {/* Only the legal next stages are clickable — the same
                TRANSITION_MAP the server enforces, so the rail never offers a
                move that would 409. */}
            <Stepper
              steps={LEAD_LINEAR_STAGES.map((label) => ({ label: label.replace(/_/g, " ") }))}
              current={lead.stage === LeadStage.WON ? LEAD_LINEAR_STAGES.length : linearStageIndex}
              clickableSteps={linearClickableIndices}
              onStepClick={(index) => openStageConfirm(LEAD_LINEAR_STAGES[index])}
            />

            <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-dashed border-slate-200 pt-3">
              <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-slate-300" aria-hidden="true" />
              <span className="text-xs text-slate-400">Terminal exits, not further steps:</span>
              {lead.stage === LeadStage.WON ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-methanova-greenTint px-3 py-1 text-xs font-medium text-methanova-green ring-1 ring-inset ring-methanova-green/20">
                  Won
                </span>
              ) : (
                canReachWon && (
                  <button
                    type="button"
                    onClick={() => openStageConfirm(LeadStage.WON)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-methanova-goldTint px-3 py-1 text-xs font-medium text-methanova-greenDark ring-1 ring-inset ring-methanova-gold hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-green"
                  >
                    Mark Won
                  </button>
                )
              )}
              {canReachLost && (
                <button
                  type="button"
                  onClick={() => openStageConfirm(LeadStage.LOST)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold"
                >
                  Mark Lost
                </button>
              )}
            </div>

            {lead.stage !== LeadStage.WON && (
              <p className="mt-3 text-xs text-slate-500">
                {legalTargets.length === 0
                  ? `${lead.stage} is a terminal stage — no further moves are possible.`
                  : `Next available: ${legalTargets.map((target) => target.replace(/_/g, " ")).join(" or ")}`}
              </p>
            )}
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title="Activity timeline" bodyPadding={false}>
            <div id="lead-activity">
            <ActivityRail
              isLoading={activities.isLoading}
              items={(activities.data ?? []).map(
                (activity): ActivityRailItem => ({
                  id: activity._id,
                  sequenceNo: activity.sequenceNo,
                  type: activity.type,
                  occurredAt: activity.occurredAt,
                  summary: activity.summary,
                  outcomeCategory: activity.outcomeCategory,
                  outcome: activity.outcome,
                  externalContactNames: activity.externalContactNames,
                  internalParticipants: activity.internalParticipantIds.map((p) => ({
                    id: p._id,
                    name: p.name,
                  })),
                  nextFollowUpDate: activity.nextFollowUpDate,
                  nextFollowUpAction: activity.nextFollowUpAction,
                }),
              )}
              emptyState={
                <div className="px-5 py-10 text-center">
                  <p className="text-sm font-medium text-slate-900">Nothing logged yet</p>
                  <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                    Every call, visit and email belongs here. Log the first contact so the team can see where this stands.
                  </p>
                  <Button className="mt-4" icon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={() => setLogOpen(true)}>
                    Log first contact
                  </Button>
                </div>
              }
            />
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Commitment">
            <p className="text-sm text-slate-800">{lead.nextAction}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <p
                className={`text-xs tabular-nums ${isOverdue(lead.nextActionDate) ? "font-medium text-rose-600" : "text-slate-500"}`}
              >
                {formatDate(lead.nextActionDate)}
              </p>
              {isOverdue(lead.nextActionDate) && (
                <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-600/20">
                  {daysLate(lead.nextActionDate)}d late
                </span>
              )}
            </div>
            {/* Only ever populated once a follow-up has actually been logged
                against this commitment — a lead's very first next action
                comes from intake with nothing behind it yet, and pretending
                otherwise would fabricate a promise nobody made. */}
            <p className="mt-2 flex items-center gap-1 text-xs text-slate-400">
              <CalendarClock className="h-3 w-3 shrink-0" aria-hidden="true" />
              {lead.nextActionSourceActivityId ? (
                <span>
                  Promised at follow-up {lead.nextActionSourceActivityId.sequenceNo} on{" "}
                  {formatDate(lead.nextActionPromisedAt ?? lead.nextActionSourceActivityId.occurredAt)}
                  {lead.nextActionPromisedByUserId?.name ? ` · ${lead.nextActionPromisedByUserId.name}` : ""}
                </span>
              ) : (
                <span>Set when this lead was added — no follow-up logged yet</span>
              )}
            </p>
            <div className="mt-3 flex gap-2">
              <Button className="flex-1" onClick={() => setLogOpen(true)}>
                Log follow-up {lead.activitiesLoggedCount + 1}
              </Button>
              <Button className="flex-1" variant="secondary" onClick={() => setRescheduleOpen(true)}>
                Reschedule
              </Button>
            </div>
          </Card>

          <Card title="Snapshot">
            <dl className="space-y-3 text-sm">
              <Detail label="Feedstock" value={(lead.feedstockTypeIds ?? []).map((t) => t.label).join(", ")} />
              <Detail label="Quantity" value={`${lead.feedstockQtyTpd} TPD`} />
              <Detail label="Expected CBG" value={`${lead.expectedCbgTpd} TPD`} />
              <Detail label="District" value={[lead.districtId?.name, lead.stateId?.name].filter(Boolean).join(", ")} />
            </dl>
          </Card>

          <Card
            title="Contacts"
            action={
              <Button size="sm" variant="ghost" onClick={() => setContactsOpen(true)}>
                Edit
              </Button>
            }
          >
            <ul className="space-y-3">
              {(lead.contacts ?? []).map((contact, index) => (
                <li key={index} className="flex items-start justify-between gap-3">
                  <IdentityCell
                    name={contact.name}
                    secondary={[contact.designation, contact.mobile, contact.email].filter(Boolean).join(" · ")}
                  />
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <div className="flex items-center gap-1">
                      {contact.mobile && (
                        <a
                          href={`tel:${contact.mobile}`}
                          aria-label={`Call ${contact.name}`}
                          className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-methanova-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold"
                        >
                          <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                        </a>
                      )}
                      {contact.email && (
                        <a
                          href={`mailto:${contact.email}`}
                          aria-label={`Email ${contact.name}`}
                          className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-methanova-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold"
                        >
                          <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {contact.isPrimary && <StatusPill value="Primary" tone="brand" />}
                      {contact.isDecisionMaker && <StatusPill value="Decision maker" tone="inflight" />}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Qualification">
            {lead.qualification?.decision ? (
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-semibold tabular-nums text-slate-900">
                    {lead.qualification.totalScore}%
                  </span>
                  <StatusPill
                    value={lead.qualification.decision}
                    tone={lead.qualification.decision === "QUALIFIED" ? "positive" : "problem"}
                  />
                </div>
                <ul className="mt-3 space-y-1.5">
                  {lead.qualification.scores.map((entry) => (
                    <li key={entry.criterionKey} className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-slate-600">{entry.criterionKey.replace(/_/g, " ").toLowerCase()}</span>
                      <span className="tabular-nums text-slate-800">{entry.score}/5</span>
                    </li>
                  ))}
                </ul>
                {lead.qualification.disqualificationReason && (
                  <p className="mt-3 border-t border-slate-100 pt-2 text-xs text-rose-700">
                    {lead.qualification.disqualificationReason}
                  </p>
                )}
                {lead.qualification.decidedAt && (
                  <p className="mt-2 text-xs text-slate-400">Decided {formatDate(lead.qualification.decidedAt)}</p>
                )}
              </div>
            ) : pastQualificationUnscored ? (
              // This lead moved on without ever being scored — a fact about
              // its history, not a pending task. "Not screened yet" would
              // read as still-outstanding work on a lead already at
              // Negotiation or beyond, so the tone here is retrospective and
              // muted rather than a call to action.
              <div>
                <p className="text-sm text-slate-500">
                  Moved on without a qualification score — this lead advanced past Qualification unscored.
                </p>
                <Button className="mt-3 w-full" variant="secondary" onClick={() => setQualifyOpen(true)}>
                  Score retroactively
                </Button>
              </div>
            ) : (
              <div>
                <p className="text-sm text-slate-500">
                  Not screened yet. Score feedstock, site and finance to decide whether this is worth pursuing.
                </p>
                <Button className="mt-3 w-full" variant="secondary" onClick={() => setQualifyOpen(true)}>
                  Qualify lead
                </Button>
              </div>
            )}
          </Card>

          {isParked && (
            <Card title="Parked">
              <p className="text-sm text-slate-700">{lead.parked?.reason}</p>
              <dl className="mt-3 space-y-2 text-xs">
                {lead.parked?.revisitDate && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Revisit on</dt>
                    <dd className="tabular-nums font-medium text-slate-800">
                      {formatDate(lead.parked.revisitDate)}
                    </dd>
                  </div>
                )}
                {lead.parked?.parkedFromStage && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Parked at stage</dt>
                    <dd className="text-slate-800">{lead.parked.parkedFromStage.replace(/_/g, " ")}</dd>
                  </div>
                )}
                {lead.parked?.parkedAt && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Parked on</dt>
                    <dd className="tabular-nums text-slate-800">{formatDate(lead.parked.parkedAt)}</dd>
                  </div>
                )}
              </dl>
              <Button
                className="mt-3 w-full"
                variant="secondary"
                onClick={() => void handleUnpark()}
                isPending={unpark.isPending}
                pendingLabel="Unparking…"
              >
                Unpark and resume
              </Button>
            </Card>
          )}

          {lead.lostReason && (
            <Card title="Why this was lost">
              <p className="text-sm text-slate-700">{lead.lostReason}</p>
              {(lead.competitor || lead.reengageOn) && (
                <dl className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-xs">
                  {lead.competitor && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Lost to</dt>
                      <dd className="font-medium text-slate-800">{lead.competitor}</dd>
                    </div>
                  )}
                  {lead.reengageOn && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Re-engage on</dt>
                      <dd className="tabular-nums font-medium text-slate-800">
                        {formatDate(lead.reengageOn)}
                      </dd>
                    </div>
                  )}
                </dl>
              )}
            </Card>
          )}

        </div>
      </div>

      <LogActivityModal
        open={logOpen}
        leadId={id}
        leadLabel={`${lead.leadCode} · ${lead.companyName}`}
        contactNames={contactNames}
        onClose={() => setLogOpen(false)}
      />

      <QualifyLeadModal
        open={qualifyOpen}
        leadId={id}
        leadLabel={`${lead.leadCode} · ${lead.companyName}`}
        onClose={() => setQualifyOpen(false)}
      />

      <EditContactsModal
        open={contactsOpen}
        leadId={id}
        leadLabel={lead.companyName}
        contacts={lead.contacts ?? []}
        onClose={() => setContactsOpen(false)}
      />

      <ParkLeadModal
        open={parkOpen}
        leadId={id}
        leadLabel={lead.leadCode}
        currentStage={lead.stage}
        onClose={() => setParkOpen(false)}
      />

      <RescheduleNextActionModal
        open={rescheduleOpen}
        leadId={id}
        leadLabel={lead.leadCode}
        currentAction={lead.nextAction}
        currentDate={lead.nextActionDate}
        onClose={() => setRescheduleOpen(false)}
      />

      <ConfirmDialog
        open={pendingStage !== null}
        title={`Move to ${pendingStage?.replace(/_/g, " ") ?? ""}?`}
        confirmLabel="Move stage"
        isPending={transitionStage.isPending}
        error={stageError}
        onCancel={() => setPendingStage(null)}
        onConfirm={() => void confirmStageMove()}
      >
        <p>
          This lead moves from {lead.stage.replace(/_/g, " ")} to {pendingStage?.replace(/_/g, " ")}.
        </p>
        <div className="mt-3">
        <Field
          label={requiresReason ? "Why was this lost?" : "Note (optional)"}
          htmlFor="stageReason"
          required={requiresReason}
        >
          <input
            id="stageReason"
            value={stageReason}
            onChange={(event) => setStageReason(event.target.value)}
            placeholder={requiresReason ? "Client shelved the project" : "Recorded in the audit trail"}
          />
        </Field>
        </div>

        {/* Only on the dead exit, and both optional: the reason above is the
            floor. Demanding a competitor name for a lead that simply went cold
            would get "n/a" typed into it. */}
        {requiresReason && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Lost to (optional)" htmlFor="lostCompetitor">
              <input
                id="lostCompetitor"
                value={lostCompetitor}
                onChange={(event) => setLostCompetitor(event.target.value)}
                placeholder="Competitor name"
              />
            </Field>
            <Field label="Re-engage on (optional)" htmlFor="lostReengageOn">
              <input
                id="lostReengageOn"
                type="date"
                value={lostReengageOn}
                onChange={(event) => setLostReengageOn(event.target.value)}
              />
            </Field>
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-slate-800">{value || "—"}</dd>
    </div>
  );
}
