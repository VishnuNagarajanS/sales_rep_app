# Task: Admin "Work Handover" (temporary coverage) for Sales Executives and IRMs

Stack: ASP.NET Core (EF Core, Postgres) backend in `backend/`, React 19 + TypeScript + Vite frontend in `frontend/`.
Tenant in scope: GHL India Ventures (CompanyId = 1). Roles: `company_admin`, `sales_executive`, `irm`.

**Working rules**
- Make surgical edits. Do not refactor unrelated code.
- Role checks must use `Role.Code` (`"sales_executive"`, `"irm"`, `"company_admin"`), never `Role.Name` (that is the display name, e.g. "Sales Executive").
- Use `ICurrentUserService` for the caller, `apiClient` (not raw `fetch`) on the frontend, and the existing `AuditLog` for audit entries.
- Create one EF migration for the schema changes. Do not seed users or demo data in migrations.
- When finished, list every file you changed or added, with its path.

---

## 1. The business scenario

A sales executive (SE1) is on leave for a week (for example, health reasons). The admin hands **all of SE1's open work** to another sales executive (SE2) so SE2 continues it. The same must work from one IRM to another IRM.

1. SE2 sees SE1's records in their own UI with a clear indicator: **"Handed over from SE1"**.
2. SE2 works on them: calls, follow-ups, status changes, deals moving through stages.
3. When SE1 is back, the admin ends the handover. Every handed-over record **returns to SE1 with its current status**, including all progress SE2 made.
4. SE2's **own** leads and data are never mixed with SE1's, before, during or after the handover.

## 2. What already exists (extend it, do not build a parallel system)

- `backend/Controllers/Irm/IrmReassignmentController.cs` (`api/irm/admin/reassign`, `coverage/active`, `coverage/end`) and entity `IrmCoverageAssignment` already implement an **IRM-only** version.
- A coverage modal lives inside `frontend/src/pages/AssignedLeads/AssignedLeadsPage.tsx`, using raw `fetch`.

Generalise this into one feature that works for both roles. Keep the old three routes working by delegating to the new service, so nothing breaks.

**Gaps in the current implementation that the new version must fix:**

1. It never checks the roles of the from/to users. Any two user ids are accepted. New rule: both users must have the **same role code** (SE to SE, IRM to IRM), same company, target must be `Active`.
2. It moves ownership but does **not** mark the record as handed over. It only appends text to `Notes`. There is no indicator for the covering user, and `Notes` gets polluted. Add real columns (see 3.1) and stop appending to `Notes`.
3. It remembers what to give back in a **JSON blob of ids** captured at handover time. Anything SE2 creates *for SE1's customers* during the week (a new follow-up, a new deal, a consultation) is never returned. Replace the blob with a relational item table (see 3.2) and track records created during coverage.
4. It only touches `Leads`, `Followups`, `InvestorKycs`, `GhlDeals` and `Investors`. The GHL flows also own `Customers`, `GhlInvestors`, `GhlInvestmentOpportunities`, `Consultations` and `IrmPipelineCards`. Cover all records that have an owner column (see 3.3).
5. Return only reverts follow-ups that are still `Pending`, and gives the admin no summary of what happened during coverage.
6. Nothing stops chaining (A to B, then B to C) or two active handovers for the same source user.

## 3. Data model

### 3.1 Single row, never copied
Handover only changes the **owner column of the same row**. Never create a second row or a copy of a lead, customer, investor, deal or follow-up. Each handed-over row carries two new nullable columns:

- `HandoverId int?` : FK to the active handover
- `OriginalOwnerId int?` : the user it must return to

Add these to: `Lead`, `Customer`, `Followup`, `GhlDeal`, `GhlInvestor`, `GhlInvestmentOpportunity`, `Consultation`, `Investor`, `InvestorKyc`, `IrmPipelineCard`. Both columns are `NULL` for normal records and cleared again on return.

### 3.2 Tables
Extend `IrmCoverageAssignment` into the general handover header (rename in code to `WorkHandover`, keep the table or migrate the rows):
`Id, CompanyId, RoleCode ('sales_executive' | 'irm'), OriginalUserId, CoveringUserId, StartedById, Reason, StartedAt, PlannedEndAt (nullable), Status ('active' | 'ended'), EndedAt, EndedById, ReturnSummaryJson`.

New table `WorkHandoverItem`:
`Id, HandoverId, EntityType, EntityId, Origin ('included_at_start' | 'created_during_coverage'), ReturnedAt (nullable), ReturnOutcome ('returned' | 'skipped_reassigned' | null)`.

Drop the `ReassignedRecordIdsJson` blob after migrating any active rows into `WorkHandoverItem`.

### 3.3 What moves and what stays

| Moves to the covering user (open work) | Stays with who actually did it (history, never moved) |
|---|---|
| Leads not in `Converted`, `Not Interested`, `Junk` | `CallRecord`, `InvestorCall` (keep the real `AgentId` / `IrmId`) |
| Customers | Completed follow-ups |
| Pending follow-ups | Completed consultations |
| Open `GhlDeal` (stage not won, lost or converted) | Closed deals |
| `GhlInvestor`, open `GhlInvestmentOpportunity` | Audit log rows |
| Scheduled consultations (`ConsultantId`) | |
| Open KYC, `IrmPipelineCard`, `Investor.AssignedIrmId` (IRM side) | |

Because call records keep the real agent id, SE1 can later see "SE2 called this customer on <date>" without any mixing.

### 3.4 Records created during coverage
If the covering user creates something **against a handed-over parent** (a follow-up on a handed-over lead, a deal from a handed-over customer, a consultation for a handed-over investor), tag it with the same `HandoverId` and `OriginalOwnerId` and insert a `WorkHandoverItem` with `Origin = 'created_during_coverage'`, so it is returned too. Records the covering user creates on their own leads or customers are **never** tagged.

