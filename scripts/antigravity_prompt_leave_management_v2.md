# Task: Leave Management v2, with Leave and Work Handover as two separate features

Stack: ASP.NET Core (EF Core, Postgres) in `backend/`, React 19 + TypeScript + Vite in `frontend/`.
Tenant in scope: GHL India Ventures (CompanyId = 1). Roles: `company_admin` (reviews leave and arranges handover), `sales_executive` and `irm` (request leave).

> **This prompt replaces any earlier "Leave Management" prompt.** If parts of an earlier version were already built and conflict with this one (an approve action that starts a handover, a covering-user picker in the approve modal, a scheduler that starts handovers), **remove or revert those parts** as described in section 2.

## 0. Working rules (read first)

- Surgical edits. Do not refactor unrelated code. **Do not touch `TopBar.tsx`, `TopBar.css`, `PersonaSwitcher` or any global stylesheet.**
- **CSS scoping is mandatory.** Every rule in `LeaveRequestsPage.css` and `WorkHandoverPage.css` must be nested under that page's root class (`.leave-requests-container`, `.work-handover-page`). Never define generic global classes (`.btn`, `.btn-*`, `.icon-btn`, `.modal-*`, `.form-*`, `.page-*`, `.card`, `.stat-*`). A previous version leaked `.btn` rules and broke the top bar. Reuse the app's global classes (`btn btn-primary`, `btn btn-secondary`, `btn btn-ghost btn-icon`, `card`) and design tokens (`var(--bg-surface)`, `var(--border-base)`, `var(--text-primary)`).
- Role checks use `Role.Code` (`"company_admin"`, `"sales_executive"`, `"irm"`), never `Role.Name`.
- Use `apiClient` (never raw `fetch`), `ICurrentUserService`, and the existing `Notification` and `AuditLog` entities.
- In real API mode nothing may depend on `localStorage` / `sessionStorage`. The database is the source of truth.
- Use the app's toasts. No `window.alert()` or `window.confirm()`.
- One EF migration. Do not seed users or demo data in migrations.
- Deliver **Phase 1 completely and tested** before starting Phase 2. When finished, list every file you changed or added.

## 1. Product intent (this is the rule everything else follows)

There are **two independent features**:

1. **Leave Requests** exist so the admin **knows who is on leave** and can check workforce availability. An employee submits a request; the admin gets notified; the admin **approves or rejects**. Approving or rejecting **only changes the leave status**. It has **no side effects on anyone's work data**.
2. **Work Handover** is a **manual admin action** on its own page. The admin chooses who is handing over, **chooses the covering person**, and starts the handover. It must work with or without a leave request (for example a sudden emergency with no request filed).

The two features are connected **only by information and shortcuts** (badges, reminders, a prefilled form). Nothing in Leave ever starts, schedules, changes or ends a handover automatically.

## 2. What exists today and must change

Currently approving a leave **automatically starts a handover** and forces the admin to pick a covering agent inside the approve modal. This duplicates the Work Handover page and is not the intended behaviour. Change it:

- `LeaveRequestService.ApproveLeaveRequestAsync`: **remove the call to `StartHandoverAsync`.** Approve now only sets status, decision fields and writes the timeline event and notifications.
- `ApproveLeaveRequestDto`: remove `CoveringUserId`. New body is `{ note? }`. If an old client still sends `coveringUserId`, ignore it.
- `LeaveRequestsPage.tsx`: remove the "Assign Covering Agent" dropdown from the approve modal. The approve modal becomes a simple confirmation with an optional note.
- **Do not build** any scheduler that starts handovers on the leave start date. If one exists, delete it.
- **Do not auto-end** a handover when a leave is cancelled or finishes (see section 4.6).
- Already-approved leaves that have a `WorkHandoverId` from the old behaviour stay as they are and show as "Covered".

### Other bugs and gaps to fix in the same pass
1. `UserRole` in `GetLeaveRequestsAsync` is always empty because `User.Role` is not included. Use `.ThenInclude(u => u.Role)` and return the role name.
2. No overlap check: a user can file overlapping leaves.
3. Dates are `DateTime` compared against `DateTime.UtcNow.Date`, which causes off-by-one-day errors for IST users. Store leave dates as date-only (Postgres `date` / `DateOnly`) and compare against the company's local date.
4. Reject has no reason, and rejecting writes into `ApprovedById`. Add `DecidedById`, `DecisionAt`, `DecisionNote`.
5. No leave types, half-day, balances, cancel or edit, or history of who did what.
6. No notifications.
7. Nothing tells the admin that an approved leave still has no handover arranged.
8. Lead **auto-assign** and the agent picker do not know who is on leave.

