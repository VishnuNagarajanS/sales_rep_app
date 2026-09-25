# Frontend Mock vs Dev/API Environment Separation

This document details the architectural separation between the standalone **Mock** environment and the real **Dev/API** environment within the `sales_rep_app`.

---

## 1. Environments Overview

| Characteristic | Mock Environment (`mock`) | Dev/API Environment (`dev`) |
| :--- | :--- | :--- |
| **Vite Mode / Env** | `VITE_APP_ENV=mock` (via `.env.mock`) | `VITE_APP_ENV=dev` (via `.env.dev`) |
| **Data Source** | Pure frontend fixtures under `src/mock/` | Real ASP.NET Core backend + PostgreSQL DB |
| **Storage Engine** | Isolated `nexus_mock_*` localStorage adapter | Real API network calls + `nexus_dev_*` cache |
| **Backend Dependency** | None (runs completely offline / standalone) | Requires backend running (e.g. `http://localhost:5106`) |
| **Authentication** | Demo presets & local demo users | Real JWT auth against `/api/auth/login` |
| **Password Policy** | Empty password allowed for demo presets | Empty password strictly rejected |
| **Persona Switcher** | Enabled (instant persona switching) | Disabled (strict role-based identity) |
| **Chat & Calling** | Seeded demo chats, calling fixtures | Live API / empty state (zero fixture seeding) |
| **Fallback on Error** | N/A (local fixtures always available) | Throws/renders real API errors (no mock fallback) |

---

## 2. How to Run Each Mode

### Mock Mode (Standalone Frontend Demo)
Starts Vite in mock mode using `.env.mock`:
```bash
cd frontend
npm run dev:mock
```
To build the static mock bundle:
```bash
npm run build:mock
```

### Dev / API Mode (Real Backend & Database)
Requires the backend running on `http://localhost:5106`:
1. Start Backend:
```bash
cd backend
dotnet run
```
2. Start Frontend:
```bash
cd frontend
npm run dev:api
```
To build the production-like bundle:
```bash
npm run build:dev
# or standard:
npm run build
```

---

## 3. Directory Layout & Fixture Storage

All mock data, fixtures, demo users, demo tenants, demo conversations, and mock adapters reside strictly under `frontend/src/mock/`:

```
frontend/src/mock/
├── index.ts                     # Single public barrel export
├── runtime/
│   ├── mockConfig.ts            # isMockMode(), isDevMode(), isApiMode()
│   ├── mockModeGuard.ts         # assertMockMode()
│   ├── mockStorageAdapter.ts    # Namespaced mock adapter (nexus_mock_*)
│   └── mockBootstrap.ts         # Idempotent fixture seeding
├── tenants/
│   └── tenantFixtures.ts        # MOCK_TENANTS (GHL, Jamin)
├── roles/
│   ├── roleFixtures.ts          # MOCK_ROLES (super_admin, company_admin, etc.)
│   └── rolePermissionFixtures.ts# Role permission mapping fixtures
├── users/
│   ├── userFixtures.ts          # MOCK_USERS (Alex, Vikram, Ananya, etc.)
│   └── mockAuthHelper.ts        # Runtime demo auth helpers
├── features/
│   ├── featureFixtures.ts       # MOCK_FEATURES
│   └── customFieldFixtures.ts   # Custom field definitions
├── data/                        # Business domain fixtures
│   ├── leadFixtures.ts
│   ├── customerFixtures.ts
│   ├── dealFixtures.ts
│   ├── callFixtures.ts
│   ├── followupFixtures.ts
│   ├── projectFixtures.ts
│   ├── plotFixtures.ts
│   ├── siteVisitFixtures.ts
│   ├── bookingFixtures.ts
│   ├── investorFixtures.ts
│   ├── consultationFixtures.ts
│   ├── opportunityFixtures.ts
│   ├── notificationFixtures.ts
│   └── auditLogFixtures.ts
├── chat/
│   ├── attachmentFixtures.ts
│   ├── messageFixtures.ts
│   ├── conversationFixtures.ts
│   └── demoConversations.ts
├── calling/
│   └── irmFixtures.ts           # MOCK_IRMS
└── shared/
    ├── mockIds.ts               # MOCK_TENANT_IDS, MOCK_ROLE_IDS, MOCK_USER_IDS
    ├── mockStorageKeys.ts       # Storage keys constants
    └── mockTenantScope.ts       # Tenant matching helper (matchesMockTenant)
```

