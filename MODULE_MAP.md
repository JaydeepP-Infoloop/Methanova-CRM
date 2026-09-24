# MODULE_MAP.md — build tracker

> **Created in this session because the file did not exist.** The structure below is derived from
> `PROJECT_CONTEXT.md` §7 (P1/P2/P3 phasing) and §2 (the eleven-step flow). If you had a different
> taxonomy in mind, correct the headings — the checkboxes are the point, not the arrangement.

A checked box means the feature is **built and verified working end to end against a running dev
server**, not that a scaffold exists for it. Most list pages in this app are generic scaffolding
(`scripts/scaffold-web-modules.mjs`) standing in for real features; those stay unchecked.

Companion docs: [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) for what the system does and phasing,
[DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) for how the UI looks and behaves.

---

## Platform / foundation

- [x] **Auth & session** — login, `/auth/me`, logout, refresh-token rotation
- [x] **RBAC** — permission matrix enforced server-side by `requirePermission`
- [x] **App shell** — sidebar, topbar, protected routes, role-filtered nav
- [x] **Design system D1** — tokens, semantic `StatusPill`, `Card`/`StatCard`/`IdentityCell`
- [x] **Design system D2** — `FilterBar`, sortable/selectable `ResourceTable`, `BarChart`, `DonutMeter`
- [ ] **Design system D3** — `KanbanBoard` ✅, MOU confirm ✅ and `ActivityRail` ✅ done; `ScheduleCalendar` and licence timelines outstanding. `ActivityRail` is the shared timeline (date-group separators, per-type icons, two-line clamp with expand, committed-follow-up chip, kept/broken badge) built once and used by both the lead detail workspace and the flat Activity Log — see the two CRM entries below
- [x] User management (create / edit / deactivate)
- [x] **Master-data admin screens**
  - [x] Qualification criteria — weights, direction, threshold
  - [x] Geography — state → district → taluka → village drill-down, add / rename / remove, removal refused while a child or lead still points at the row
  - [x] Lead sources — label, detail-field label and placeholder, `detailRequired`, sort order; the toggle is what the intake validator reads
  - [x] Feedstock yield factors — nullable factor (null ≠ 0), per-type lead counts, and an explicit recalculation that brings open leads' stored estimates forward
  - [x] Licence types — the project licence checklist's own master data (key, label, authority, bundle, scope, expected visit count), seeded from the SoW's 14-row licence table and following the exact same Button/Field/`SkeletonEditorRows` pattern as Feedstock Types. `signMou()` instantiates one checklist row per type here instead of the old fixed PRE_CTE/CTE/CTO stub with authority hardcoded to "SPCB" — see the CRM entry below
  - [x] MOU approval threshold — a single tunable (`thresholdPaise`) stored in the generic `MasterData` collection exactly like `qualification-settings`, edited from a small card on the MOU page itself (visible only to admin/FULL) rather than a standalone nav page for one number
  - [x] Org letterhead — `/app/admin/letterhead`
- [x] **Notifications engine** — the original scaffold (`userId`/`title`/`body`/`readAt`, ungated behind a placeholder `reports:READ` check, `listNotifications()` returning every user's rows with no filter) is replaced by a real `NotificationService`: `recipientUserId`/`actorUserId`, a string `eventType`, a generic `entityType`/`entityId` polymorphic pair (the same pattern Activity's own `parentType`/`parentId` uses), `title`/`message`/`priority` (`NORMAL`/`HIGH`), and `readAt`. No stored `actionUrl` — the click-through route is computed client-side from `entityType`/`entityId` so a route rename never needs a migration. `notifyUsers()` de-dupes recipients, reads the existing `notification-defaults` master-data document's `inAppEnabled` flag before creating anything, and never throws past its caller (logged and swallowed) — a notification is a side effect of a real business operation, never a precondition for one. Routes are `requireAuth` only, no module permission gate: every handler reads `req.user.id` as the recipient and there is no `POST`/`PATCH`/`DELETE` a client can call directly. Four real triggers are wired, each from inside its own existing service function: lead assignment (`activities.service.ts` → `assignLead`), activity participants excluding whoever logged it (`activities.service.ts` → `createLeadActivity`), the lead qualification decision, notifying the owner (`leads.service.ts` → `qualifyLead`), and MOU signing's project spin-up, notifying the new project's `projectManagerUserId` (`mou.service.ts` → `signMou`) — this last one is wired correctly but **currently never fires**, because `signMou()` does not set `projectManagerUserId` at creation (it is assigned later through the identity PATCH) and `siteEngineerId`/`liaisonOfficerId` are not real fields on `Project`; nothing was invented to give it something to fire on. Frontend: a `NotificationBell` in `Topbar.tsx` polling `GET /unread-count` every 30s (no WebSocket — matches the existing no-new-dependency pattern), a dropdown reusing `Skeleton` and the same click-away pattern as `LeadDetailPage`'s "⋯" menu, and a route-only `/app/notifications` page (All/Unread toggle, `LeadPage`-style Previous/Next pagination, a "You're all caught up" empty state). **Deliberately not built**: per-user granular preferences beyond the existing system-wide toggles, grouping/duplicate suppression, any real-time push transport, and the email channel (`emailEnabled` stays `false`) — none of those exist as features in this codebase yet.
- [ ] Secondary auth (2FA, forgot password)

