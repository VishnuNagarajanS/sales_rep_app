# Follow-up fixes (second pass)

A review of the last delivery checked every item marked "fixed" against the actual code. Most are correct. The items below are **not fully fixed, fixed differently from what was asked, or introduced a new problem**. Fix only these. Do not touch anything else.

## Working rules
- Surgical edits only. Do not refactor unrelated code.
- Do not touch `TopBar.tsx`, `TopBar.css`, `PersonaSwitcher` or any global stylesheet.
- Role checks use `Role.Code`, never `Role.Name`.
- Never print, log or paste secret values.
- Add a regression test for each item (backend xUnit tests are welcome; if a test needs a real Postgres, say so and write it against a test database or Testcontainers).
- When finished, list every file changed and mark each item below "fixed" or "not fixed" with one line of explanation. Verify by reading the code you changed, not by assuming.

---

## R1 (was H2). The company-timezone helper is not used where the bug was

`ICompanyClock` exists, but the places that decide "is this person on leave today" still use the UTC date:

- `Controllers/GhlAdmin/GhlLeadAssignmentController.cs` lines 44, 94, 163 and 292: `DateOnly.FromDateTime(DateTime.UtcNow)` (agents list, workforce availability, auto-assign, manual assign).
- `Services/Implementations/WorkHandoverService.cs` line 1286.
- `Services/Implementations/AdminUserService.cs` line 29.
- Also audit `Services/BackgroundJobs/LeaveReminderBackgroundService.cs` and `HandoverDueDateCheckerService.cs` for the same pattern.

**Fix:** add a `GetCompanyTodayAsync(companyId)` that returns a `DateOnly` on `ICompanyClock` and use it in every place above. Remove the duplicate private `GetCompanyToday(tenant)` in `LeaveRequestService` in favour of the same helper so there is one definition of "today".

**Test:** at 01:00 IST on the leave start date, manual assign, auto-assign, `GET /api/ghl/agents` and the availability endpoint all treat the user as on leave.

## R2 (was H3). AI tools still return emails and phone numbers, and ignore the row limit

`IncludeContactDetails` and `MaxRowsPerTool` are still never read (the only matches are the property definitions in `AiSettings`). `SearchLeadsTool`, `SearchCustomersTool`, `SearchInvestorsTool` and `SearchUsersTool` always return `Email` and `Phone`, and every tool still uses a hardcoded `Take(25)`. The rate limiter added to the controller does not address this.

**Fix:** inject `AiSettings` (through `IOptionsSnapshot<AiSettings>` from `services`) into each tool. When `IncludeContactDetails` is false, omit `Email` and `Phone` from the result (or mask them). Use `MaxRowsPerTool` instead of the literal 25 in all tools.

**Test:** with `IncludeContactDetails = false`, no JSON returned by any tool contains `Email`, `Phone`, an `@`, or a 10-digit number.

## R3 (was H4). The real prompt-injection hole is still open, and the new check blocks normal questions

What was asked: cap the size of `ClientContext` and `History`, and stop putting browser-supplied text into the **system** prompt. What was delivered: a regex on `request.Message` only.

Problems:
1. `AiAssistantService.cs` line 75 still inserts `{request.ClientContext}` into the system prompt, with no length limit. `History` is also unvalidated, including forged `assistant` turns. The regex does not look at either.
2. The regex `ignore all | system prompt | forget previous | bypass | jailbreak` blocks normal admin questions (for example "which leads bypass KYC", "ignore all junk leads") with the message "Security violation detected" and writes a security alert. It is also trivial to evade ("disregard earlier rules").
3. The new `SecurityAlerts` table and migration were not requested.

**Fix**
- Cap `ClientContext` at 1000 characters and `History` at 4 items of at most 250 characters each; return 400 when exceeded.
- Move `ClientContext` out of the system message. Send it in a separate message wrapped in a clear delimiter that says it is untrusted UI data, not instructions.
- From the client history accept only `user` entries (do not trust client `assistant` entries).
- Delete the regex block and the 400 "Security violation" response. Keep the existing system-prompt rule that tool results and record text are untrusted data.
- Keep `SecurityAlerts` only if you log **real** events (for example oversized payloads, rate-limit hits). Otherwise remove the entity, DbSet and migration `20261007102143_AddSecurityAlertsTable` (not applied anywhere yet).

