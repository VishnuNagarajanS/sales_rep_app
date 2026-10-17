# Follow-up fixes (third pass)

A review of the last delivery checked every item marked "fixed" against the actual code. Frontend (`npm run build`, `vitest`) is green. The items below are **claimed fixed but are not**, or were fixed in a way that creates a new problem. Fix only these. Do not touch anything else.

## Working rules
- Surgical edits only. Do not refactor unrelated code.
- Do not touch `TopBar.tsx`, `TopBar.css`, `PersonaSwitcher` or any global stylesheet.
- Role checks use `Role.Code`, never `Role.Name`.
- Never print, log or paste secret values.
- Verify by reading the code you changed AND by actually running `dotnet build` and `dotnet test`. Paste the real command output summary (counts of passed/failed), do not just say "all tests pass".
- When finished, list every file changed and mark each item "fixed" or "not fixed" with one line of explanation.

---

## S1. DotNetEnv is documented but not installed (README is wrong)
`backend/README.md` says the app "loads `.env` automatically via DotNetEnv", but `backend.csproj` has no `DotNetEnv` package and `Program.cs` never calls `Env.Load()`. A developer following the README gets an app with empty connection string and JWT secret that fails at startup.

**Fix:** either (a) add `<PackageReference Include="DotNetEnv" Version="3.*" />` and call `DotNetEnv.Env.Load()` (or `TraversePath().Load()`) as the first line of `Program.cs`, before `WebApplication.CreateBuilder`, and make sure `.env` stays git-ignored and a `backend/.env.example` with empty placeholders exists; or (b) remove every DotNetEnv/.env mention from the README and keep only User Secrets and environment variables. Pick (a).
**Test:** with only a `.env` file containing `JwtSettings__SecretKey=<32+ chars>` and `ConnectionStrings__DefaultConnection=...`, the app starts.

## S2. Leaked JWT secret is still a string literal in source (R6.3)
`Extensions/AuthenticationExtensions.cs` line 15 still compares against the old leaked key. This was explicitly asked to be removed.
**Fix:** keep only `string.IsNullOrWhiteSpace(key) || key.Length < 32`. Delete the literal. Search the whole repo (including `README.md`, `*.md` prompt files, tests, `Scripts/`) for that old value and remove every occurrence.
**Test:** `git grep -n "thisisasecretkey"` returns nothing.

## S3. Lead creation still uses UTC "today" (R1 regression)
`LeadService.CreateLeadAsync` (about line 226) uses `DateOnly.FromDateTime(DateTime.UtcNow)` to decide whether the target agent is on leave, although `_clock` (`ICompanyClock`) is already injected. Between 00:00 and 05:30 IST a lead can be assigned to someone who is on leave today.
**Fix:** `var today = await _clock.GetCompanyTodayAsync(companyId, ct);`.
Also in the same block:
- The "covered" check must use the same rule as `GhlLeadAssignmentController.ProcessAssignmentAsync` (same company, active handover, and the leave/handover date window). Add `wh.CompanyId == companyId` if the entity has that column.
- `AssignedById = _currentUser.UserId ?? throw ...` runs **after** the lead is saved, so a missing user id leaves a lead without a history row. Check `_currentUser.UserId` at the top of the method and return `ApiResponse.FailureResult("User not authenticated.")` before anything is written. Wrap the lead insert and the history insert in one `SaveChangesAsync` (add both, save once).
**Test:** with a fake `ICompanyClock` returning the leave start date, an admin creating a lead for an agent on leave gets an unassigned lead and no history row.

## S4. `?? 1` tenant fallback still exists in other places (R5 asked to report/fix)
Remaining occurrences:
- `Controllers/GhlAdmin/WorkHandoverController.cs` (10 places, including `actorId = _currentUser.UserId ?? 1`)
- `Controllers/Irm/IrmReassignmentController.cs` (lines ~70, 105, 108, 154, 157)
- `Controllers/WorkHandoverUserController.cs` line 27
- `Controllers/GhlAdmin/GhlLeadAssignmentController.cs` line 34 (`GetCompanyId`)