## 3. Data model

On `LeaveRequest` add: `LeaveType` (`Casual | Sick | Earned | Unpaid | Other`), `IsHalfDay bool`, `HalfDaySession ('first' | 'second' | null)`, `Days decimal(4,1)` (computed server-side, working days only), `DecidedById int?`, `DecisionAt DateTime?`, `DecisionNote string?`, `CancelledAt DateTime?`, `CancelledById int?`, `HandoverDecision` (`pending | arranged | not_needed`, default `pending`), `HandoverDecisionNote string?`.
`Status`: `Pending | Approved | Rejected | Cancelled`.
Convert `StartDate` and `EndDate` to date-only and migrate existing rows.

On `WorkHandover` add a nullable `LeaveRequestId` (FK). It is set only when the admin starts the handover through the "Arrange handover" shortcut. Handovers started from the Work Handover page directly have it `NULL`.

New table `LeavePolicy`: `CompanyId, LeaveType, AnnualQuotaDays`. If a company has no rows, fall back to code defaults (Casual 12, Sick 8, Earned 15, Unpaid unlimited). Do not seed rows.

New table `LeaveRequestEvent` (timeline): `Id, LeaveRequestId, Action ('submitted'|'approved'|'rejected'|'cancelled'|'edited'|'handover_linked'|'handover_not_needed'), ActorId, Note, At`.

Working days: Monday to Friday by default (company setting `WorkingDays`). Company holidays are Phase 2.
Leave balance is **computed**: `quota - sum(Days of Approved leaves in the calendar year, per type)`. Pending leaves show as "pending", not deducted. Balance is **informational**: exceeding it shows a warning and does not block the request.

### Derived handover state (shown on every approved leave)
Computed, not stored (except `HandoverDecision`). For an Approved leave of user U:
- `covered`: a `WorkHandover` with `OriginalUserId = U` and `Status = 'active'` exists that is linked by `LeaveRequestId` **or** whose period overlaps the leave dates. Return the covering user's name and the handover id.
- `returned`: a linked or overlapping handover exists with `Status = 'ended'`.
- `not_needed`: `HandoverDecision = 'not_needed'`.
- `not_arranged`: none of the above. This is the state that triggers reminders and the "needs handover" widgets.

## 4. Backend API

### 4.1 Leave (`api/LeaveRequests`, keep existing routes working)
- `POST my-requests` (`sales_executive,irm`): `{ leaveType, startDate, endDate, isHalfDay, halfDaySession?, reason }`. Validate: start not before today (company local date), end ≥ start, half-day only on a single day, reason ≤ 500 chars, reason **required** when `Days > 3` or type `Other`. Reject if it **overlaps** the user's own Pending or Approved leave. Compute `Days`, write an event, notify all company admins.
- `GET my-requests` (status filter) and `GET my-balance` returning per type `{ quota, used, pending, remaining }`.
- `POST my-requests/{id}/cancel`: owner may cancel when `Pending`, or `Approved` and not yet ended. **Cancelling never touches a handover** (see 4.6).
- `PUT my-requests/{id}`: edit dates or reason only while `Pending`.
- `GET` (admin): filters `status, type, userId, from, to, search, handoverState`, paging. Each row returns `UserRole`, `Days`, `LeaveType`, `DecisionNote`, `HandoverState`, `CoveringUserName`, `WorkHandoverId`.
- `GET {id}`: detail with the `LeaveRequestEvent` timeline and the requester's balance.
- `GET {id}/conflicts` (admin): teammates of the same role with Pending or Approved leave overlapping these dates, and whether more than 30 % of that role would be away. Warning only.
- `POST {id}/approve` `{ note? }`: status only. Re-validate that it is still `Pending` and has no overlap. **No work moves.**
- `POST {id}/reject` `{ reason }`: reason mandatory.
- `POST {id}/handover-not-needed` `{ note? }` (admin): sets `HandoverDecision = 'not_needed'` so reminders stop (for example a one-day leave).
- Every state change writes an `AuditLog` row and a `LeaveRequestEvent`.

