# DESIGN_SYSTEM.md — Methanova CRM

The visual and interaction reference for this codebase. Companion to [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) — that file governs *what* the system does and what phase work belongs to; this one governs *how it looks and feels*. Re-read this before building any UI, and update it whenever a token, component, or layout decision changes.

## 1. Design intent

The target aesthetic is the modern light-mode B2B SaaS dashboard: generous white space, white rounded cards floating on a soft tinted background, muted pastel status pills, restrained accent colour reserved for primary actions, and dense data presented without feeling cramped.

What we are adopting is a **pattern language**, not any particular product's branding: card-based dashboard composition, stat tiles with trend deltas, avatar + two-line identity cells in tables, kanban pipelines, a week-grid calendar, and a right-hand activity rail. These are standard interface conventions. Methanova's own identity — deep green `#1B5E3B` and gold `#C4A35A` — drives all colour decisions; we do not reuse another product's palette, logo, iconography, or copy.

**Tone adjustment for our domain.** The reference aesthetic in this class of product often skews playful (creator-economy energy). Methanova sells EPC contracts for BioCNG plants to industrial buyers and deals with statutory regulators. The UI should read as *calm, precise, and trustworthy*: the airy layout and soft cards stay, the whimsy does not. Fewer decorative illustrations, more legible numbers, and colour used to encode meaning (compliance status, money ageing, risk) rather than decoration.

## 2. Design tokens

Extend `packages/config/tailwind.preset.js` — do not hardcode hex values in components.

> **Restart the dev server after editing the preset.** Tailwind resolves the config once per process and caches it; editing a token while `pnpm dev` is running leaves the old palette compiled. The new class names still appear in the markup but resolve to nothing — which looks like a styling bug, not a stale build. This was verified the hard way: touching a watched source file rebuilds the CSS from the *cached* config and does not help, and importing the preset by relative path instead of package specifier does not help either. Only a restart does.

### Colour

```js
methanova: {
  green: "#1B5E3B",   // primary brand, headings, active nav
  greenDark: "#123F28",  // sidebar surface, pressed states
  greenTint: "#EAF2ED",  // active nav background, subtle fills
  gold: "#C4A35A",    // primary CTA, focus accents
  goldTint: "#FAF3E5",   // CTA hover wash, highlight rows
}
```

Surfaces and text use Tailwind's `slate` scale: page background `slate-50`, card `white`, borders `slate-200`, primary text `slate-900`, secondary `slate-500`, muted `slate-400`. The preset also exposes aliases onto that same scale so screens can stop inventing one-off names: `surface` / `surfaceElevated`, `borderDefault`, `textPrimary` / `textSecondary` / `textMuted`, plus `danger` / `warning` / `success` / `info` (`info` = the inflight sky). Hex values stay only in `packages/config/tailwind.preset.js`.

**Semantic status palette** — every pill, badge, and chart series pulls from this, so a colour always means the same thing across the app:

| Meaning | Use for | Classes |
|---|---|---|
| Positive / done | GRANTED, PAID, COMPLETED, HANDED_OVER | `bg-emerald-50 text-emerald-700 ring-emerald-600/20` |
| In flight | IN_PROGRESS, SUBMITTED, PROFORMA_ISSUED | `bg-sky-50 text-sky-700 ring-sky-600/20` |
| Waiting on someone | QUERY_PENDING, AUTHORITY_VISIT, PARTIALLY_PAID | `bg-amber-50 text-amber-700 ring-amber-600/20` |
| Problem | REJECTED, OVERDUE, CANCELLED, EXPIRED | `bg-rose-50 text-rose-700 ring-rose-600/20` |
| Neutral / not started | NOT_STARTED, DRAFT, PLANNED | `bg-slate-100 text-slate-600 ring-slate-500/20` |
| Brand emphasis | MOU stage, WON, commissioning milestones | `bg-methanova-greenTint text-methanova-green ring-methanova-green/20` |

`StatusPill` currently hashes the string to pick a colour. Replace that with an explicit map from this table — a deterministic-but-arbitrary colour is fine for a scaffold, but "GRANTED" must be green and "OVERDUE" must be red, because Liaison and Accounts staff scan these columns for exceptions.

### Typography

System sans (current `ui-sans-serif` stack is fine — no webfont, it costs load time for little gain here).

| Role | Classes |
|---|---|
| Page title | `text-2xl font-semibold text-slate-900` |
| Card title | `text-sm font-semibold text-slate-900` |
| Section label | `text-xs font-semibold uppercase tracking-wide text-slate-400` |
| Body / table cell | `text-sm text-slate-700` |
| Secondary line | `text-xs text-slate-500` |
| Metric number | `text-2xl font-semibold tabular-nums` |

Money and dates always get `tabular-nums` so columns align down the page — critical on invoice and receivables tables.

### Shape, depth, spacing

- Radius: cards `rounded-xl`, controls/pills `rounded-lg`, badges `rounded-full`.
- Depth: one shadow only — `shadow-sm` with `ring-1 ring-slate-200/70`. Overlays (`Modal`, `Toast`, Jump palette) use `shadow-overlay` from the preset rather than inventing a heavier scale.
- Motion (Tailwind only, no animation library): micro hover/focus `duration-150 ease-out`; overlay enter `duration-[180ms]`, leave `duration-[120ms]`; `motion-reduce:transition-none` on every new motion class. Do not count-up KPIs.
- Spacing: 4px base. Card padding `p-4` (dense tables) or `p-5` (dashboard cards). Grid gap `gap-4`. Page padding `p-6`.
- Page background: `bg-slate-50`. Optionally a very subtle top gradient wash (`from-methanova-greenTint/40 to-transparent`) behind the shell — keep it barely perceptible.

## 3. Component plan

Existing components and their fate. Paths are under `apps/web/src/`.