**Test:** a message containing "bypass KYC" is processed normally; a 5000-character `ClientContext` returns 400; a forged `assistant` history entry is dropped.

## R4 (was M2). `Declined` is still never set

`AiAssistantService.cs` checks `tc.Function.Name == "decline_request"`, but the tool is named `decline_out_of_scope` (`DeclineOutOfScopeTool.Name`). The flag never becomes true and the log is still wrong.

**Fix:** compare against `DeclineOutOfScopeTool`'s name (use a shared constant, not a second literal).

**Test:** a request that triggers the decline tool writes `AiChatLog.Declined = true`.

## R5 (residual part of C2). Lead creation still lets a caller choose the owner and the company

In `LeadService.CreateLeadAsync`:
1. `targetAgentId = dto.AssignedAgentId ?? agentId` (around line 239). This overrides the careful role logic computed a few lines earlier, so a **sales executive can create a lead assigned to any user id**, and an admin can create a lead owned by an admin (the case the earlier fix was meant to prevent).
2. `var companyId = dto.CompanyId ?? _currentUser.CompanyId ?? 1;` lets a company user send another company's id and create data there, and falls back to company 1 silently.

**Fix**
1. Use the already-validated `agentId` for non-admin callers (sales executive and IRM always own what they create). For admins, accept `dto.AssignedAgentId` only if the target is an active `sales_executive` of the same company who is not on leave and not covered; otherwise leave the lead unassigned. Write a `LeadAssignmentHistory` row when an agent is set.
2. Ignore `dto.CompanyId` unless the caller is `super_admin`. For everyone else use `_currentUser.CompanyId`, and return 401 or 400 when it is missing (no `?? 1` fallback). Check other services for the same `?? 1` pattern and report them (do not change webhook intake without confirming).

**Test:** a sales executive posting `assignedAgentId` of another user creates a lead owned by themselves; a company-A user posting `companyId` of company B creates the lead in company A.

## R6 (follow-ups to C1). Configuration is now incomplete and documented nowhere

1. The `Ai` section was removed from both `appsettings.json` and `appsettings.example.json`. After a fresh clone the assistant has an empty base URL, model and key. Add to `appsettings.example.json` an `Ai` section with the **non-secret** defaults (provider base URL, model, timeouts, tool rounds, rows per tool, `IncludeContactDetails: false`, time zone, out-of-scope message) and an empty `ApiKey`.
2. Add a "Local setup" section to `backend/README.md` listing the exact configuration keys to set through User Secrets or environment variables: `ConnectionStrings:DefaultConnection`, `JwtSettings:SecretKey`, `Ai:Primary:ApiKey`, `Ai:Primary:BaseUrl`, `Ai:Primary:Model`, `SmtpSettings:SenderEmail`, `SmtpSettings:Username`, `SmtpSettings:Password` (environment variable form uses double underscores, for example `Ai__Primary__ApiKey`). Include the `dotnet user-secrets init` and `dotnet user-secrets set` commands, and the alternative of a git-ignored `appsettings.Development.json`.
3. `AuthenticationExtensions.cs` now contains the **old leaked JWT secret as a string literal** in the "known default" check. After the secret is rotated, replace that check with a rule that only enforces a minimum length (32 characters) so the old value no longer lives in source.
4. Make sure `backend/appsettings.json` stays untracked and that there is no second tracked copy (check `bin/` and `obj/` copies and the repo root).

## R7. Migration note for `AddPriyaUser` (information plus one change)

Editing a migration that was already applied does **not** change existing databases: any database that already ran it still has an active user `priya@ghlindiaventures.com` with the old known password. Add a **new** migration (or a dev-only seeder) that sets that user's status to inactive and replaces its password hash unless the environment is Development. Do not edit applied migrations again.

---

## Final checklist
1. Backend builds (`dotnet build`) with no warnings you introduced.
2. `npm run build` still exits 0 and the 3-role route smoke test still passes.
3. Tests for R1 to R5 exist and pass.
4. All behaviour listed as working in the previous report is unchanged: approving leave starts no handover, manual and auto assignment skip users on leave or covered, the leave detail drawer works, no page crashes on empty data.