### 4.2 Workforce availability (read-only helper)
- `GET api/ghl/workforce/availability?date=`: for each active `sales_executive` and `irm`: `{ userId, name, roleCode, onLeave, leaveUntil, leaveRequestId, isCovered, coveredBy }`. `onLeave` is true when an Approved leave covers that date. `isCovered` is true when the user is the original user of an active handover.
- Add `onLeave`, `leaveUntil`, `isCovered` and `coveredBy` to `GET /api/ghl/agents` and the Users list.

### 4.3 Work Handover helper (extend `WorkHandoverController`, route `api/ghl/handover`)
- `GET cover-suggestions?fromUserId=&from=&to=`: **a helper for the admin, never an automatic choice.** Same-role, `Active` users, excluding the from-user, anyone on approved leave overlapping the period, and anyone currently covered. Return `[{ userId, name, openItemCount, currentlyCovering: bool }]` sorted by lowest `openItemCount`, with the first row flagged `recommended`. The admin still selects manually.
- `POST start` accepts an optional `leaveRequestId`. When present, validate it belongs to the same company and the same from-user, store it on the handover and write a `handover_linked` event on the leave. All existing handover rules stay as they are (same role, one active handover per source, no chaining, and so on).

### 4.4 Lead assignment rule (separate from handover)
A user is **unavailable for new lead assignment** when they are on approved leave today **or** are the original user of an active handover. Apply this to:
- **Auto-assign** and the AI-suggestion distribution: skip unavailable users.
- **Manual agent picker**: unavailable users are not selectable. Show them disabled with a label ("On leave until <date>" or "Work covered by <name>") so the admin understands why. The covering agent stays selectable.
- The backend `assign` and `reassign` endpoints must also reject an unavailable target, not only the UI.

### 4.5 Notifications (existing `Notification` entity, shown in the bell)
- Submitted → all admins.
- Approved / Rejected (with reason) / Cancelled → the requester. Cancelled → also admins.
- **Reminders to admins only. They never perform any action**, run by a `BackgroundService` every 15 minutes and on startup, each sent at most once per leave:
  1. An Approved leave starting within 1 day with state `not_arranged` → "SE1's leave starts tomorrow and no handover is arranged".
  2. A leave ending today or tomorrow with a linked or overlapping **active** handover → "SE1 returns on <date>. Handover is still active. End it from Work Handover."
  3. A Pending request older than 48 hours → "waiting for your decision" (once per day).

### 4.6 Cancel and edit behaviour
Cancelling an Approved leave does **not** start, end or change any handover. If a linked or overlapping active handover exists, notify the admins ("SE1 cancelled their leave but a handover is still active. Review it.") and show a banner in the leave drawer with a button that opens Work Handover. The admin decides.

## 5. Frontend

### 5.1 Leave Requests page
Use the **full content width** (the current page uses about 640 px in the middle). The header must not be clipped by the platform announcement banner. Fully responsive down to mobile.

**Employee view ("My Requests"):** balance cards per leave type (used / quota, "N pending"), an upcoming-leave strip, a history table with status chips, **Cancel** for eligible rows, and a detail drawer with the timeline.

**Admin view ("Team Requests"):**
- Four KPI cards across on desktop: **Pending approval**, **Approved this month**, **On leave today**, **Needs handover** (approved leaves active or starting within 3 days with state `not_arranged`). Cards are clickable and apply the matching filter.
- Filters: status pills, type, role, handover state, search by name, date range. Pagination, sortable columns.
- Columns: Employee (avatar, name, role), Type badge, Dates with **Days** and half-day tag, Reason (truncated with tooltip), Status chip, **Handover chip**, Applied on, Actions. Pending rows older than 48 h show an amber "Waiting 3 days" tag.
- **Handover chip** on approved rows: amber "Handover not arranged", green "Covered by <name>", grey "Returned", neutral "No handover needed".
- **Approve:** a simple confirm dialog with an optional note and the conflict warnings. No covering-user field.
- **Reject:** a modal with a mandatory reason.
- **Detail drawer** (right side): requester, balance after approval, dates, reason, timeline, conflict warnings, and a **Handover section**:
  - `not_arranged`: two buttons, **Arrange handover →** and **No handover needed**.
  - `covered`: "Covered by <name> since <date>" with a link to that handover.
  - `returned`: "Returned on <date>" with a link.
  - Cancelled leave with an active handover: the banner from 4.6.