| Component | Path | Action |
|---|---|---|
| `PageHeader` | `components/PagePrimitives.tsx` | Extend: title + optional subtitle + right-hand action slot |
| `StubTable` | `components/PagePrimitives.tsx` | Delete once `ResourceTable` covers every page — dead weight |
| `ResourceTable` | `components/ResourceTable.tsx` | Upgrade: sortable headers, optional row selection, `IdentityCell`, empty/loading/error states already present |
| `StatusPill` | `components/StatusPill.tsx` | Rewrite against the semantic map above |
| `MetricCard` | `modules/reports/components/MetricCard.tsx` | Upgrade to `StatCard`: leading icon, label, value, trend delta pill |
| `Sidebar` | `app/layout/Sidebar.tsx` | Restyle; see §4 |
| `Topbar` | `app/layout/Topbar.tsx` | Jump (⌘K / Ctrl+K) over visible routes + optional lead search; keep user + sign out |

New components to build, in `components/`:

- **`StatCard`** — icon, label, big number, optional delta pill (`+7.4%` green up / `-4.3%` red down). Used across Dashboard and module landing pages.
- **`IdentityCell`** — avatar (or initials fallback) + primary line + muted secondary line. The reference uses this for client name + email; ours carries organisation + site location on leads, client + GSTIN on invoices.
- **`Card`** — the standard white surface wrapper (title row + optional "View all" link + body), so every panel doesn't re-declare the same classes.
- **`FilterBar`** — search input + filter button + view toggle, shared by every list page.
- **`KanbanBoard`** — generic column board (column title, count badge, ordered cards, drag to move). Generic because three different pipelines need it (see §5).
- **`ScheduleCalendar`** — week/month grid with colour-coded blocks.
- **`ActivityRail`** — **built in D3, see below; the shape below is what it actually became, not what this section originally planned.** It is the chronological activity **timeline** shared by the lead detail workspace and the flat Activity Log — date-group separators, per-type icons, a two-line clamp with an expand toggle, the committed-follow-up chip, and a kept/broken badge — not the cross-entity "what needs attention" rail this bullet originally described. That still-unbuilt Dashboard concept (overdue licence queries, invoices past due, blocked work packages, one link and urgency pill per row) is a genuinely different component and should be named something else when it is eventually built (e.g. `AttentionRail`) so the two are never confused again — see the Dashboard section in §5, which has been corrected to use that name.
- **`BarChart` / `DonutMeter`** — the only two chart forms this app needs for now. Build them as small inline SVG components rather than pulling a chart library; both are simple, and a dependency isn't earning its weight for two shapes. If charts later multiply, revisit.

### Shared controls (D4 finish pass)

Do **not** add a second copy of Modal, Toast, Skeleton, StatusPill, KanbanBoard, or ActivityRail. These are the missing primitives that stopped gold CTAs and inputs being copy-pasted:

- **`Button`** (`components/Button.tsx`) — variants `primary` (gold), `secondary`, `ghost`, `danger`; sizes `sm`/`md`; `isPending` + `pendingLabel`; optional `icon`. Login no longer uses a solid green submit.
- **`IconButton`** — icon-only; `aria-label` is required.
- **`Field`** — label, required mark, hint or error; wraps native input/select/textarea with `CONTROL_CLASS`, `aria-invalid`, and `aria-describedby`. No DatePicker library.
- **`Tooltip`** — hover + `:focus-within`; used on collapsed sidebar destinations instead of native `title`.
- **`Breadcrumb`** — only on `/app/crm/leads/:id` (the only real detail route).
- **`CommandJump`** — in-app Jump overlay from the Topbar. Lists visible `NAV_SECTIONS` plus My Day and Dashboard. With `crm:READ`, typeahead hits the existing `GET /api/crm/leads?search=` (debounced); it is not a global multi-entity search API.

### Overlay and feedback primitives (added with the lead intake feature)

- **`Modal`** (`components/Modal.tsx`) — `open`, `title`, optional `description`, body, optional sticky `footer`, and a single `onRequestClose`. It traps focus, locks body scroll, and routes Escape, backdrop click and the × button to the *same* callback rather than closing itself. That is deliberate: only the caller knows whether the form is dirty, so the "close instantly when untouched, confirm when touched" decision lives with the caller. Sizes: `md` (max-w-lg) and `lg` (max-w-3xl, the default).
- **`Stepper`** (`components/Stepper.tsx`) — numbered nodes with `upcoming` / `active` / `completed` states, a connector line that fills as steps complete, and a red error dot on a completed node that has since become invalid. By default navigation is backwards-only (forward nodes are inert, `tabIndex={-1}`) because each wizard step gates the next one's validation. Pass **`clickableSteps`** to override that with an explicit list of reachable indices — the lead stage rail passes the legal `TRANSITION_MAP` targets, which can be forwards. A reachable-but-unvisited node gets the gold accent so an available move does not look identical to an unreachable one. Below `sm` it collapses to a single progress bar plus "Step 2 of 3" text.
- **`Toast`** (`components/Toast.tsx`) — `ToastProvider` (mounted in `app/providers.tsx`) plus a `useToast()` hook taking `{ message, tone, action, durationMs }`. Bottom-right stack, auto-dismiss at 6s, `aria-live="polite"` so the message is not visual-only. `tone` uses the §2 semantic palette; the optional `action` is how "Lead X created → View" works.
- **`ConfirmDialog`** (`components/ConfirmDialog.tsx`, from D3) — for irreversible actions. Focus lands on Cancel, not Confirm, so a stray Enter does not commit.

## 4. Shell layout — and one deliberate deviation

Reference dashboards of this style use a narrow **icon-only** sidebar. That works when a product has ~8 destinations. Methanova CRM has 9 modules containing roughly 20 leaf routes (see `app/nav.tsx`), and users are role-scoped — a Site Engineer and an Accounts user see almost disjoint sets. Icon-only navigation at that count forces guess-and-hover and hides the role differences that matter.

**Decision: keep the labelled, grouped sidebar; add an optional collapse-to-icons toggle.** Concretely:

- Width `w-64` expanded, `w-16` collapsed; state remembered in `localStorage` (a per-viewer convenience, safe to lose).
- Surface `bg-methanova-greenDark` with `text-white/80`; active item `bg-white/10 text-white` with a gold left indicator bar. This gives the reference's dark-rail anchor while staying on-brand.
- Section labels (`CRM`, `PROJECTS & COMPLIANCE`, …) stay; they're how the role-filtered nav stays legible.
- **Collapsed rail shows one icon per _section_, not per item**, each linking to that section's first destination with the section name as its tooltip and `aria-label`. Twenty near-identical glyphs in a 64px rail would be unusable; eight are scannable. Icons live on `NavSection.icon` in `app/nav.tsx`.
- Brand mark top-left.

Topbar keeps: collapse toggle and Jump (⌘K / Ctrl+K, a client-side route list plus optional lead lookup, not a multi-entity index) on the left; current user name + role, the `NotificationBell` dropdown, and sign out on the right — the bell sits immediately before sign out, not beside Jump, so the two most personal controls are together. Content area: `bg-slate-50`, `p-6`, max width `max-w-[1600px]` centred so ultrawide monitors don't stretch tables to unreadable widths.

> **As-built correction (D1).** An earlier draft of this section put the user avatar and sign out in the sidebar footer. Implementation kept them in the Topbar instead: duplicating sign out in two places is worse than matching the reference's avatar placement, and one unambiguous sign-out control is the safer pattern. Icons come from `lucide-react` — worth the dependency for ~15 glyphs, unlike the chart shapes in §3.

## 5. Page-by-page plan

Mapped onto real Methanova entities — not generic placeholders. Respect `PROJECT_CONTEXT.md` phasing: **this document describes the target visual layer; it does not authorise building business-module behaviour that is still P2/P3 there.**

### Dashboard (`modules/reports/pages/Dashboard.tsx`) — built, every panel on live data
Top to bottom. Each section is shown only when the viewer's role can read its module; this is one page of gated widgets, not a page per role:
- **Quick actions** in the page header (`Button size="sm" variant="secondary"`): New lead, Log activity, New quotation, New MOU, New progress update. Each opens the existing modal (`AddLeadWizard`, `LogActivityModal` with a lead picker when no lead is passed, `CreateQuotationModal`, `CreateMouModal`, `LogProgressModal`), and each shows only with WRITE on its module.
- **Critical alerts**: at most 6 rows, each linking to its exact record (`?id=`). The rows are the worst delayed work packages, licences past target and invoices past due, taken from the same records as Project Health's reasons. Tone is always `problem`. This is not a notification feed; the bell is the notification system.
- **CRM strip**: five `StatCard`s. Unassigned and Awaiting first response open the Lead Inbox on that segment (`?segment=`).
- **Portfolio**: one `StatCard` per SoW status (Active, On hold, Completed, Terminated), plus At risk. Terminated shows "Not available" and has no link, because nothing can be terminated yet.
- **Project health table**: project, client, PM, stage (the real lifecycle status), progress, target, revised target, SoW status, and the risk reasons. Each reason is a sentence ("1 delayed work package — worst: X, 12 days late") linking to that project's filtered list, and a project with none shows an `On track` pill. There is never a numeric score. A missing field reads "Not available"; a target that was never revised reads "Not revised", because that is a real state, not missing data.
- **Delayed work packages**: capped table; each row opens its work package, and "View all" opens the full delayed list.
- **Billing & collections**: the chart draws only once at least 3 months have activity. Before that, a sentence plus each month's actual figures.
- **Compliance health**: `DonutMeter`, then past-target and expiring-soon counts, then per-status counts; every figure is a link.
- **Compliance by project**: table; each row opens that project's licences.
- **Receivables ageing**: one `StatCard` per `AgeingBucket` plus "No due date", each opening the invoice list on that bucket.
- **Top outstanding receivables**: capped table sorted by amount; "View all" opens `?receivable=1`.
- **Sales pipeline**: stage rows open the Lead Inbox on that stage.
- **Recent activity**.

**Drill-down pattern.** Every count or row links to its source list through that list's own query string (`?delayed=1`, `?bucket=31-60`, `?projectId=…`). The page reads these with `useUrlFilters`, sends them to the server as list filters, and shows a `UrlFilterNotice` ("Filtered: … · Show all"). Filtering runs on the server, because list endpoints cap at 100 rows. No trend deltas are shown: the app keeps no period snapshots to compare against, and a made-up percentage is worse than none.

### CRM — Leads

**A stat card is a number, not a control.** The inbox originally used two clickable `StatCard`s as its primary filters. Two problems: a card that is both a figure and a toggle reads as neither, and independently-toggling cards modelled slices that are mutually exclusive by nature as if they combined. The inbox now shows five read-only cards and puts the primary cut in a `SegmentedFilter` — a `role="radiogroup"` pill bar — above the table. Secondary filters that genuinely *do* combine (stage, temperature) stay in `FilterBar`. Reach for the segmented bar whenever a list has one dominant either/or cut, and keep cards for reporting the numbers.

**Below a handful of records, a chart is decoration.** The inbox's two panels render a sentence naming the real count and the threshold at which they fill in, rather than drawing a plausible-looking shape from three data points. §6's no-fabricated-data rule covers "technically true but statistically meaningless" as much as it covers invented numbers.

Table view (default) + **Kanban by `LeadStage`** (`ENQUIRY → QUALIFICATION → SITE_VISIT → QUOTATION → NEGOTIATION → MOU → WON/LOST`). The kanban maps perfectly onto an existing lifecycle, so it's genuinely useful rather than decorative. Card: organisation, site location, value, owner avatar, days-in-stage (ageing is the signal that matters — the reference's "waiting since" idea, applied where it counts). Moving a card must go through the state machine (`assertTransition`), never a direct write.

### CRM — Activity Log, Lead Detail, My Day (built)

**Activities and My Day are two different things, and the UI must keep them that way.** Activities is the backward-looking historical record of what was done; My Day is the forward-looking queue of what is owed. The Activity Log was not made more My-Day-like to compensate for My Day not existing — it stays a record, and the queue got built as its own page instead.

