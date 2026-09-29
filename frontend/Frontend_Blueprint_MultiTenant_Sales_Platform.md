# Multi-Tenant Sales & Calling Platform — Frontend Specification

**Derived from:** Multi-Tenant Sales & Calling Platform Blueprint V1
**Owner:** Vishnu — Frontend Developer
**Purpose:** Screen-by-screen, role-by-role, module-by-module specification of every frontend surface in the application, written to be handed directly to an AI coding agent (Antigravity) as a build spec.

---

## 0. How to Use This Document

This document assumes the backend blueprint's data model, RBAC model and feature-entitlement model as given. It does **not** re-derive architecture decisions — it translates them into concrete UI: which screens exist, who can see them, what's on each screen, what states each screen can be in, and how the two tenants (GHL India Ventures, Jamin Bazaar) diverge on shared screens.

Feed this to Antigravity one section at a time (per module) rather than all at once — each module section (Section 7) is self-contained enough to generate a working page/route/component set on its own, provided Sections 1–4 (design system, layouts, navigation, auth) are built first.

---

## 1. Frontend Architecture Principles

- **One codebase, tenant-aware rendering.** The frontend never hardcodes "if GHL / if Jamin" branching scattered through components. Instead, it reads two things after login and derives everything from them:
  1. `enabledFeatures: string[]` — the feature keys this company has (e.g. `leads`, `properties`, `investors`).
  2. `permissions: string[]` — the action keys this user's role grants (e.g. `leads.create`, `reports.export`).