## CRM

- [x] **Lead inbox & intake**
  - [x] Lead entity — real schema (company, statutory ids, embedded contacts, geography refs, source, feedstock, next action) replacing the original scaffold
  - [x] Lead Inbox page — stat cards, search, filters (stage, temperature, owner), SLA flag, server-driven pagination, longest-waiting-first, table + kanban by `LeadStage` (`ViewToggle`; board pageSize 100 with an honest remainder notice)
  - [x] Add Lead wizard — three-step intake with cascading geography, repeatable contacts, live CBG estimate
  - [x] Inbox summary counts — unassigned / no-first-response / arrived-today plus whole-collection open count, open pipeline value and parked-due-for-revisit, derived at query time
- [x] **Lead assignment** — `POST /crm/leads/:id/assign`, assign-to-me and reassign-to-colleague, previous/new owner written to `audit_logs` so reassignment history is queryable without a new collection
- [x] **Activities** — polymorphic activity log (`parentType`/`parentId`), eight types, per-lead `sequenceNo` from the atomic counter, structured `plantVisit`/`siteVisit` sub-documents, transactional create that stamps `firstResponseAt` and carries the follow-up commitment onto the lead
  - [x] **Commitment provenance** — the same `createLeadActivity` transaction now also stamps `nextActionSourceActivityId` / `nextActionPromisedAt` / `nextActionPromisedByUserId` onto the lead, so the detail page's Commitment card can say "Promised at follow-up 3 on 25 Aug · &lt;user&gt;" instead of just a bare due date. A lead's very first `nextAction` still comes from intake with none of these set — the card says so plainly rather than fabricating a promise nobody made. A manual reschedule through the general `PATCH /crm/leads/:id` (not an activity) clears all three, since a typed-in date is no longer "promised at follow-up N"
  - [x] **Outcome guardrail** — a short `outcomeCategory` pick-list is now required before the free-text `outcome` field is accepted, closing the gap that had let an Excel date serial ("43244") and a bare "120" into production rows
  - [x] **Broken-promise tracking** — `activitiesLoggedCount` and `brokenPromiseCount` (a promise's `nextFollowUpDate` falling before the *next* activity's `occurredAt`) are computed at read time on the lead detail response, and the same per-row `followUpOutcome` (PENDING / KEPT / BROKEN) is computed across the flat activities list
  - [x] **Activity Log page** (`/app/crm/activities`) — rebuilt on `ActivityRail` plus a real table view (`ViewToggle`), backed by a server-paginated, server-filtered endpoint (`type[]`, `parentType`, `loggedByUserId`, `dateFrom`/`dateTo`, `hasFollowUp`, `overdueFollowUp`, `leadId`) with `companyName`/`leadCode` denormalised onto each row server-side — the old scaffold's `useLeadLabels()` client-side resolution against a second unpaginated fetch is gone. KPI strip (logged this week, calls/visits/emails, follow-ups committed, promises overdue), an Everything/Mine/This week/Visits-only segmented cut, and the per-lead `sequenceNo` moved into the lead cell as "follow-up 3" — a bare `#` column across a cross-lead list was meaningless and is gone
  - [ ] **Activity attachments — deferred.** `core/storage` is a stub: one `storeBuffer()` writing to a local directory, with no upload middleware (no multer in `apps/api` dependencies), no file metadata model, no retrieval route and no size/type validation. Building an uploader against it would be half-wired, so this pass shipped without attachments. Needs a real storage layer first.