- **Activity Log** (`/app/crm/activities`): KPI strip (logged this week, calls/visits/emails, follow-ups committed, promises overdue) → `SegmentedFilter` (Everything / Mine / This week / Visits only) → `FilterBar` carrying a type select and a date range as its `children` slot, with its own search box narrowing only the current server-fetched page (there is no free-text index on the flat endpoint, and the placeholder says so) → `ViewToggle` between `ActivityRail`'s timeline and a table → server-driven pagination. The table's lead column carries "follow-up N" instead of a standalone `#` column — a per-lead sequence number is meaningless as a table column across a cross-lead list.
- **Lead detail** (`/app/crm/leads/:id`): header band now includes indicative value, lead source and total age beside stage/temperature/owner/days-in-stage. The right rail leads with a **Commitment card** (commitment text, due date, a red "Nd late" chip, the provenance line, Log-follow-up/Reschedule), ahead of Snapshot/Contacts/Qualification — the thing owed on this lead is more important than its static attributes, so it goes first. The stage rail spine is the six advancing stages only; WON and LOST are chips below it, connected by a `CornerDownRight` icon and a dashed top border, reading as branches off the rail rather than steps 7 and 8 of it.
- **My Day** (`/app/my-day` — not under `/app/crm/`, and not a `NAV_SECTIONS` entry at all: it is a hardcoded `Sidebar` link sitting *above* Dashboard, the same way Dashboard's own link is hardcoded rather than declared in `nav.tsx`, because it is the screen the sales team opens every morning and a CRM sub-item would bury it a level down. Gated on `crm:READ` client-side — same access the page's own data needs — so it does not appear for a role that would just get a 403): KPI strip → an optional `SegmentedFilter` (My queue / Team queue, shown only when the role can reach it — the server re-derives this regardless) → three `Card`s (Overdue / Today / This week), each with a count-and-crore-value pair in its `action` slot and a `ResourceTable` of rows beneath. Every due-date chip shows the actual date (via `formatDate`, not a new format) plus a status suffix that differs by bucket — "· Nd late" (rose) in Overdue, "· Today" (amber) in Today, "· in Nd" in This week — because a bare "2d late" without the date makes the reader do the subtraction backwards. The follow-up-count column reads "Follow-up N done" / "No follow-ups yet" rather than a bare number. Logging a follow-up or rescheduling from any page invalidates the My Day query too (`RESOURCE.myDay`, alongside the lead and activities namespaces) — without that, a row a Log-follow-up action had just resolved would keep showing until a manual reload, which is worse than not offering the shortcut at all. When every bucket is empty the page says "Nothing owed right now" instead of rendering three empty tables that would look like something failed to load.

### CRM — Quotations / MOU (built)

**Quotations** (`/app/crm/quotations`): table with a "New quotation" primary action, `FilterBar` search, and a per-row action cell showing whatever legal status moves `nextStates("quotation", row.status)` returns as small buttons — a "Revise" button separately, since revising is not a status move (it creates a new document) — plus a compare icon on any row past revision 1. `CreateQuotationModal` is one scrollable panel, not a multi-step wizard: a quotation has fewer interdependent fields than lead intake, and nothing here gates a later field's validity the way geography cascades or contact rules do. It doubles as the revision form (`revisionOf` prop) — prefilling every field from the quotation being revised and requiring a reason, rather than being a second, parallel implementation. Price lines and payment milestones are both repeatable-row editors (add/remove, `Trash2` icon, disabled at one remaining row) with a live running total — price lines show ₹ sum, milestones show "N% of 100%" turning rose when off. The revision-comparison view is a plain side-by-side table inside a `Modal`, one column per revision, rather than a bespoke diff component — the SoW asked for a comparison endpoint and view, not a diffing engine.

**MOU** (`/app/crm/mou`): "New MOU" opens `CreateMouModal`, whose only picker is an **accepted-quotation select** (quotation status ACCEPTED filters the list client-side) — everything else on the MOU follows from which quotation it locks onto, so contract value defaults from the quotation's total the moment one is picked, editable if final terms drifted. The **Sign MOU** action keeps its `ConfirmDialog`, now describing what it actually creates (a named, located, sized project; a payment schedule built from the quotation's own payment terms; a licence checklist sized to however many licence types are configured) instead of the fixed five-bullet stub list — that action is still irreversible and still spins up multiple records, so the UI still has to say so, just accurately. A small **Director-approval threshold** `Card` sits above the table, visible only when `canAccess(role, admin, FULL)` — the same gate the server itself checks before allowing a sign above the threshold, so the card is never shown to someone it would only 403.

### Projects & Compliance
- Projects: card grid or table, each showing code, client, status, work-package progress bar.
- **Licences**: this is the compliance heart. Kanban by `LicenceStatus` per bundle, plus a per-licence detail with two logs — authority visits and query/response threads — presented as vertical timelines. Overdue queries surface on the Dashboard rail.
- Feasibility / DPR: version list with the current version pinned at top.

### Schedule
`ScheduleCalendar` week/month view over work packages, plus a Gantt-style bar list ordered by `sequence`. Colour-code by `WorkPackageStatus` using the semantic palette. Site visits and licence authority-visit dates appear on the same calendar — one place to see "who is going where".

- **Delay reasons are a pick-list, never free text.** `DelayWorkPackageModal` is a `<select>` over `WorkPackageDelayReason` and shows `WORK_PACKAGE_DELAY_REASON_LABELS` from shared-types. Any future screen that shows or filters by delay reason uses the same labels rather than restating them.
- **Derived flags come from the API, not the client.** `isDelayed`/`daysDelayed` (work packages), `isOverdue`/`daysOverdue` (licences, invoices) and `progressPct` (projects) arrive on every list and detail response. Screens should render them as they arrive, not recompute them, so a badge can never disagree with the dashboard. A delayed package or an overdue licence gets the rose/amber semantic tone, never a new colour.