- **UI visibility ≠ security.** The frontend hides/disables based on `enabledFeatures` + `permissions` purely for UX. Every API call still gets rejected server-side if unauthorized — the frontend must handle 403 responses gracefully (toast + redirect, never a blank crash).
- **Config-driven navigation and forms wherever possible.** The nav menu, the lead custom fields, and the pipeline stages should be rendered from configuration objects (some from the backend, some as local constants) rather than duplicated per-tenant components. This is what lets one Leads module serve both GHL and Jamin.
- **Route guarding at three levels**, evaluated in this order per route:
  1. Authenticated? → else redirect to Login.
  2. Feature enabled for this tenant? → else show "Not available for your organization" / redirect.
  3. Permission present? → else show "You don't have access to this" / hide the nav entry entirely (don't just disable — don't reveal existence of screens a role can't reach).

---

## 2. Global Design System

Keep this minimal and consistent; both tenants share one visual language, differentiated only by a tenant logo/accent color if desired later.

| Token | Guidance |
|---|---|
| Color roles | Primary (brand/action), Neutral scale (backgrounds/borders/text), Success/Warning/Danger/Info (status chips, toasts, disposition tags) |
| Typography | One sans-serif family; scale for page titles, section headers, table text, captions/meta text |
| Spacing | 4/8px base spacing scale used consistently across cards, tables, forms |
| Elevation | Flat cards with 1px border by default; shadow reserved for modals, dropdowns, popovers |
| Status chips | Reused everywhere: Lead status, Deal stage, Follow-up state, Call disposition, Booking status, Plot availability — one `<StatusChip variant>` component, color mapped by a shared status-color config |
| Icons | One icon set throughout (e.g. lucide) — calling, WhatsApp, mail, document, filter, export icons need to be visually consistent since they appear across nearly every module |
| Tables | One reusable `<DataTable>` component (sortable columns, sticky header, row actions menu, pagination, empty state, loading skeleton) — every module's list view is a configuration of this one component, not a bespoke table |
| Forms | One reusable form-field set (text, select, multi-select, date/time picker, phone input with country code, currency input, file upload, rich-text notes) built once and reused across Leads, Customers, Deals, Properties, Investors, etc. |
| Modals vs Pages | Quick create (Lead, Follow-up, Note) = modal/drawer. Full record edit (Customer 360, Deal, Property) = dedicated page. Keep this rule consistent so users learn the pattern. |

---

## 3. App Shell & Layouts

Three layout shells, matching the backend's suggested frontend folder structure (`AuthLayout`, `AdminLayout`, `SalesLayout`):

### 3.1 AuthLayout
Used for: Login, Forgot Password, Reset Password, (future) Invite-Accept screen.
- Centered card on a branded background/split-screen.
- No nav, no tenant context yet (tenant is resolved by the login response, not chosen by the user unless a user belongs to multiple tenants — out of scope for V1, assume one tenant per login).

### 3.2 AdminLayout (Super Admin)
- Left sidebar: fixed, platform-level nav (Section 4.1).
- Top bar: Super Admin identity, global environment indicator (e.g. "Platform Console"), no tenant switcher needed since Super Admin operates above tenants — but the Companies module lets them "view as"/drill into a specific company's data read-only.
- No company logo/branding — this is the platform's own operator console, visually distinct (e.g. darker sidebar) from the tenant-facing app so operators never confuse it with a customer view.

### 3.3 SalesLayout (Company Admin / Sales Manager / Sales Executive)
- Left sidebar: collapsible, tenant-branded (company name/logo if set), nav items rendered from `enabledFeatures + permissions` (Section 4.2).
- Top bar: global search, notification bell (unread count badge), quick "New" button (context menu: New Lead / New Follow-up / New Deal, filtered by permission), user menu (profile, switch theme, logout).
- Persistent **incoming call bar/popup** lives at this layout level (not per-page) since a call can arrive while the user is on any screen — see Section 7.6.

---

## 4. Navigation Map

### 4.1 Super Admin Sidebar
1. Dashboard (platform-level)
2. Companies (tenants)
3. Users (cross-tenant view, filterable by company)
4. Roles
5. Permissions
6. Features (entitlement packages)
7. Call Configuration
8. Audit Logs
9. System Settings

### 4.2 Company User Sidebar (Company Admin / Sales Manager / Sales Executive — items filtered by `enabledFeatures` + `permissions`)
1. Dashboard
2. **Sales** (section header)
   - Leads
   - Customers
   - Pipeline
   - Deals
   - Follow-ups
3. **Calling** (section header)
   - Call Center
   - Call History
4. **Operations** (section header — Jamin tenant only, via `properties` feature flag)
   - Properties / Projects
   - Plot Inventory
   - Site Visits
   - Bookings
5. **Investors** (section header — GHL tenant only, via `investors` feature flag)
   - Investors
   - Consultations
   - Investment Opportunities
6. Reports
7. Notifications
8. **Administration** (section header — only if any of these permissions present)
   - Users
   - Roles
   - Company Settings

Sidebar section headers with zero visible children (because every child feature is disabled/unpermitted) are omitted entirely, not shown collapsed-empty.

---

## 5. Authentication Module

| Screen | Fields / Content | Notes |
|---|---|---|
| Login | Email, Password, "Remember me", Forgot password link | On submit: authenticate → backend resolves tenant + role → frontend stores access/refresh token → loads `enabledFeatures` + `permissions` → redirects to Dashboard. Show inline error for bad credentials, account-disabled, company-inactive. |
| Forgot Password | Email | Success state: "check your email" message, no account-enumeration leak in copy. |
| Reset Password | New password, Confirm password | Token from email link in URL; expired/invalid token → dedicated error state with "request new link" CTA. |
| Session Expired | — | Global interceptor: any 401 mid-session → toast "Session expired" → redirect to Login, preserving intended destination for post-login redirect. |

---

## 6. Feature-Flag & Permission Rendering Rules (Frontend Contract)

Build one small set of primitives and use them everywhere instead of ad-hoc `if` checks in every component:

- `<RequireFeature feature="properties">...</RequireFeature>` — renders children only if enabled for the current tenant.
- `<RequirePermission permission="leads.delete">...</RequirePermission>` — renders children only if the current user's role grants it.
- `useCan('leads.update')` hook — returns boolean for inline conditionals (e.g. disabling a button rather than hiding a whole section).
- `<ProtectedRoute feature="..." permission="...">` — wraps route elements; unauthorized access shows a dedicated "Access restricted" page rather than a broken screen, and does not leak whether the route exists to users without permission for it in nav (Section 1).

---

## 7. Module Specifications

Each module below follows the same template: **Purpose · Access · List View · Detail View · Create/Edit · States · Tenant Notes**. Skip subsections that don't apply to a given module.

### 7.1 Dashboard

**Purpose:** At-a-glance operational snapshot, role-scoped.
**Access:** All roles, content varies by role.

- **Super Admin Dashboard:** platform-wide cards — total companies, active users, calls today (all tenants), system health/uptime indicator, recent audit events feed, per-company quick stats table (companies × leads/calls/conversion this week).
- **Company Dashboard (Admin/Manager/Executive):** tenant-scoped cards — today's leads, open/pending follow-ups (with overdue count highlighted), today's calls (answered/missed breakdown), conversion rate (period selector: today/week/month), deal value in pipeline (if `deals` enabled), agent performance mini-leaderboard (Manager/Admin only), lead-source performance chart, company-specific KPI widgets (e.g. Jamin: site visits this week / bookings this month; GHL: consultations this week / investment opportunities in progress).
- Sales Executives see the same dashboard shape but scoped to **their own** assigned records, not the whole team.

**States:** loading skeleton per card (cards load independently, not a full-page spinner), empty state per widget ("No leads today yet"), error state per widget with retry (one failed widget shouldn't blank the whole dashboard).

### 7.2 Global Search

**Purpose:** Cross-entity search from the top bar (leads, customers, deals, properties/plots, investors, documents).
**Access:** All roles, results scoped to tenant + permission (a Sales Executive doesn't see other agents' unassigned-to-them records in results if that's restricted by role).
- Search-as-you-type dropdown grouped by entity type, each result row showing entity icon, primary label, secondary meta (phone/status), click → navigates to detail view.
- "See all results for '...'" footer link → dedicated search results page with tabs per entity type when there are many matches.
- Empty state: "No results for '...' — try a different name, phone or email."

### 7.3 Leads

**Purpose:** Capture and manage inbound/manual/imported leads before conversion.
**Access:** View/Create/Update/Delete gated individually by `leads.*` permissions. Sales Executives typically see only assigned leads; Managers/Admins see team/company-wide with a filter toggle "My leads / Team leads / All leads".

- **List View:** `<DataTable>` columns — Name, Phone, Source, Status (chip), Priority (chip), Assigned Agent, Next Follow-up date, Created date. Filters: status, priority, source, assigned agent, date range, tenant-specific custom fields. Bulk actions (if permitted): bulk assign, bulk status change, bulk export. Row actions: Call (click-to-call icon), View, Edit, Convert, Delete.
- **Detail View:** Header (name, phone, status/priority chips, quick actions: Call / WhatsApp (if enabled) / Convert). Tabs: Overview (all core + custom fields), Activity Timeline (status changes, notes, call log entries), Follow-ups (scoped list + quick-add), Documents (if attached).
- **Create/Edit (drawer or modal for quick-create, full page for edit):** Name, Phone, Email, Location, Source (select), Assigned Agent (select, permission-gated), Status, Priority, Next Follow-up (date/time), Notes, **Custom Fields section** rendered dynamically from the tenant's configured custom-field schema (this is the mechanism that lets GHL capture "Investment Amount Interest" and Jamin capture "Budget Range / Preferred Location" without separate forms).
- **Import:** dedicated sub-flow — file upload (CSV/Excel) → column-mapping step → validation/preview table (flag duplicates/errors inline) → confirm import → result summary (X imported, Y skipped, Z errors) with downloadable error report.
- **Convert action:** modal — convert to Customer, optionally also create a Deal in the first pipeline stage; on Jamin this can also seed a Site Visit; on GHL it can seed a Consultation.
- **States:** empty ("No leads yet — create your first lead or import a list"), loading skeleton table, permission-denied (executive trying to bulk-delete), 403 fallback.

### 7.4 Customers (Customer 360)

**Purpose:** Unified record of a converted contact across all interactions.
**Access:** `customers.*` permissions; same ownership scoping pattern as Leads.

- **List View:** Name, Phone, Status, Assigned Agent, Last Contacted, Open Deals count, Location. Filters mirror Leads plus "has open deal" toggle.
- **Detail View (the core "360" screen):** Header with contact info + quick actions (Call/WhatsApp/Email/New Follow-up/New Deal). Tabs:
  - **Overview** — contact info, lead source/history summary, company-specific relationship fields.
  - **Calls** — all call records with outcome, duration, recording playback (if `call-recording` enabled and permitted), transcription snippet (if enabled).
  - **Follow-ups** — scoped list + inline complete/reschedule actions.
  - **Deals** — scoped list of deals/opportunities linked to this customer, each showing stage chip and value.
  - **Notes & Activity Timeline** — chronological feed merging status changes, calls, notes, document uploads, follow-up completions — this is the single most important tab for agent context before a call.
  - **Documents** — upload/list/download, permission-gated.
- **States:** as Leads, plus a distinct empty state per tab ("No calls logged yet with this customer").

### 7.5 Pipeline & Deals

**Purpose:** Visualize and manage the sales stages, tenant-configurable.
**Access:** `deals.*` / pipeline view permission.

- **Pipeline (Kanban) View:** Columns = tenant-configured stages (shared default: New → Qualified → Proposal/Consultation → Negotiation → Won/Lost; GHL: Enquiry → Contacted → Consultation → Qualified Investor → Investment Opportunity → Converted; Jamin: Enquiry → Contacted → Interested → Site Visit → Plot Selected → Booking → Converted). Cards show contact name, value (if applicable), assigned agent avatar, days-in-stage indicator (flag if stale). Drag-and-drop between columns (permission-gated; falls back to a stage dropdown on the card for permission-denied or touch/mobile).
- **Deals List View (alternate to Kanban):** `<DataTable>` — Name, Stage, Value, Assigned Agent, Created, Expected Close. Same filter pattern as Leads.
- **Deal Detail View:** stage progress stepper at top, linked customer/lead card, value + expected close date, activity timeline, documents, notes, "Mark Won / Mark Lost" actions with a reason field.
- **Create/Edit:** Linked contact (select existing customer/lead or create new inline), Stage, Value, Expected Close Date, Assigned Agent, Notes.
- **States:** empty pipeline column ("No deals in this stage"), drag-and-drop failure (revert + toast on API error), permission-denied for stage-skip if role restricts it.

### 7.6 Call Center (Live Calling)

**Purpose:** Real-time calling surface — the most stateful screen in the app.
**Access:** `calls.*` permissions; agent must additionally be "available" in routing.

- **Agent Availability Toggle:** persistent control in the top bar or Call Center page (Available / Busy / Offline) — drives whether routing sends calls to this agent.
- **Incoming Call Popup (global, layout-level, Section 3.3):** appears over any screen — caller name/number (resolved against Leads/Customers if matched, else "Unknown Number"), matched record context card, Accept / Reject buttons, ring timeout indicator.
- **In-Call Bar:** persistent while connected — timer, Mute, Hold, Transfer (permission-gated, shows agent/queue picker), End Call, and a live "quick note" field.
- **Click-to-Call:** available inline from Lead/Customer rows and detail headers — initiates outgoing call, opens the same in-call bar.
- **Post-Call Disposition Modal (mandatory on hang-up):** Disposition select (Interested / Not Interested / Follow-up Required / Call Back / Wrong Number / Converted / No Response), Notes, conditional follow-up scheduler (if disposition = Follow-up Required/Call Back), conditional "convert now" shortcut (if disposition = Converted).
- **Call Center Home (when idle):** queue status (calls waiting, agents available), today's call stats for this agent, missed-call list with one-click callback.
- **States:** call-connect failure (toast + auto-return to idle), no-matched-record (still allow logging against a new/unknown contact), recording-consent indicator if `call-recording` enabled (visible to agent, not necessarily editable).
- **Tenant Notes:** GHL and Jamin queues are fully separate — an agent's availability/routing only ever surfaces their own tenant's queue; this is a backend routing concern but the UI must never show cross-tenant queue data even to an agent who (hypothetically) has multi-tenant access.

### 7.7 Call History

**Purpose:** Searchable log of all past calls.
**Access:** `calls.view`; scoping mirrors Leads/Customers (own vs team vs all).

- **List View:** Date/Time, Contact, Direction (in/out chip), Duration, Agent, Disposition (chip), Recording icon (if available/permitted) → inline playback or link to player. Filters: date range, agent, direction, disposition, duration range.
- **Detail (expand row or drawer):** full call metadata, linked contact card, disposition + notes, recording player, transcription text (if `call-transcription` enabled).
- **States:** empty, loading, "recording not available" placeholder distinct from "recording still processing".

### 7.8 Follow-ups

**Purpose:** Task-like reminders tied to leads/customers/calls.
**Access:** `followups.*`; own vs team scoping.

- **List View:** grouped/filterable by state — Upcoming / Due Today / Overdue / Completed / Cancelled (tabs or filter chips, Overdue visually flagged red). Columns: Contact, Note preview, Scheduled Date/Time, Assignee, Priority, Related record link.
- **Quick actions per row:** Complete, Reschedule (inline date picker), Cancel, Call now.
- **Create (usually a drawer, launched from Lead/Customer/Call context or the global "New" menu):** Related contact (pre-filled if launched in context), Date/Time, Assignee, Priority, Notes.
- **Dashboard integration:** overdue/due-today counts feed the Dashboard widget and the notification bell.
- **States:** empty per tab, overdue badge styling, permission-denied on reassigning to another agent.

### 7.9 Reports & Analytics

**Purpose:** Aggregate reporting across sales and calling activity.
**Access:** `reports.view` / `reports.export`.

- **Report Hub (landing):** tiled list of available reports, filtered by enabled features — Lead Report, Call Report, Follow-up Report, Conversion Report, Agent Performance Report, Lead-Source Performance, Sales/Deal Report, plus tenant-specific: Jamin (Project / Site Visit / Booking / Location reports), GHL (Investor / Consultation / Opportunity reports).
- **Each Report View:** shared shell — date-range picker, additional relevant filters (agent, source, stage), chart(s) appropriate to the report (bar/line/funnel), underlying data table below the chart, Export button (`reports.export` gated) → CSV/Excel.
- **Agent Performance specifically:** leaderboard table (calls made, leads converted, avg response time, revenue/deal value) — Manager/Admin/Super Admin only, never shown to an Executive comparing themselves against peers unless explicitly permitted.
- **States:** empty ("No data for this period"), loading chart skeleton, export-in-progress indicator, export failure toast.

### 7.10 Notifications

**Purpose:** In-app notification center backing the top-bar bell.
**Access:** all roles, tenant-scoped, own-user-scoped.

- **Dropdown (top bar):** last ~10 notifications, unread indicator dot, "Mark all as read", "View all" link.
- **Full Notifications Page:** full list, filter by type (New lead assigned, Incoming/missed call, Follow-up due/overdue, Site visit scheduled/rescheduled, Booking update, Lead/deal conversion, Administrative change), mark read/unread, click-through navigates to the related record.
- **States:** empty ("You're all caught up"), real-time badge count update (poll or socket-driven — flag as a backend/infra decision, frontend just needs to consume it).

### 7.11 Documents

**Purpose:** File attachments across leads/customers/deals/properties/investors.
**Access:** permission- and tenant-document-type-gated.

- Typically **not a standalone top-level page** in V1 — surfaces as a "Documents" tab embedded in Customer 360, Deal Detail, Property/Project Detail, Investor Detail. Consider a company-level "All Documents" browser only if requirements demand it later.
- **Documents Tab pattern (reused everywhere):** file list (name, type icon, uploaded by, date, size), upload button (drag-and-drop + browse), preview (image/PDF inline, others download), delete (permission-gated), category tag where relevant (e.g. Jamin: brochure/layout/approval/price-sheet; GHL: KYC/investment/consultation-related).
- **States:** upload progress bar, upload failure retry, empty state per context.

### 7.12 Import / Export (standalone, beyond the Leads-specific import in 7.3)

**Purpose:** Company Admin-level bulk data operations.
**Access:** Company Admin / permitted roles.
- Job list (Import/Export history): type, initiated by, date, status (Processing/Completed/Failed), result summary, downloadable error/report file.
- New Import wizard: same pattern as Section 7.3's import flow, generalized to other entities if/when needed.
- **States:** in-progress polling indicator, failure detail expandable.

### 7.13 Users (per-tenant, Company Admin view)

**Purpose:** Manage users within one's own company.
**Access:** `users.*`, Company Admin (and Sales Manager if granted).

- **List View:** Name, Email, Role, Status (Active/Invited/Disabled), Last Login. Filters: role, status.
- **Invite/Create:** Name, Email, Role (select from company's available roles), optional team assignment.
- **Edit:** role change, disable/enable, resend invite, reset-password trigger.
- **States:** pending-invite badge, empty (only if somehow zero users — edge case), self-edit restrictions (can't disable own account).

### 7.14 Roles & Permissions (Company-level)

**Purpose:** View/manage role-permission mapping within enabled features (Company Admin generally views a fixed default set unless the platform allows custom roles per company — confirm this with the team before building an editor; if not customizable at company level in V1, this becomes a **read-only** permissions matrix screen).
**Access:** Company Admin.
- Matrix view: roles as columns, permission keys as rows (grouped by module — Leads, Customers, Calls, Reports, Users...), checkboxes if editable, else static checkmarks.
- **States:** read-only banner if company-level role editing isn't in V1 scope ("Role permissions are managed at the platform level").

### 7.15 Company Settings

**Purpose:** Company Admin's own-company configuration (as opposed to Super Admin's Companies module which manages all tenants).
**Access:** Company Admin.
- General (company name, logo, timezone, business hours).
- Pipeline configuration (view stages; edit only if the platform supports company-level custom pipeline in V1 — else read-only, "Contact platform admin to change your pipeline stages").
- Custom Fields configuration for Leads/Customers (if self-service; else read-only reference list).
- Notification preferences (which events trigger notifications for this company).
- **States:** save-success toast, validation errors inline, unsaved-changes guard on navigation away.

### 7.16 Companies / Tenants (Super Admin only)

**Purpose:** Onboard and manage every tenant on the platform.
**Access:** Super Admin only.
- **List View:** Company name, Status (Active/Inactive/Onboarding), Feature package, User count, Created date.
- **Onboarding Wizard (multi-step, mirrors blueprint Section 7):**
  1. Company details (name, industry type, timezone).
  2. Feature package selection — checklist of Section 6's Feature Catalogue, grouped by category, with a note next to Communication/Advanced Calling/AI items marking them "optional / future".
  3. Default roles review (auto-generated, editable list of role names being created).
  4. Company Admin account creation (name, email — triggers invite).
  5. Call configuration (phone number assignment, routing strategy default).
  6. Review & Activate.
- **Company Detail View:** all of the above as editable tabs post-creation, plus a "View as Company" read-only drill-in for support/debugging (clearly bannered as a read-only impersonation-style view, never allowing the Super Admin to silently act as the tenant).
- **States:** in-progress onboarding (resumable wizard), deactivate-company confirmation (impact warning: "N users will lose access").

### 7.17 Users, Roles, Permissions, Features, Call Configuration (Super Admin, platform-wide)

**Purpose:** Cross-tenant administration.
**Access:** Super Admin only.
- **Users (platform-wide):** same shape as 7.13 but with a Company column/filter, cross-tenant search.
- **Roles (platform-wide):** define the canonical role templates (Super Admin, Company Admin, Sales Manager, Sales Executive) and their permission sets — this is the actual editable permissions matrix (contrast with 7.14's likely-read-only company view).
- **Permissions:** reference/catalog list of all permission keys, grouped by module, mostly read-only reference unless the platform supports adding custom permissions.
- **Features:** the master Feature Catalogue (Section 6) — enable/disable/define feature packages that Companies (7.16) can select from.
- **Call Configuration:** phone-number-to-tenant mapping, routing strategy options (round-robin, least-busy, skill/priority-based) available for company admins to choose from, provider settings.

### 7.18 Audit Logs (Super Admin primary, Company Admin scoped view if permitted)

**Purpose:** Compliance/traceability feed.
**Access:** Super Admin (all), Company Admin (own company only, if permitted).
- **List View:** Timestamp, Actor, Action, Entity, Tenant (Super Admin view only), Metadata summary. Filters: date range, actor, action type, entity type, tenant (Super Admin only).
- **Detail (expand row):** full before/after metadata diff where available.
- **States:** empty, loading, export (if permitted) for compliance reporting.

### 7.19 Jamin-Specific: Properties / Projects / Plot Inventory

**Purpose:** Real-estate catalogue and inventory management.
**Access:** `properties` feature enabled (Jamin), permission-gated.

- **Projects List:** Name, Location, Status, Total Plots, Available/Hold/Sold counts, Created date.
- **Project Detail:** Overview (location, description, documents/brochures/approvals tab), **Plots sub-view**:
  - Grid/list of plots — Plot No., Size, Price, Status chip (Available/Hold/Sold), Assigned Agent (if held).
  - **Visual plot layout view** (where layout image/data exists) — interactive layout map with plots color-coded by status, click a plot → detail panel.
  - Plot Detail: full specs, price, status history, linked customer if held/sold, documents.
  - Status change action: Available → Hold (assign to customer + agent, optional hold-expiry) → Sold (link to Booking) or back to Available.
- **States:** empty project (no plots yet), layout-image-not-available fallback to list view, permission-denied for status changes.

### 7.20 Jamin-Specific: Site Visits

**Purpose:** Schedule and track prospective-buyer site visits.
**Access:** `site-visits` feature, permission-gated.
- **List View:** Date/Time, Customer, Project/Plot, Assigned Agent, Status (Scheduled/Completed/Rescheduled/Cancelled/No-show).
- **Calendar View (alternate):** month/week calendar of scheduled visits, color-coded by status.
- **Create/Edit:** Customer (select/create), Project + Plot (optional specific plot), Date/Time, Assigned Agent, Notes.
- **Detail:** visit outcome capture (post-visit: interested/not interested/needs follow-up), links to related Follow-up if created, feeds the "Site visit scheduled/rescheduled" notification.
- **States:** empty, past-due unconfirmed visit flagging, reschedule flow (keeps history of prior slot).

### 7.21 Jamin-Specific: Bookings

**Purpose:** Formalize a plot reservation/sale.
**Access:** `bookings` feature, permission-gated.
- **List View:** Customer, Project/Plot, Booking Date, Amount, Status (Pending/Confirmed/Cancelled), Agent.
- **Create/Edit:** Customer, Plot (must be in Hold status), Booking Amount, Payment terms/notes, Documents (booking form, receipt).
- **Detail:** full booking record, linked plot (auto status → Sold on confirm), linked deal (marks Won), documents tab.
- **States:** validation — can't book a plot that's already Sold; cancellation flow reverts plot status.

### 7.22 GHL-Specific: Investors

**Purpose:** Investor/prospect management parallel to Customers but with investment-specific fields.
**Access:** `investors` feature, permission-gated.
- **List View:** Name, Phone, Investment Interest/Amount, Status, Assigned Agent, Source, Referral (if tracked).
- **Detail View:** mirrors Customer 360 shape (Overview, Calls, Follow-ups, Consultations tab instead of generic Deals, Documents, Notes/Timeline) plus investment-specific custom fields (investment amount interest, referral source).
- **Create/Edit:** contact fields + investment-specific custom fields, same dynamic custom-field rendering mechanism as Leads (7.3).

### 7.23 GHL-Specific: Consultations

**Purpose:** Schedule/track advisory consultations, GHL's analogue to Jamin's Site Visits.
**Access:** `consultations` feature, permission-gated.
- **List/Calendar View:** Date/Time, Investor, Consultant/Agent, Status (Scheduled/Completed/Rescheduled/Cancelled/No-show), Outcome summary.
- **Create/Edit:** Investor (select/create), Date/Time, Assigned Consultant, Notes/Agenda.
- **Detail:** outcome capture, links to Investment Opportunity if progressed, feeds notifications.
- **States:** mirror Site Visits (7.20).

### 7.24 GHL-Specific: Investment Opportunities

**Purpose:** GHL's analogue to Jamin's Bookings — the investment-stage pipeline object.
**Access:** `investment-opportunities` feature, permission-gated.
- **List View:** Investor, Opportunity Name/Type, Stage, Amount, Assigned Agent, Created.
- **Detail View:** stage progress, amount, linked investor, documents (KYC/investment-related), notes/timeline.
- **Create/Edit:** Investor (select/create), Opportunity details, Amount, Stage, Assigned Agent.
- **States:** mirror Bookings (7.21) validation pattern (e.g. can't mark Converted without required documents if that's a business rule — confirm with team).

### 7.25 Communication — WhatsApp / SMS / Email / Facebook / Instagram *(Future / Optional — build only after core is stable)*

**Purpose:** Omni-channel messaging alongside calling.
**Access:** feature-flagged per channel per tenant, permission-gated.
- Placeholder pattern for V1: a "Communication" tab on Customer/Investor/Lead detail views that's hidden entirely if no channel feature is enabled, and shows a simple threaded message view + compose box once at least one channel is live.
- Do not scaffold full inboxes/campaign tools until the specific channel and provider are confirmed — flagged as future scope in the blueprint itself.

### 7.26 Advanced / AI — Lead Scoring, Call Summary, Recommendations, Forecasting *(Future — do not build in V1)*

**Purpose:** noted here only so the UI leaves room for it later.
- Design the Lead list/detail and Call History views with an optional "AI Score" chip / "AI Summary" panel slot now (conditionally rendered, currently always hidden) so these can be switched on later without a redesign — but do not build the underlying features yet.

---

## 8. Component Library Checklist

Build these once, reuse everywhere — do not let any module hand-roll its own version:

- `<DataTable>` — sortable, filterable, paginated, bulk-select, empty/loading states, row actions menu
- `<StatusChip>` — status/priority/disposition color-coded label, single shared color-mapping config
- `<FilterBar>` — composable filter chips + date range + search, used identically across Leads/Customers/Calls/Deals/Reports
- `<FormField>` set — text, select, multi-select, date/time, phone (with country code), currency, textarea, rich-text notes, file upload, dynamic custom-field renderer
- `<Kanban>` — drag-and-drop board, used by Pipeline and reusable for Plot layout if it fits
- `<Drawer>` / `<Modal>` — quick-create and quick-edit surfaces
- `<Timeline>` — activity/notes feed, used on Customer 360, Investor detail, Deal detail
- `<DocumentUploader>` / `<DocumentList>` — one implementation, parameterized by allowed categories per context
- `<IncomingCallPopup>` / `<InCallBar>` / `<DispositionModal>` — the calling primitives (Section 7.6)
- `<NotificationBell>` / `<NotificationList>`
- `<RequireFeature>` / `<RequirePermission>` / `<ProtectedRoute>` (Section 6)
- `<EmptyState>` — one component, icon + message + optional CTA, reused across every module instead of bespoke empty copy blocks
- `<ReportChart>` wrapper — consistent chart styling (bar/line/funnel) across all Reports

---

## 9. Frontend Folder Structure (expanded)

```
frontend/src/
  assets/
  components/
    common/            # DataTable, StatusChip, FilterBar, EmptyState, Timeline, etc.
    forms/             # FormField set, dynamic custom-field renderer
    tables/            # table column configs per module
    modals/            # quick-create/edit drawers & modals
    calling/           # IncomingCallPopup, InCallBar, DispositionModal
  layouts/
    AuthLayout/
    AdminLayout/       # Super Admin console
    SalesLayout/       # Company Admin / Manager / Executive
  pages/
    Login/ ForgotPassword/ ResetPassword/
    Dashboard/
    Leads/  Customers/  Pipeline/  Deals/  Followups/
    CallCenter/  CallHistory/
    Reports/  Notifications/
    Users/  Roles/  Permissions/  CompanySettings/
    Companies/  Features/  CallConfiguration/  AuditLogs/   # Super Admin
    Properties/ Projects/ Plots/ SiteVisits/ Bookings/       # Jamin-only
    Investors/ Consultations/ InvestmentOpportunities/       # GHL-only
  services/
    api/               # axios/fetch client, interceptors (401 handling)
    auth/  leads/  customers/  calls/  deals/  reports/ ...  # one per domain, mirrors backend modules
  context/
    AuthContext   (user, tenant, tokens)
    FeatureContext (enabledFeatures)
    PermissionContext (permissions, useCan hook)
    CallContext   (active call state, availability)
  hooks/
  routes/
    routeConfig.ts     # role/feature/permission-gated route table driving ProtectedRoute
  permissions/
    permissionKeys.ts  # constants matching backend permission strings — single source of truth
  constants/
    statusColors.ts  pipelineStages.ts  featureKeys.ts
  utils/
```

Keep page-specific styles co-located with each page/component, per the blueprint's own recommendation — no single monolithic global stylesheet.

---

## 10. State Management & Data Flow

- **Server state** (leads, customers, calls, reports, etc.): fetched/cached via a query library (e.g. React Query/TanStack Query) — gives loading/error states, caching and refetch-on-focus for free, which every module spec above depends on.
- **Client/session state** (auth, feature flags, permissions, active call, sidebar collapsed state): a lightweight global store (Context or a small state library) — should NOT be mixed with server data caching.
- **Real-time concerns** (incoming call popup, notification badge count): abstract behind a single `useRealtime()`-style hook now, even if V1 implements it via polling — so it can be swapped for sockets later without touching every consuming component.
- **Form state:** one form library used consistently (e.g. react-hook-form) across all Create/Edit screens, paired with the dynamic custom-field renderer for tenant-specific fields.

---

## 11. Responsive & Accessibility Notes

- Sidebar collapses to icon-only or a drawer below tablet width; the Call Center's in-call bar becomes a compact floating pill on mobile widths rather than a full bar.
- `<DataTable>` needs a card-list fallback layout below ~640px for Leads/Customers/Deals — do not just horizontally scroll a dense table on mobile.
- Kanban (Pipeline) becomes a single-column, stage-selectable list view on mobile — drag-and-drop is not a mobile-friendly interaction.
- All status chips and disposition tags need sufficient color contrast and should never rely on color alone (pair with icon or label text) for accessibility.
- Every modal/drawer traps focus and is dismissible via Escape; every data table's row actions menu is keyboard-navigable.

---

## 12. Frontend Build Priority (mirrors backend roadmap, Sections 30–31)

1. **Foundation:** Auth screens, AuthLayout/AdminLayout/SalesLayout shells, RequireFeature/RequirePermission/ProtectedRoute primitives, DataTable + FormField + StatusChip + EmptyState component set.
2. **Sales Core:** Dashboard (company-scoped), Leads, Customers, Pipeline/Deals, Follow-ups.
3. **Calling:** Call Center (availability, incoming popup, in-call bar, disposition modal), Call History.
4. **Tenant-Specific:** Jamin — Properties/Projects/Plots/Site Visits/Bookings. GHL — Investors/Consultations/Investment Opportunities.
5. **Management:** Reports, Notifications, Documents (embedded tabs), Import/Export, Audit Logs.
6. **Platform Console:** Super Admin — Companies onboarding wizard, platform Users/Roles/Permissions/Features/Call Configuration, Audit Logs (cross-tenant).
7. **Integrations (later):** Communication channels (7.25).
8. **Intelligence (later):** AI features (7.26) — UI slots only, reserved not built.

This priority order matches the MVP scope recommendation in the source blueprint (Section 31): everything through step 5's core items (minus the tenant-specific modules, which can run in parallel if team capacity allows) constitutes the V1 frontend surface.

---

**End of Frontend Specification.**