## 4. Backend API (`WorkHandoverController`, route `api/ghl/handover`, `[Authorize(Roles = "company_admin,super_admin")]`)

- `GET candidates?role=sales_executive|irm`: active users of that role in the caller's company, with counts of open items and whether they are currently covered or covering.
- `POST preview` `{ fromUserId, toUserId }`: counts per entity type that would move, no changes made.
- `POST start` `{ fromUserId, toUserId, reason, plannedEndAt? }`: validates, then in **one transaction** moves all open records, sets `HandoverId` and `OriginalOwnerId`, inserts `WorkHandoverItem` rows, writes an audit log entry and notifies the covering user ("N items handed over from <name>"). Returns the counts per entity type.
- `GET active`, `GET history`, `GET {id}`: header, items, and a live **progress summary**.
- `POST {id}/end`: return everything (see section 5).
- `POST {id}/return-items` `{ itemIds[] }`: return only selected items early.

**Validation rules**
- From and to must be different users, same company, same role code, target `Active`.
- A source user may have only **one** active handover.
- A user who is currently *covered* (on leave) cannot be the target of a new handover.
- A user who is currently *covering* someone cannot be handed over to a third user. Block with a clear message ("End the existing handover first").
- Use a transaction and a concurrency check so two admins cannot hand over the same user at once.

**Notifications:** when `PlannedEndAt` passes, notify the admin ("SE1's handover is due to end"). **Never auto-revert**; the admin decides when the person is really back.

## 5. Return flow (end handover)

For every `WorkHandoverItem` with `ReturnedAt IS NULL`:
- If the record's owner is still the covering user, set the owner back to `OriginalOwnerId`, clear `HandoverId` and `OriginalOwnerId`, and leave **every other field exactly as it is now** (status, stage, notes, dates).
- If the admin has reassigned that record to someone else in the meantime, skip it and mark `ReturnOutcome = 'skipped_reassigned'`.
- Records the covering user closed during coverage (converted lead, won deal, completed follow-up) also return to the original owner, with their closed state kept.

Then build `ReturnSummaryJson` for the handover: calls made by the covering user on these records, follow-ups completed, status or stage changes, new records created, records converted or closed, records skipped. Save it, show it to the admin in the end dialog, and send SE1 a notification with the same summary.

## 6. Frontend

1. **Admin page "Work Handover"** (sidebar, Administration section, admin only). Move the existing IRM coverage modal out of `AssignedLeadsPage.tsx` and into this page. The Assigned Leads page keeps only the assignment table.
   - *Start handover:* role selector, From user, To user (only same-role active users), reason, optional planned end date, a **preview** of the counts, then Confirm.
   - *Active handovers table:* from to to, since, planned end, items handed over, progress (calls made, follow-ups done, status changes, new records), buttons **End and return all** and **Return selected**.
   - *History tab* with the saved return summaries.
2. **Covering user's pages** (Leads, Customers, Follow-ups, Deals, and the IRM equivalents): add a filter **"Mine | Handed over from <name>"**, plus a badge column or chip **"Handed over from <name> (until <date>)"** on every tagged row. The API returns `handoverId`, `handedOverFromName`, `handoverPlannedEnd` on the DTOs. Never merge the two sets into one unlabelled list.
3. **Original user (SE1) while covered:** the handed-over records are not in their working lists. Show a banner "Your work is being covered by <SE2> since <date>". Read-only, no editing of covered records.
4. **After return:** SE1's records come back normal. Show a one-time **"Updated while you were away"** panel with the return summary and mark the changed records with a small "updated by <SE2>" tag (taken from activity and call history, not from new copies).
5. Use `apiClient` everywhere. Real API mode must not depend on `localStorage` for these lists (poll every 15 seconds like the Leads pages, and refetch on window focus).

## 7. Optional, phase 2 (do only after everything above works)
Route **inbound** calls and website-webhook follow-ups for SE1's known contacts to the covering user while the handover is active.

## 8. Acceptance tests (all must pass)

1. SE1 owns 5 open leads, 3 pending follow-ups, 2 customers. Admin starts a handover to SE2 → counts in the preview match, and after start those rows have `AssignedAgentId = SE2`, `HandoverId` set, `OriginalOwnerId = SE1`. Total row count per table is **unchanged** (no copies).
2. SE2 logs in on another browser → sees SE1's records under "Handed over from SE1" with the badge, and SE2's own leads under "Mine". The two lists never mix.
3. SE2 makes a call, completes a follow-up, moves one lead to `Interested` and creates a new follow-up on a handed-over lead → the new follow-up is tagged with the same `HandoverId`.
4. SE1 logs in during the handover → sees the "covered by SE2" banner and no handed-over records in working lists.
5. Admin ends the handover → all records (including the new follow-up) are back under SE1 with SE2's status changes intact; `HandoverId` and `OriginalOwnerId` are `NULL`; SE2's own leads are untouched; completed calls still show SE2 as the caller.
6. If the admin reassigns one handed-over lead to SE3 mid-handover, then ends the handover → that lead stays with SE3, its item is `skipped_reassigned`, and it appears in the summary.
7. A to B handover active, then admin tries B to C → rejected with a clear message. Starting a second handover with the same source → rejected.
8. SE to IRM handover attempt → rejected (role mismatch). IRM to IRM works with Investors, KYCs and pipeline cards.
9. `PlannedEndAt` passes → admin gets a notification, nothing reverts by itself.
10. The old routes `api/irm/admin/reassign`, `coverage/active`, `coverage/end` still work and now go through the same service.
11. Refresh any page at any point → state is identical (nothing depends on `localStorage` or `sessionStorage`).
