# Task: Make lead assignment fully database-driven (single `Leads` table, real-time per-agent view)

Stack: ASP.NET Core (EF Core, Postgres) backend in `backend/`, React 19 + TypeScript + Vite frontend in `frontend/`.
Tenant in scope: GHL India Ventures (CompanyId = 1). Roles involved: `company_admin`, `sales_executive`.

**Working rules:** make surgical edits only. Do not refactor unrelated code. When you finish, list every file you changed or added, with its path.

---

## 1. Business flow (what must happen)

1. A new lead enters the system (admin creates it, CSV import, or website webhook). It is **unassigned** and appears in the admin's **Leads** module.
2. The admin assigns leads to a specific sales agent, either **Manual** (select leads, pick an agent) or **Auto** (round-robin across active sales agents).
3. After assignment the lead **disappears from the admin's Leads module** and appears in the admin's **Assigned Leads** module. The **Assigned Agent** column shows the agent the admin chose (never the admin's own name).
4. The chosen agent sees that lead in **their own** Leads page, on their own device or browser, without any manual action, within about 15 seconds of the assignment. Other agents never see it.
5. If the admin later reassigns the lead from agent A to agent B, it moves from A's Leads page to B's Leads page.

## 2. Non-negotiable data rule

There is **exactly one row per lead** in the `Leads` table. Assigning or reassigning **only updates the agent columns of that same row**. Never insert a second row, never copy a lead into another table, never keep a "before" and "after" row. Every role's view is a filtered query over that one table:

| Viewer | Query filter |
|---|---|
| Admin, Leads module | `AssignedAgentId IS NULL` (unassigned pool) |
| Admin, Assigned Leads module | `AssignedAgentId IS NOT NULL` |
| Sales agent, Leads page | `AssignedAgentId = <my user id>` |

## 3. Problems found in the current code (fix these)

1. **Frontend reads leads only from `localStorage`.** `LeadsPage.tsx` and `AssignedLeadsPage.tsx` call `storageService.getLeads()`, which is per-browser. The API is written to but never read from. So the agent logging in on another machine sees nothing. The database must be the source of truth.
2. **"Unassigned" is faked as "owned by the admin".** `LeadService.CreateLeadAsync` sets `AssignedAgentId = _currentUser.UserId`, so every new lead belongs to the admin. The frontend then guesses "assigned" by excluding admin ids. Replace this with a real `NULL` = unassigned.
3. **Website webhook bypasses the admin.** `WebhooksController.SubmitLead` auto-assigns to the first sales executive (fallback: user id 2). Website leads must land **unassigned**.
4. **Any role can change `AssignedAgentId`.** `UpdateLeadDto.AssignedAgentId` is applied in `UpdateLeadAsync` with no role check. Only `company_admin` / `super_admin` may change assignment.
5. **No assignment metadata.** `Lead` has no `AssignedAt`, so the Assigned Date column falls back to `CreatedAt`. There is no history of who assigned what.
6. **Local-only assignment state.** `sessionStorage['ghl_mock_agent_assignments']`, `window.__ghlAssignments` and the `assignedLeadIds` Set in `LeadsPage.tsx` must be removed (keep them only behind `isMockMode()` if mock mode still needs them).

## 4. Backend changes

### 4.1 Entity and migration
On `Lead`:
- `int? AssignedAgentId` (already nullable, keep it; **NULL means unassigned**)
- add `DateTime? AssignedAt`
- add `int? AssignedById` (FK to `Users`, the admin who assigned)
- add a concurrency token (`uint xmin` for Postgres, or a `RowVersion`)
- add an index on `(CompanyId, AssignedAgentId)`

New table `LeadAssignmentHistory`: `Id, LeadId, FromAgentId (nullable), ToAgentId, AssignedById, Method ('manual' | 'auto'), AssignedAt`. This is an audit log only. It is not a second copy of the lead.

Create an EF migration. In the migration's data step, **backfill**: for every existing lead whose `AssignedAgentId` belongs to a user with role `company_admin` or `super_admin`, set `AssignedAgentId = NULL`. Leads owned by real `sales_executive` users stay as they are, and get `AssignedAt = COALESCE(UpdatedAt, CreatedAt)`.

### 4.2 Endpoints (new controller `GhlLeadAssignmentController`, `[Authorize(Roles = "company_admin,super_admin")]`)

- `GET /api/ghl/agents`: active users of the caller's company with role `sales_executive`, returns `[{ id, name, email }]`. Never include admins or IRMs.
- `POST /api/ghl/leads/assign` with body `{ leadIds: int[], agentId: int }`
  - Validate: agent exists, same company, role `sales_executive`, active. Leads exist and belong to the caller's company.
  - In **one transaction**: set `AssignedAgentId`, `AssignedAt = UtcNow`, `AssignedById = caller`, write a history row per lead.
  - Return `{ assigned: n, skipped: [{leadId, reason}] }`.
- `POST /api/ghl/leads/auto-assign` with body `{ leadIds?: int[] }`
  - If `leadIds` is omitted, use all currently unassigned leads in the company.
  - Round-robin across active sales agents. Persist a rotation pointer per company so the next batch continues from where the last stopped, instead of always starting at agent #1.
  - Same transaction and history rules as above, `Method = 'auto'`.
- `POST /api/ghl/leads/reassign` with body `{ leadIds: int[], agentId: int }`: same as assign but the leads are already assigned. On reassign, **move the lead's pending followups to the new agent** and leave completed calls and history with the original agent.

### 4.3 Concurrency
Two admins must not assign the same lead twice. For `assign` and `auto-assign`, only update rows where `AssignedAgentId IS NULL` (put it in the `WHERE`, or rely on the concurrency token). Already-assigned leads go into `skipped` with reason `"already assigned"`.

### 4.4 Existing endpoints
- `GET /api/sales-executive/leads`
  - `sales_executive` → only `AssignedAgentId == currentUserId` (already the case, keep it).
  - `company_admin` → add optional query param `assignment=unassigned|assigned|all` (default `all`). Return `assignedAgentId`, `assignedAgentName`, `assignedAt` in `LeadResponseDto`.
- `CreateLeadAsync`: if the caller is `company_admin` / `super_admin` → `AssignedAgentId = NULL`. If the caller is `sales_executive` → assigned to themselves (`AssignedAt = UtcNow`).
- `UpdateLeadAsync`: ignore `dto.AssignedAgentId` unless the caller is admin, and even for admin prefer the dedicated assign/reassign endpoints. A sales agent must never be able to move a lead to someone else.
- `WebhooksController.SubmitLead`: `AssignedAgentId = NULL`. Remove the "first sales executive / user id 2" logic.
- Add an audit log entry for every assign / reassign / auto-assign.

## 5. Frontend changes

1. **Stop using `localStorage` as the lead source.** In real API mode (`!isMockMode()`), `LeadsPage`, `AssignedLeadsPage` and the sales-agent Leads page must load via `GET /api/sales-executive/leads` (paged, `pageSize=200` is fine). Keep the `storageService` path only when `isMockMode()` is true.
2. **Admin Leads page** requests `assignment=unassigned`. **Admin Assigned Leads page** requests `assignment=assigned`. Do **not** filter client-side by "is this the admin's id".
3. **Assign actions call the API, then refetch.** Manual confirm → `POST /api/ghl/leads/assign`. Auto → `POST /api/ghl/leads/auto-assign` (show the preview distribution first, then send the confirmed distribution as one `assign` call per agent). Reassign in the Assigned Leads edit drawer → `POST /api/ghl/leads/reassign`. After a successful response, refetch the list. Do not mutate local state to fake the change. Show the `skipped` reasons if any.
4. **Agent picker** uses `GET /api/ghl/agents` (replace the `/AdminUsers` call in `frontend/src/services/agentDirectory.ts`). Remove the `MOCK_AGENTS` fallback in real API mode. If the list is empty, show "No sales agents found, create a Sales Executive user first".
5. **Real-time (phase 1, polling):** on the three lead pages, refetch every **15 seconds** while `document.visibilityState === 'visible'`, and also on `window` `focus`. Clear the interval on unmount. No page reload should be needed for the agent to see a newly assigned lead.
6. **IDs:** use the plain numeric DB id (as a string) everywhere in API mode. Drop the `db-` prefix convention in real mode.
7. Remove the `sessionStorage['ghl_mock_agent_assignments']`, `window.__ghlAssignments` and `assignedLeadIds` hacks (or gate them behind `isMockMode()`).
8. "Assigned Date" column uses `assignedAt`, not `createdAt`.

## 6. Optional phase 2: true push instead of polling
Add a SignalR `LeadsHub`. On assign, reassign and auto-assign, send `LeadAssigned` to group `agent-{agentId}` and `LeadUnassigned` to the previous agent's group, plus `LeadsChanged` to group `company-{id}-admins`. The frontend then refetches on those events. Implement this only after phase 1 works.

## 7. Acceptance tests (all must pass)

1. Admin creates lead "Alpha" → DB row has `AssignedAgentId = NULL`. It shows in Admin → Leads, not in Assigned Leads.
2. Admin assigns Alpha to Naveen (manual) → **same row**, `AssignedAgentId = Naveen`, `AssignedAt` set, one history row. `SELECT count(*) FROM "Leads" WHERE "Phone" = '<alpha phone>'` is still **1**.
3. Alpha is gone from Admin → Leads and present in Admin → Assigned Leads with Assigned Agent = **Naveen**.
4. Naveen, logged in on a **different browser with empty localStorage**, sees Alpha in his Leads page within 15 seconds without reloading. Priya (another agent) does not see Alpha.
5. Admin reassigns Alpha to Priya → Alpha leaves Naveen's page and appears in Priya's; still one row; two history rows; pending followups now belong to Priya.
6. Auto-assign 6 unassigned leads across 3 agents → 2 each; the next auto-assign continues the rotation.
7. Two admins assigning the same lead at the same moment → one succeeds, the other gets `skipped: already assigned`.
8. A sales_executive calling `PUT /api/sales-executive/leads/{id}` with a different `assignedAgentId` → the field is ignored (or 403); the lead does not move.
9. A website webhook lead arrives → `AssignedAgentId = NULL`, visible in Admin → Leads.
10. Refresh the admin page at any point → state is identical (nothing depended on localStorage / sessionStorage).