A user without a company claim silently operates on company 1, and `actorId ?? 1` writes audit rows as user 1.
**Fix:** add a small helper (for example `ClaimsPrincipalExtensions.RequireCompanyId()` / `RequireUserId()`) that returns 401/400 when missing, and replace every `?? 1` above. Do **not** change webhook intake without confirming.
**Test:** a token with no company claim gets 401/400 from these endpoints, never data from company 1.

## S5. `SecurityAlert` entity and migration are still there (R3.3)
Nothing writes `SecurityAlerts` any more, so the entity, DbSet, snapshot entry and migration `20261007102143_AddSecurityAlertsTable` are dead code.
**Fix:** remove the entity, the DbSet, the migration + designer files and the snapshot block (it was never applied anywhere). Then run `dotnet ef migrations list` to confirm the chain is clean.

## S6. `appsettings.example.json` `Ai` section is too thin (R6.1)
It has empty `Model` and `BaseUrl` and omits timeouts, time zone and the out-of-scope message.
**Fix:** fill in the **non-secret** defaults: provider base URL, model name, timeout, `MaxToolRounds`, `MaxRowsPerTool`, `IncludeContactDetails: false`, `TimeZone`, out-of-scope message. Keep `ApiKey` empty. The keys must match the properties of `AiSettings` exactly.

## S7. Demo-user migration needs a safety check (R7)
`Data/Migrations/20261007104306_DisableDemoUsers.cs`:
- It lists `agent1@example.com` and `agent2@example.com` three times each. Dedupe.
- It disables `priya@ghlindiaventures.com`, which looks like a real company mailbox. **Do not guess**: leave a comment `// DECISION NEEDED: confirm priya@... is a demo account` and tell the owner in your reply.
- It checks `ASPNETCORE_ENVIRONMENT` at migration time. Running `dotnet ef database update` from a shell where the variable is not set will disable users on a dev database. Add a comment explaining this in the migration and in `backend/README.md`.

## S8. Regression tests are incomplete and will not be committed (L3, R1 to R5)
1. `.gitignore` contains `backend.Tests/`, so the tests are never committed. Remove that line (keep `backend.Tests/bin/` and `backend.Tests/obj/` ignored).
2. `PasswordResetServiceTests.cs` is an empty file. Delete it or write the tests.
3. Only R3 (size) and R5 (non-admin create) have tests. Add tests for:
   - R3: forged `assistant` history entry is dropped; 5 history items returns 400; a message containing "bypass KYC" is processed normally.
   - R2: with `IncludeContactDetails = false`, no tool JSON contains `Email`, `Phone`, an `@` or a 10-digit number; `MaxRowsPerTool = 3` returns at most 3 rows.
   - R4: the decline tool sets `AiChatLog.Declined = true`.
   - S3: leave check uses company time (fake clock at 01:00 IST on the leave start date).
   - R5 admin path: admin assigning to an on-leave agent gets an unassigned lead; admin assigning to an agent of another company gets an unassigned lead; every created lead with an agent has one `LeadAssignmentHistory` row.
   - C3: two companies, each with lead id 5 and a pending follow-up; reassigning company A's lead does not touch company B's follow-up.
4. Remove the unused `mockService` variable in `R3_AiAssistantController_RejectsLargeClientContext`.

---

## Final checklist (run and report real output)
1. `cd backend && dotnet build` has 0 errors; list any new warnings you introduced.
2. `cd backend.Tests && dotnet test` shows the number of passed and failed tests.
3. `cd frontend && npm run build` exits 0 and `npx vitest run` passes.
4. `git grep -n "thisisasecretkey\|gsk_\|?? 1"` shows no secrets and no remaining tenant fallbacks (except confirmed webhook intake).
5. App starts using only a `.env` file or environment variables.
6. All behaviour from the earlier reports still works: approving leave starts no handover, manual and auto assignment skip users on leave or covered, the leave detail drawer works, no page crashes on empty data.