### Billing & Receivables
- Invoices: the densest table in the app. Columns: number, kind pill, client `IdentityCell`, taxable, GST split (CGST+SGST or IGST — show which regime applied), retention, total, status pill. All money `tabular-nums`, right-aligned, formatted from paise.
- Receivables: ageing buckets (Current / 0-30 / 31-60 / 61-90 / 90+) as a summary strip of `StatCard`s above the receipts table, with the existing `AgeingBadge` per row. The bucket boundaries are defined once, as `ageingBucket()`/`AgeingBucket` in shared-types; `AgeingBadge` and the API's `Invoice.ageingBucket` both use them. An invoice with a `null` bucket (not an open receivable, or no due date) shows an em dash, not "Current". Group by the invoice's own `clientName` snapshot.

### Documents
Grid of document cards with kind badge, version, and project/lead link. The reference's block-editor screen maps to a future **DPR / quotation builder** — a genuinely large feature. That is P3 in `PROJECT_CONTEXT.md`; do not start it as part of a visual refresh.

### Admin
Users, Roles, Master Data as plain tables. Roles page should render the permission matrix from `packages/shared-types/src/permissions.ts` as a read-only grid — it's the clearest possible way to explain access, and the data already exists.

**Built, not pending.** `RoleRecordPage.tsx` is now exactly this grid rather than a plain key/label/description table: one row per `Role`, one column per `AppModule`, values read straight from `PERMISSION_MATRIX` with no parallel copy in the frontend, `NONE` rendered as a muted dash rather than competing with a real access level for attention, `READ`/`WRITE`/`FULL` on their own indigo ramp in `StatusPill` so they can't be misread as a lifecycle status, a legend under the header spelling out the four values, and the role-label column plus the module header row both sticky so a nine-column grid stays orientable while it scrolls past the 1280px floor.

**Reference-data screens** (Qualification Criteria, Geography, Lead Sources, Feedstock Types, **Licence Types**) deliberately break from the `ResourceTable` pattern. These lists are short, edited rarely, and every field matters at once, so a row opens into nothing — the row *is* the editor. Geography uses a four-column drill-down that mirrors the cascade the intake form walks, so an admin navigates the data the same way a salesperson meets it. Lead Sources uses one card per source with an explicit Save button, because several fields change together and an auto-save on blur would fire four requests for one edit. **Licence Types** (`/app/admin/licence-types`) is card-per-row like Feedstock Types — label/authority/expected-visits inputs plus bundle/scope `<select>`s, a dirty-tracked draft with its own explicit Save button — because it is what `signMou()`'s licence checklist is built from, and the same "several fields change together, don't auto-save on blur" reasoning applies.

**A setting that changes nothing visible needs to say what it would change.** Editing a feedstock yield factor does not move leads that already exist, so the Feedstock Types screen carries a small panel counting the open leads whose stored estimate has fallen behind, and one explicit action to bring them forward. Without it an admin edits a number, sees the CRM report the old figure, and concludes the screen is broken. Any future setting with the same shape — stored derived values behind an editable assumption — should show the same count-and-act pair rather than leaving the gap silent.

**An empty field and a zero are different answers, and the UI must not blur them.** A yield factor of null means "not decided"; zero asserts no yield. The row renders a "Not configured" pill for null and a live "10 TPD ⇒ x T/day" preview for a real number, so which one is stored is never a guess.

**When the server refuses a destructive action, show its message, not ours.** These rows are referenced by leads, so removal is guarded server-side and the 409 says exactly what is in the way ("Remove its 10 districts first", "1 lead came from this source"). The count is the entire answer to "why not", so `ConfirmDialog` renders the server's text verbatim in its `error` slot and stays open — a generic "Could not delete" would send the admin hunting.

## 6. Redesign phasing

Independent of feature phasing. Each stage should leave the app fully working.

**D1 — Foundation (low risk, do first).** Tokens in the Tailwind preset; rewrite `StatusPill` against the semantic map; build `Card`, `StatCard`, `IdentityCell`; restyle `Sidebar`/`Topbar`/`AppShell`; upgrade `PageHeader`; delete `StubTable`. Nothing below this line should start before D1 lands, because everything else consumes these.

**D1 is complete.** Tokens, semantic `StatusPill`, `Card`/`StatCard`/`IdentityCell`, upgraded `PageHeader`, restyled shell with collapse, and the Dashboard on `StatCard`. `StubTable` and `MetricCard` were deleted as superseded. `Card` and `IdentityCell` ship unused — D2 is their first consumer.

The `GET /auth/me` gap found during D1 — it returned the JWT payload with no `name`, so the Topbar fell back to the user's email after a reload — is fixed: `meHandler` now loads the persisted user via `getAuthUser()`.

**D2 is complete.** `FilterBar` (+ `filterRows`), `ResourceTable` with opt-in sorting, opt-in row selection, right-aligned numeric columns and the new surface; `BarChart` and `DonutMeter` as inline SVG with real empty states; the Dashboard composition (stat row, billing panel, compliance donut, active-projects table).