- **Arrange handover →** navigates to Work Handover using the app's existing `onNavigate(route, params)` mechanism (see how `customers` receives `selectId`) with `{ fromUserId, plannedEndAt: endDate + 1 day, reason: "Leave <start> to <end>", leaveRequestId }`. The Work Handover page reads these params and prefills the start form. The **covering user stays empty** and the admin must choose it.
- An **"On leave today / upcoming"** strip with avatars and return dates, so the admin sees workforce availability at a glance.

**Request Leave modal:** leave type, a single date-range input that shows the working-days count live, half-day toggle (first or second half), reason, a live **balance check** ("You have 7 Casual days left; this uses 3"), overlap error inline, submit disabled until valid. Inputs and textareas use `font-family: inherit` (currently they render monospace). The close button is `btn btn-ghost btn-icon`, not a white box.

**States:** skeleton loaders, designed empty states per tab, inline error banners with Retry, toasts. Poll every 30 seconds while the tab is visible and refetch on window focus. Accessibility: focus trap in modals and drawers, `Esc` to close, labelled inputs, status shown in text as well as colour.

### 5.2 Work Handover page changes
- Read the prefill params from 5.1. When opened from a leave, show a small banner "Arranging handover for <name>'s leave (<dates>)".
- When a **From user** is chosen, load `cover-suggestions` and show the **Covering user** dropdown with each person's open-item count and a "Recommended" tag on the first row. Disabled rows show the reason. Nothing is auto-selected.
- Keep the existing preview of counts and everything else on the page. The page must still work with no leave involved.

## 6. Phase 2 (only after Phase 1 passes every test)
1. Team calendar view (List | Calendar toggle): month grid with leave bars coloured by type, filter by role, click a bar to open the drawer.
2. Attachments for Sick leave (medical certificate) with size and type limits.
3. Company holidays and weekend configuration in Company Settings.
4. Admin-editable `LeavePolicy` quotas and carry-forward.
5. Leave utilisation report and CSV export.
6. Email notifications through the existing `IEmailService`.

## 7. Acceptance tests (Phase 1, all must pass)

1. SE1 owns open leads and follow-ups. SE1 requests Casual leave Mon to Wed → `Days = 3`, status `Pending`, admins notified, timeline shows "submitted".
2. Admin approves the request → status `Approved`, `HandoverState = not_arranged`. **No lead, follow-up, deal or customer row changed owner. No `WorkHandover` row was created.** (Compare the table row counts and owner columns before and after.)
3. The approve modal has **no covering-user field**, and `POST approve` ignores a `coveringUserId` if sent.
4. In the leave drawer, **Arrange handover →** opens Work Handover with From = SE1, planned end = leave end + 1 day, the banner visible and the covering user **empty**.
5. Choosing From = SE1 shows suggestions: only same-role active users, sorted by fewest open items, the first marked Recommended, anyone on overlapping approved leave disabled with the reason. The admin picks SE2 and confirms → handover starts, `WorkHandover.LeaveRequestId` is set, the leave chip becomes green "Covered by SE2".
6. A handover started from Work Handover **without** any leave still works, and a handover for someone with no leave request is possible.
7. Admin marks a one-day leave "No handover needed" → chip is neutral and no reminder is sent.
8. Reminder job: an approved leave starting tomorrow with `not_arranged` → admins get exactly one notification. A leave ending tomorrow with an active handover → admins get one notification. **Neither job changes any data.**
9. SE1 cancels an approved leave while the handover is active → the handover stays active, admins are notified, the drawer shows the banner with a button to Work Handover.
10. Reject without a reason is blocked. Reject with a reason → the requester sees it in the drawer and gets a notification.
11. Overlapping requests from the same user are rejected. A request starting yesterday is rejected. A 5-day request without a reason is rejected. Dates do not shift by a day for an IST user.
12. While SE1 is on approved leave (even with **no** handover), lead auto-assign never assigns to SE1, the manual picker shows SE1 disabled as "On leave until <date>", and a direct API call that assigns a lead to SE1 is rejected. The covering agent SE2 remains selectable.
13. The admin list shows the correct role text on every row. Balance cards show `used 3 / quota 12` after 3 approved Casual days, and a pending 2-day request appears as "2 pending", not deducted.
14. Two admins approve the same request at the same moment → one succeeds, the other gets "already processed".
15. Refresh at any point → identical state. The top bar (theme toggle, bell, Role chip, pill buttons) looks exactly the same on this page and every other page.