- [x] **Lead detail workspace** — header band (stage, temperature editable via PATCH, owner, indicative value, source, total age and days-in-stage), a branching stage rail, `ActivityRail` timeline, snapshot / contacts / qualification rail
  - [x] **Commitment card** — promoted from a "Next action" card at the bottom of the rail to the top: commitment text, due date, a red "Nd late" chip when overdue, the provenance line, and Log-follow-up / Reschedule actions. Reschedule goes through the general lead PATCH, not a new activity — see the provenance note above for why that clears the promise's provenance
  - [x] **Branching stage rail** — the rail now shows only the six stages a lead actually advances through (`ENQUIRY` → `MOU`); WON and LOST render as terminal-exit chips below it rather than steps 7 and 8 of one straight line, which used to imply LOST always follows WON. A LOST lead cannot honestly be shown as "completed up to stage N" (LOST is reachable from every stage on the spine, unlike WON), so it renders a plain exit badge instead of guessing
  - [x] **Qualification card's retrospective state** — a lead that advanced past QUALIFICATION without ever being scored no longer reads "Not screened yet" (which implies still-pending work); it shows a quieter, muted "moved on without a qualification score" message instead, with scoring still offered retroactively
  - [x] **Contact quick actions** — `tel:`/`mailto:` links beside each contact when a mobile/email is on file
- [x] **Lead qualification** — weighted scoring on the three dimensions PROJECT_CONTEXT §2 names, seeded as editable master data; the decision drives the stage (qualify → QUALIFICATION, disqualify → LOST with a reason) inside a transaction
- [x] **Stage transitions from the detail page** — the stage rail offers only the legal targets from `TRANSITION_MAP`, with a confirmation step and a mandatory reason for LOST
  - [x] **Criteria admin screen** — add/edit/remove criteria and retune the recommend-threshold from the UI at `/app/admin/qualification-criteria`; shows each criterion's live share of the score, writes gated at admin/WRITE while reads stay at crm/READ
- [x] **Contact editing on a lead** — `PATCH /crm/leads/:id/contacts` replaces the whole array so the exactly-one-primary rule is re-checked against the finished set; the detail rail's Contacts card opens a `Modal` with the same one-primary radio the intake wizard uses, and the before/after arrays go to `audit_logs`
- [x] **Park / Mark dead exits**
  - [x] Mark dead — the LOST transition now also takes optional `competitor` and `reengageOn` beside the already-required `reason`. There is no separate "mark dead" endpoint: moving the stage rail to LOST *is* that action
  - [x] Park / unpark — an orthogonal `parked` sub-document (`isParked`, `reason`, `revisitDate`, `parkedFromStage`, `parkedAt`) that never touches `stage`, so a parked lead resumes exactly where it was. `POST /:id/park` and `POST /:id/unpark`, both audited; a "Parked · revisit &lt;date&gt;" pill sits beside the stage badge
- [x] **My Day** (`/app/my-day` — a top-level sidebar link above Dashboard, not a CRM sub-item; the API stays under `/api/crm/my-day` since it's still CRM's data) — the per-user follow-up queue the SoW process flow describes. Reads three genuinely different date fields side by side — `leads.nextActionDate`, a parked lead's `parked.revisitDate`, and a lost lead's `reengageOn` — and unifies them into one row shape (`MyDayRowDto`) with a `source` discriminant, since a lead can owe a follow-up for three different reasons. A KPI strip (overdue follow-ups, due today, rest of this week, inbox needing action, completed today), three sections (Overdue / Today / This week) each headed with a count and the summed pipeline value in crore, and a Sales Head/Director "Team queue" toggle that is advisory only — the server re-derives `canAccess(role, crm, FULL)` itself (exactly Director and Sales Head/BDE per `PERMISSION_MATRIX`) and silently downgrades to "mine" for anyone else, the same hidden-toggle-is-not-real-access-control rule every other permission check in this app follows. Every row carries a Log-follow-up action (opens the same `LogActivityModal` the lead detail page uses) and an Open action; logging a follow-up or rescheduling invalidates the My Day query from wherever it's done, so a resolved row leaves the queue immediately rather than waiting for a reload. When nothing is due it says so plainly rather than rendering three empty-looking tables
  - [x] **Automatic revisit surfacing** — closed by My Day reading `parked.revisitDate` directly: a parked lead now surfaces in the right person's queue on its own the day it's due, without a client-side date check on the detail page and without the scheduled background job a true "push" notification would need. Unparking itself stays a manual action
- [x] **Quotations** — real SoW fields (`capacityTpd`, `feedstockBasis`, `expectedCbgTpd`, `priceLines[]` with `hsnSac`, `scopeInclusions`/`scopeExclusions`, an embedded `paymentTermsTemplate` whose milestone percentages must sum to 100), a status workflow (`DRAFT → PENDING_APPROVAL → APPROVED → SENT → UNDER_NEGOTIATION → ACCEPTED/REJECTED`, plus `SUPERSEDED` as an automatic side effect, never a manual move) governed by `TRANSITION_MAP.quotation`, `totalPaise` computed server-side from `priceLines` rather than trusted from the client, and a required `revisionReason` on every revision after the first. `/app/crm/quotations` gained a create/revise modal, per-row status-transition buttons, and a side-by-side revision-comparison view reading `GET /:id/revisions`
  - [x] **Revision lineage** — every revision shares one `rootQuotationId` (set to its own id on revision 1, inherited from the parent otherwise), so the comparison view finds the whole family in one indexed query instead of walking `parentQuotationId` links. Creating a revision automatically moves its parent to `SUPERSEDED`; revising a quotation that is already ACCEPTED, REJECTED or SUPERSEDED is refused (409) rather than silently allowed