As-built notes:
- **No fabricated data anywhere.** Every Dashboard panel renders an empty state rather than sample numbers. Invented revenue on a dashboard is worse than a blank panel because it looks authoritative and gets screenshotted. Panels wire up when the reports endpoints exist.
- **`FilterBar` + `IdentityCell` were adopted on Leads, Users, Invoices, Activities, Quotations, Projects, Payment Schedules and Progress Updates** — eight list pages now, not all nineteen. The first three cover the distinct shapes (identity-led list, money-led table, simple reference table); the second five were a later consistency pass bringing every remaining page that was still the original unstyled scaffold up to the same pattern (see the note below). The rest inherit the restyle through the shared components and can take a search box when someone actually needs one. Note these eight page files are now hand-owned — `scripts/scaffold-web-modules.mjs` would overwrite them, so treat it as spent rather than re-runnable for these.
- **Sortable headers repeat `uppercase`** on the inner button: Preflight resets `text-transform` on buttons, so without it sortable headers render title-case while the rest stay uppercase.
- **`paiseToDisplay` now groups Indian-style** (₹1,33,10,000.00, not ₹13310000.00). Contract values here run to crores and ungrouped digits are genuinely misread. Grouping is applied to the integer rupee part, never to `paise / 100` as a float.
- **A foreign key is not a column value — `components/RefCell.tsx`.** Activities, Quotations, Payment Schedules and Progress Updates all carry raw ids to a parent record (a lead, a project, an MOU, a work package), and printing a 24-character ObjectId tells the reader nothing. `RefCell` renders the resolved name through `IdentityCell` when the page has it, falls back to a short id when it does not (the row exists somewhere; the label just was not in whatever page the caller fetched), and only wraps the cell in a `Link` when the caller passes a `to` — never guessed. **Only add `to` once a detail route for that entity actually exists.** At this pass `/app/crm/leads/:id` is the only detail route in the app, so the Lead references on Activities and Quotations link; the Project/MOU references on Payment Schedules and the Work Package reference on Progress Updates render unlinked, because `/app/projects/:id`, an MOU detail route and `/app/schedule/work-packages/:id` are not routes yet (the router is still list-only outside Leads — see D3's note on the same gap blocking licence timelines). Wiring a click to a route that does not exist is worse than no click at all.
- **Where the page's own list has no reference data to resolve against**, a small hook fetches the referenced list once and builds an id → label map — `modules/crm/api/lead-lookup.ts` (`useLeadLabels`) for the two CRM pages, inline `Map`s built from `projectApi.useList()` / `mouApi.useList()` / `workPackagesApi.useList()` for Payment Schedules and Progress Updates, since those APIs already return their whole unpaginated list. Resolution happens **before** `filterRows` runs, so searching "Surat BioEnergy" on the Activities page finds that lead's activities by name, not just ones whose summary happens to mention it.

**D2 (original plan) — Lists and the Dashboard.** `FilterBar`; `ResourceTable` upgrades (sorting, selection, `IdentityCell`); restyle all module list pages; build the real Dashboard composition including `BarChart` and `DonutMeter`. Dashboard data wiring depends on report endpoints that don't exist yet — build against the existing stub values first and wire real numbers when the reports module is built.

**D3 — Rich views. Partially complete.**

Done:
- **`KanbanBoard`**, generic over any lifecycle, wired to leads, licences and work packages behind a `ViewToggle` (table stays the default). Drag-and-drop plus a per-card "Move" menu, because drag is mouse-only and these boards are wide.
- **MOU signing flow** — `ConfirmDialog` spelling out all five records the signature creates, with Cancel focused rather than Confirm.
- **`ActivityRail`** (`components/ActivityRail.tsx`) — the chronological activity timeline, built once and used by both the lead detail workspace and the rebuilt Activity Log (`/app/crm/activities`). Date-group separators (Today / This week / a month name), per-type icons, a `line-clamp-2` on long summaries with a "Show more"/"Show less" toggle, a chip for a committed follow-up, and a kept/broken badge resolved from whichever later activity answered that promise. `ViewToggle` gained optional `secondLabel`/`secondIcon` props so the Activity Log could relabel its second option "Timeline" with a list icon instead of "Kanban" with a board icon, without touching its other two callers (Leads, Licences, Work Packages), which still see the original label and icon.

Not started, and why: **`ScheduleCalendar`** remains — same reasoning as before, nothing new to add. **Licence visit/query timelines** are blocked on something more basic: the router has no detail routes at all (`/app/...` is list-only outside `/app/crm/leads/:id`), so there is nowhere for a per-record page to live. Adding that route layer is the prerequisite, and it is an architecture decision rather than a styling one. The Dashboard's separate `AttentionRail` (cross-entity "what needs attention", see §3/§5) is also still unbuilt — it wants aggregation across licences, invoices and work packages that no endpoint provides yet, and building it against three separate list calls would be throwaway work once reporting exists.

As-built notes:
- **`TRANSITION_MAP` moved to `packages/shared-types/src/transitions.ts`.** The board must know which moves are legal to avoid offering doomed drops, and §4's "lives in one place only" rule forbids a client-side copy. The API's `core/state-machine` now imports the map and keeps only the enforcement wrapper (`assertTransition`, which still throws 409).
- **Legality is enforced in the UI as well as the server**: illegal columns refuse the drop (no `preventDefault`, so the browser shows "no drop"), terminal cards are not draggable and get no Move affordance, and the menu lists only real targets. The server stays the authority; the UI just declines to offer actions it knows would 409.
- Cards move optimistically only in the sense that the board disables the card while the mutation is in flight; a rejection surfaces the server's message rather than silently reverting.

**D4 — Interaction, Motion & States is complete.** A combined pass across motion, loading, empty states and accessibility, run as one task since all four are really the same question — "does the app feel handled, or does it just appear" — asked at different points in a page's life. No new dependency: every transition below is a Tailwind `transition`/`duration`/`animate-pulse` utility, nothing from `framer-motion` or similar, consistent with how `BarChart`/`DonutMeter` were built as inline SVG in D2 rather than reaching for a chart library.

**D4a — Motion.** `Modal.tsx`, `Toast.tsx` and the lead detail workspace's inline "⋯" menu all animate open and closed now, where before every one of them appeared and vanished in a single frame.
- **`Modal`**: the backdrop fades and the panel fades-and-scales in over `duration-[180ms]`, and the same combination reverses over `duration-[120ms]` on close. The component used to `return null` the instant `open` went false, which made an exit transition impossible — there was nothing left to animate. It now tracks its own `mounted`/`shown` state: `open` going true mounts the dialog and, one `requestAnimationFrame` later, flips it to its "shown" classes (that one-frame gap is what makes the *entrance* transition play at all — collapsing mount and "shown" into the same render paints the final state directly and skips the transition on every open, not just close); `open` going false flips `shown` back immediately and defers actually unmounting for `LEAVE_MS` (120, matching the CSS duration) so the exit has time to finish.
- **`Toast`**: each toast now slides in from the right and fades in on mount (a per-item `entered` flag flipped on the next frame, the same trick as Modal), and fades out **before** it leaves the list rather than snapping out of existence. This meant splitting `dismiss()` into two steps — mark the toast `leaving` (which flips its classes back to the hidden state and lets the transition play) and only remove it from the array `LEAVE_MS` (150) later — and routing both the auto-dismiss timer *and* the manual × button through that same `dismiss()`, so neither path skips the animation the other gets.
- **The "⋯" menu** (`LeadDetailPage.tsx`): closing was already instant — the panel fully unmounts via `{menuOpen && (...)}` — so only opening needed work. A small local `MenuPanel` wrapper plays a `duration-150` fade-and-scale from `scale-95 opacity-0` using the same next-frame trick, and needs no leave-delay bookkeeping at all, because every open is a fresh mount with nothing to keep around after close.
- **`motion-reduce:transition-none` on every one of the above.** Nothing in this app checked `prefers-reduced-motion` before this pass. With the class present, a reduced-motion user gets the same open/closed states with zero animated distance — not merely a *faster* animation, an *instant* one — while everyone else gets the movement described above.

**D4b — Loading states.** A new `Skeleton` component (`components/Skeleton.tsx`) — a single pulsing `bg-slate-200` block, sized entirely by `className`, `motion-reduce:animate-none` — replaced every literal "Loading…" string found across `apps/web/src`. The rule throughout was **shape it like what's actually loading**, not "put a skeleton somewhere":
- `ResourceTable` shows `SKELETON_ROW_COUNT` (5) rows built from the *real* `columns` array — right-aligned columns get a narrower right-justified bar — instead of one line of grey text spanning the whole table.
- `ActivityRail` gained an `isLoading` prop rendering a few icon-circle-plus-two-lines rows; both its call sites (the lead detail timeline and the rebuilt Activity Log's timeline view) used to hand-roll their own "Loading…" paragraph around it, so fixing it once here reached both, and the Activity Log's ternary chain about who's empty/loading/erroring got shorter as a side effect.
- `KanbanBoard` renders the *real* columns (labels are known before any card is) each with a couple of card-shaped placeholders, instead of one centred line replacing the whole board.
- The three reference-data admin screens (Lead Sources, Feedstock Types, Qualification Criteria — the "row is the editor" pattern from §5) share one new `SkeletonEditorRows` composition, since all three render the identical header-plus-field-grid card shape; `GeographyPage`'s narrower drill-down column gets its own small inline list-of-bars version. `LeadPage`'s two `BarChart` panels get a new `SkeletonBars` bar-chart silhouette instead of a text line sitting where a chart is about to appear.
- `MyDayPage` shows a couple of `Card`-shaped section placeholders (a header bar plus a few row bars) instead of one grey sentence below the KPI strip.
- `ProtectedRoute` — the auth gate every route sits behind — shows an `AppShellSkeleton`: a dark sidebar-shaped strip beside a lighter content column, mirroring the actual `AppShell` split, instead of a bare "Loading…" centred on an otherwise blank screen.
- **`Dashboard.tsx` CRM strip uses `StatCard` skeletons** while `GET /api/crm/leads/summary` and `GET /api/crm/my-day` load. Open / unassigned / overdue cards deep-link to the inbox or My Day. The Sales Pipeline card (`GET /api/crm/dashboard`, gated `crm:READ` like the strip) shows a `Skeleton` block while loading, falls back to a plain sentence below 5 leads instead of a decorative `BarChart`, and its Signed MOUs / MOUs in progress / Open quotations mini-stats and per-stage table rows link out through the same unfiltered `to`/`Link` pattern the KPI cards use. The Recent Activity card reuses `ActivityRail`'s own loading/empty states. The Billing & collections and Compliance health cards read the same endpoint but are gated on their **own** `billing:READ`/`compliance:READ` rather than `crm:READ` — a Sales Head/BDE has the latter without either of the former — and each falls back to a plain sentence (Billing) or `DonutMeter`'s own honest `total={0}` state (Compliance) rather than a chart with nothing behind it. The Active Projects table reads the same endpoint too, gated on its own `projects:READ`, with "Current work package" and "Planned end" cells reading `—` honestly for a freshly signed project rather than fabricating a work package that doesn't exist yet — no fabricated trend deltas anywhere on this page. Login uses `Field` + gold `Button` (`rounded-xl`, gold focus, pending “Signing in…”). `ResourceTable` row actions render on hover and `:focus-within`. Lead Inbox charts sit behind a collapsed “Inbox insights” `<details>` so the table/kanban is first.

**D4c — Empty states.** A new `emptyStateMessage({ entityLabel, hasSearch, hasFilters, action? })` helper (`lib/emptyState.ts`) produces one of four consistent messages — "No {entity} yet.", "No {entity} match your search.", "...these filters.", or "...your search and filters." — instead of every page writing its own slightly different wording, or, as `ActivityPage` did before this pass, branching on `search` in two places that didn't actually agree with each other once a *non-search* filter (type, date range, the segmented cut) was the reason a filtered view came up empty. `ResourceTable`'s `emptyHint` prop now accepts either a plain string (unchanged for every caller that still passes one) or `{ message, action }`, rendering the action as a real button inside the table's own empty row — plain-string usage needed no changes anywhere.

Migrated to the shared helper: `UserPage`, `InvoicePage`, `LicencePage` (both its table view and its `KanbanBoard`'s per-column message — the board's `emptyHint` prop stays a plain string, so it takes the helper's `.message`), `ActivityPage` (fixing the search/filter conflation above), `MouPage`, `WorkPackagePage` (table and kanban, same pattern as Licences), `ProjectPage`, `QuotationPage`, `ProgressUpdatePage`, and `MyDayPage`'s per-bucket `ResourceTable`. Pages whose true-empty state already carried real, specific onboarding copy — `LicencePage` ("Licences appear once an MOU is signed."), `ProjectPage`, `QuotationPage`, `ProgressUpdatePage` — keep that bespoke sentence for the *no-data-at-all* branch and only route the *search-miss* branch through the helper, since "add a business-specific opening sentence" and "say which of search/filters came up empty" are different jobs and only the second one is what the helper is for.

**`LeadPage`'s bespoke "No leads yet" block folded into the same mechanism.** It used to be a second, separate empty-state implementation living *outside* `ResourceTable` entirely — a whole extra `rounded-xl bg-white p-10` card with its own "Add Lead" button, shown only via an outer ternary that bypassed the table altogether when the inbox was genuinely empty. It is now just `emptyHint={{ message: "...", action: { label: "Add Lead", onClick: () => setWizardOpen(true) } }}` passed straight to `ResourceTable`, using the same `action` mechanism D4c added — one fewer bespoke empty-state implementation in the app, not a second one to keep in sync with the first.

**D4d — Accessibility.** `Card`, `PageHeader` (`components/PagePrimitives.tsx`), `StatusPill`, `IdentityCell`, `BarChart` and `DonutMeter` deliberately got **no** focus rings: none of them renders an interactive element of its own — they're presentational wrappers a page places a real `<button>`/`<Link>`/`<input>` *inside*, and the interactive descendant already carries the standing `focus-visible:ring-2 ring-methanova-gold` convention. Adding a ring to the wrapper itself would put a second, redundant focus indicator around content that was never going to receive keyboard focus, which is a correctness regression (a focus ring implies "this can be activated"), not an accessibility fix. `StatCard` stays presentational unless `to` is set, in which case it is a real `Link` and carries the gold focus ring.

A full search of `apps/web/src` for a `<div>`/`<span>` carrying an `onClick` that stands in for a real control — the actual bug this sub-phase exists to catch, since such an element is invisible to keyboard and screen-reader navigation — **found none**. Every `onClick` in the tree resolves to one of: a real `<button type="button">` (the overwhelming majority — row actions, modal footers, the "⋯" menu's own items, `KanbanBoard`'s per-card "Move" menu); a legitimate `aria-hidden` dismiss-scrim (`Modal.tsx`, `ConfirmDialog.tsx`); a propagation guard that only calls `event.stopPropagation()` around nested buttons (`LeadPage.tsx`, `MyDayPage.tsx`); or a real `<Link>` (`RefCell.tsx`) whose own `onClick` is the same kind of guard. `ResourceTable`'s clickable rows are `<tr>` elements, not divs, and already carry `role="link"`, `tabIndex={0}` and an Enter/Space `onKeyDown` handler. Nothing needed converting.

## 7. Rules worth stating once

- **Tokens, not hex.** Any raw colour literal in a component is a bug.
- **Colour encodes meaning.** Never pick a status colour for looks; use the §2 table.
- **Money is formatted, never raw.** All amounts come through `lib/formatters.ts` from integer paise. A number on screen without a currency format is a bug.
- **Every list has three states.** Loading, empty (with a sentence saying what would appear here), and error. `ResourceTable` already does this — don't bypass it with bespoke tables.
- **No fabricated data, ever — first stated in §6's D2 notes, now load-bearing across the app.** When there is genuinely nothing to show (an empty My Day queue, an empty Activity Log, too few leads for a chart to mean anything), say so in a plain sentence. Never render a plausible-looking chart, a placeholder number, or a status message implying pending work that isn't actually pending — a lead that skipped qualification is a fact about its history, not a task still outstanding, and the Qualification card's copy has to say which one it is.
- **One query-key namespace per resource, always built from `lib/queryKeys.ts`.** Keys are `[resource, "list" | "detail" | …]` — never the URL path, and never an inline array literal. Resource names are declared once in `RESOURCE` so a typo cannot silently open a second namespace. This is a hard rule because breaking it produces a uniquely nasty bug: the mutation succeeds, the toast confirms it, and the screen keeps showing stale data, which is indistinguishable from a silent write failure. A mutation should need exactly one `invalidateQueries({ queryKey: <resource>Keys.all })`; if you find yourself invalidating two keys for one entity, the namespaces have split again.
- **Accessibility floor.** Body text at 4.5:1 contrast; focus rings visible (`focus-visible:ring-2 ring-methanova-gold`); every icon-only control gets an `aria-label`; status is never conveyed by colour alone — the pill always contains text.
- **Responsive floor.** Works at 1280px. Tables scroll horizontally rather than squashing. Full mobile is not a goal — this is a desk tool.
- **Originality.** Inspiration is a pattern language, not a palette or a logo. Don't replicate another product's branding, and don't ship placeholder content lifted from a reference screenshot.

## 8. Implementation prompt

Paste this to kick off the D1 stage in a fresh session:

> Read `DESIGN_SYSTEM.md` and `PROJECT_CONTEXT.md` first. Execute **stage D1 only** — the foundation layer — and do not touch business-module behaviour, API code, or any page's data logic; this is a visual-layer change.
>
> 1. Extend `packages/config/tailwind.preset.js` with the colour tokens in DESIGN_SYSTEM.md §2 (`greenDark`, `greenTint`, `goldTint` alongside the existing `green`/`gold`).
> 2. Rewrite `apps/web/src/components/StatusPill.tsx` to map status strings to the semantic palette table in §2 instead of hashing the string. Cover every value in `packages/shared-types/src/lifecycles.ts` plus the eight roles, with a neutral fallback for unknown strings.
> 3. Add `components/Card.tsx`, `components/StatCard.tsx` (icon, label, value, optional trend delta pill), and `components/IdentityCell.tsx` (avatar or initials + primary line + muted secondary line).
> 4. Upgrade `PageHeader` in `components/PagePrimitives.tsx` to take an optional subtitle and a right-hand action slot. Delete `StubTable` and any imports of it.
> 5. Restyle `app/layout/Sidebar.tsx`, `Topbar.tsx`, and `AppShell.tsx` per §4: dark green rail, grouped labelled nav with gold active indicator, collapse-to-icons toggle persisted in localStorage (wrapped in try/catch), max-width-constrained content area.
> 6. Update `modules/reports/pages/Dashboard.tsx` to use `StatCard` — keep the existing hardcoded placeholder values, do not wire real data.
>
> Keep every existing route working and the role-filtered nav behaviour unchanged. When done, run `pnpm typecheck`, `pnpm lint`, and `pnpm build`, then start the dev server and verify in a browser: login, the dashboard, one list page, sidebar collapse/expand, and sign out. Report what changed and anything in DESIGN_SYSTEM.md that turned out to be wrong in practice so the document can be corrected.