No mock fixtures, demo arrays (`INITIAL_*`), or demo objects remain in components, pages, or generic services.

---

## 4. How Mock localStorage Works

1. **Namespace Isolation**:
   - Mock data is prefixed with `nexus_mock_*` (e.g. `nexus_mock_leads`, `nexus_mock_users`).
   - Dev mode uses `nexus_dev_*` or session tokens, ensuring old mock data never bleeds into dev/API mode.
2. **Backward-Compatible Migration**:
   - `MockStorageAdapter` seamlessly checks legacy un-namespaced keys (e.g. `nexus_leads`) if the `nexus_mock_*` key is not yet present, migrates the data to `nexus_mock_*`, and cleans up duplicate records.
3. **Idempotent Bootstrap**:
   - `mockBootstrap()` only runs if `isMockMode()` evaluates to `true`.
   - Before seeding any fixture collection, it verifies if data already exists in `nexus_mock_*`. If populated, it skips re-seeding to preserve user modifications made during a demo session.

---

## 5. How Dev Mode Connects to the Backend

1. **API Client**:
   - `src/services/apiClient.ts` handles communication with the backend base URL (default `/api` routed to `http://localhost:5106` via Vite dev proxy).
   - In dev mode, requests attach the JWT bearer token from `sessionStorage` or `localStorage`.
2. **Sales API Service**:
   - `src/services/salesApi.ts` provides typed API calls for sales executive operations (leads, followups, etc.).
   - If an API call fails or the backend is unreachable, the error is immediately propagated to the UI. There are **zero fallbacks to mock fixtures**.
3. **Strict Authentication**:
   - `AuthContext.tsx` requires a non-empty password in dev mode.
   - On login, it posts to `/api/auth/login`. On HTTP 200, it receives the real user DTO, real tenant object, and JWT token.
   - Preset one-click demo login buttons are hidden on `AuthLayout.tsx` in dev mode.
   - `PersonaSwitcher.tsx` is completely disabled in dev mode to prevent spoofing roles or creating fictitious users.

---

## 6. Backend Seed vs Frontend Mock Data Separation

- **Backend Seed Data** (`backend/Data/DbInitializer.cs`, `backend/Migrations/`):
  - Pre-populates PostgreSQL database tables with relational records (numeric primary keys, hashed passwords).
  - Used strictly by ASP.NET Core when running the real application.
- **Frontend Mock Data** (`frontend/src/mock/`):
  - In-memory TypeScript fixtures and JSON structures.
  - Used exclusively by the frontend when running offline without backend dependencies.
- **Zero Cross-Pollution**:
  - Backend code never references or imports anything in `frontend/src/mock/`.
  - Frontend dev mode never loads records from `frontend/src/mock/`.

---

## 7. Tenant & Identity Boundary Strategy

| Entity | Mock Format | Backend / Dev Format | Boundary Strategy |
| :--- | :--- | :--- | :--- |
| **Tenant ID** | String slug: `'t-ghl-01'`, `'t-jamin-02'` | Integer: `1`, `2` | Serialized as string (`"1"`, `"2"`) in frontend state. Code evaluates tenant by slug (`tenant.slug === 'ghl'`) for domain logic. |
| **User ID** | String: `'usr-ghl-admin'`, `'usr-ghl-exec'` | Integer: `1`, `2`, etc. | Serialized as string (`"1"`, `"2"`). APIs parse numeric IDs where required. |
| **Tenant Scope** | `matchesMockTenant(entityCompanyId, tenantId)` | `entity.companyId === user.companyId` | Backend automatically enforces multi-tenant SQL filtering via EF Core global query filters. |

---

## 8. Adding New Mock Fixtures

1. Define the fixture data under the appropriate domain file in `frontend/src/mock/data/` (or `chat/`, `calling/`, `tenants/`).
2. Export the fixture from `frontend/src/mock/index.ts`.
3. In `frontend/src/mock/runtime/mockStorageAdapter.ts`, add the corresponding getter, setter, and default fallback.
4. In `frontend/src/mock/runtime/mockBootstrap.ts`, add the idempotent initialization check for the new collection.
5. In `frontend/src/services/storageService.ts`, delegate the method to `mockStorageAdapter` when `isMockMode()` is true, and return empty defaults when in dev mode.