- [x] **MOU** — real SoW fields (`mouDate`, `acceptedQuotationId` locking the technical/commercial basis, `contractValuePaise`, `feeAdjustable`, `civilScope`, `targetCommissioningDate`, `signedDocumentId`, `supersedesMouId`). An MOU can only be created against a quotation already in ACCEPTED status. A renegotiation after signing is a new Mou document with `supersedesMouId`, never a mutation of the signed one — consistent with how a Quotation is revised rather than edited. Structural drawings are fixed as Methanova's scope in code (`STRUCTURAL_DRAWINGS_SCOPE`) regardless of `civilScope`, not left to whoever fills in the form. `/app/crm/mou` gained a create modal and a Director-visible approval-threshold settings card
  - [x] **MOU signing action, extended** (`ConfirmDialog` + atomic spin-up, `KanbanBoard` predecessor built during D3) — `signMou()` now populates every record it creates from real data instead of stub placeholders:
    - **Project** — named after the client (`lead.companyName`), not `Project ${code}`; site address and full geography copied from the Lead; capacity, feedstock basis, civil scope and target commissioning date copied from the accepted quotation / MOU
    - **Payment schedule** — its lines are built from the accepted quotation's `paymentTermsTemplate` milestones against `contractValuePaise`, not the old hardcoded "MOU fee" + zero-amount "Mobilisation advance (template)" stub. Percentages are re-validated to sum to 100 before the transaction commits, and any rounding remainder is absorbed into the last line so the lines' sum always lands exactly on `contractValuePaise`
    - **Licence checklist** — one row per configured Licence Type (see Master-data admin screens above), each carrying that type's real `authority` and `bundle`, instead of three rows hardcoded to `authority: "SPCB"`
    - **Director-approval gate** — a configurable `thresholdPaise` (admin master data, editable from the MOU page) is checked against `contractValuePaise` before signing; at or above it, the caller must hold `admin/FULL` (today, only Director) or the sign is rejected with a 403 naming the threshold, closing the SoW's open decision on quotation/MOU approval thresholds. Verified: a Sales Head/BDE (crm:FULL, admin:NONE) is refused signing an above-threshold MOU and can sign a below-threshold one; a Director can sign either

## Projects & Compliance

- [x] **Project record and lifecycle** — `/app/projects/:id` header + Overview/Team/Identity/Documents/Audit; `TRANSITION_MAP.project`; PATCH identity; PM + members; `?mine=true` list filter; setup/docs checklist. Feasibility/DPR still scaffold
- [x] **Org + project letterhead** — authenticated file GET, MIME sniff, inherit/reset/preview on header (not app chrome)
- [ ] Feasibility survey (versioned)
- [ ] DPR (versioned)
- [ ] Licence & NOC register — bundles exist and the kanban moves statuses; visit/query logs unbuilt
- [ ] Authority visit log
- [ ] Query / response threads

## Schedule

- [ ] Work packages — kanban exists from D3; no planning, dependencies or Gantt
- [ ] Progress updates
- [ ] Schedule calendar

## Billing & Receivables

- [ ] Payment schedules
- [ ] Proforma → tax invoice conversion
- [ ] GST split (CGST/SGST vs IGST) — computed inside the MOU spin-up only
- [ ] Retention & mobilisation-advance recovery
- [ ] Receipts
- [ ] Receivables ageing report

## Documents

- [ ] Versioned document records — letterhead uses the new `files` collection; the documents list remains a stub
- [x] Upload / storage wiring — `storeOwnedBuffer` + `GET /api/files/:id/content` for logos; activity attachments still deferred

## Reports

- [x] **Dashboard CRM strip** — open leads + pipeline value, unassigned, awaiting first response, overdue commitments (My Day), parked due for revisit; gated on `crm:READ`. Billing, compliance and projects panels still empty
- [ ] Dashboard billing / compliance / projects — empty states until those modules exist
- [ ] Reporting endpoints
- [ ] **CRM Reports**
  - [x] Lead Inbox charts (source mix, readiness distribution) — thin slice built ahead of the full CRM Reports feature
  - [ ] Stage-conversion funnel
  - [ ] Loss analysis (reasons, competitors)
  - [ ] Geography breakdown
