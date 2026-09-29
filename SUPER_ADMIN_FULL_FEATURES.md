# Super Admin Platform — Full Features & Architecture Guide

## 1. Executive Summary

The **Super Admin Platform** serves as the central multi-tenant management plane for the CRM, Telephony, and Sales Acceleration ecosystem. Operating under the canonical role `super_admin`, platform administrators possess global oversight across all tenant organizations (`CompanyId == null`), governing subscription licensing, carrier/telephony routing, platform-wide roles and entitlements, security auditing, and system operations.

---

## 2. Architecture & Design Principles

### Database Design & EF Core Conventions
- **Primary Keys**: Integer identity keys (`int Id`) consistently across all backend entities.
- **Global Scope Representation**: Super Admin entities and audit log entries use `CompanyId = null` to represent platform-wide / multi-tenant ownership.
- **Array Storage**: Multi-select fields such as `EnabledFeatures` and `Permissions` leverage PostgreSQL native `text[]` columns.
- **Performance**: All read queries employ `.AsNoTracking()` for optimal throughput.
- **Audit Logging**: Every state-altering action is persisted to `AuditLogs` with actor identity (`ActorRole = "super_admin"`), action classification, timestamp, before/after values, and client IP/user-agent metadata.
- **Response Standardization**: All endpoints conform to the unified `ApiResponse<T>` envelope structure:
  ```json
  {
    "success": true,
    "data": { ... },
    "message": "Operation completed successfully.",
    "errors": []
  }
  ```

### Clean Environment Separation & Mock Priority
- **Inbuilt Seed / Mock Data Separation**:
  All fixture and mock data previously embedded in service logic has been isolated into:
  - [`frontend/src/mock/superadmin/superAdminMockData.ts`](file:///d:/Customer_care/sales_rep_app/frontend/src/mock/superadmin/superAdminMockData.ts)
  - Barrel-exported via [`frontend/src/mock/index.ts`](file:///d:/Customer_care/sales_rep_app/frontend/src/mock/index.ts)
- **Hybrid Service Architecture**:
  [`frontend/src/services/superAdminService.ts`](file:///d:/Customer_care/sales_rep_app/frontend/src/services/superAdminService.ts) automatically checks `isMockMode()`. In API mode, it performs REST calls via `apiClient`. If the backend is unreachable or in mock mode, it uses local storage and mock fixtures as fallback, ensuring zero UI disruption during development and testing.

---

## 3. Database Models & Schema Extensions

| Entity | Table Name | Purpose | Key Attributes |
|---|---|---|---|
| [`Tenant`](file:///d:/Customer_care/sales_rep_app/backend/Models/Entities/Tenant.cs) | `tenants` | Tenant organization profile & entitlements | `Id`, `Name`, `LegalName`, `Slug`, `Industry`, `Tagline`, `BrandColor`, `Status`, `SubscriptionPlan`, `EnabledFeatures` (`text[]`), `LeadSla`, `CallEnabled`, `RecordingEnabled`, `TranscriptionEnabled`, `IsActive` |
| [`SubscriptionPackage`](file:///d:/Customer_care/sales_rep_app/backend/Models/Entities/SubscriptionPackage.cs) | `subscription_packages` | Monetization & license tiers | `Id`, `Name`, `Code`, `Tier`, `PriceMonthly`, `Currency`, `MaxUsers`, `MaxStorageGb`, `Features` (`text[]`), `IsActive`, `IsPopular` |
| [`TenantDidMapping`](file:///d:/Customer_care/sales_rep_app/backend/Models/Entities/TenantDidMapping.cs) | `tenant_did_mappings` | Virtual DID hotline routing & allocation | `Id`, `PhoneNumber`, `TenantId`, `TenantName`, `TenantSlug`, `RoutingStrategy`, `QueueName`, `ChannelsCount`, `EnableRecording`, `EnableAiWhisper`, `Status`, `Notes` |
| [`PlatformCarrierSettings`](file:///d:/Customer_care/sales_rep_app/backend/Models/Entities/PlatformCarrierSettings.cs) | `platform_carrier_settings` | Global telephony trunk & SIP gateways | `Id`, `CarrierName`, `SipHost`, `SipPort`, `Codec`, `Encryption`, `IpWhitelist` (`text[]`), `FailoverHost`, `MaxConcurrentCalls`, `PingIntervalSec`, `IsActive`, `AuthUser`, `AuthPassword` |
| [`BroadcastAnnouncement`](file:///d:/Customer_care/sales_rep_app/backend/Models/Entities/BroadcastAnnouncement.cs) | `broadcast_announcements` | System-wide notices to all or targeted tenants | `Id`, `Title`, `Message`, `Type` (`info`/`warning`/`critical`), `Target` (`all`/`admins_only`/`specific_tenants`), `TenantIds` (`text[]`), `IsDismissible`, `IsActive`, `ExpiresAt` |
| [`PlatformSetting`](file:///d:/Customer_care/sales_rep_app/backend/Models/Entities/PlatformSetting.cs) | `platform_settings` | System toggles & maintenance states | `Id`, `Key`, `Value`, `Category`, `Description`, `IsEncrypted` |
| [`AuditLog`](file:///d:/Customer_care/sales_rep_app/backend/Models/Entities/AuditLog.cs) | `audit_logs` | Immutable audit trail across platform | `Id`, `CompanyId` (`null` for global), `ActorId`, `ActorName`, `ActorEmail`, `ActorRole`, `Action`, `Module`, `EntityType`, `EntityId`, `Details`, `BeforeValue`, `AfterValue`, `Status`, `CreatedAt` |

---

## 4. Super Admin API Catalog

### 4.1 Tenant & Organization Management (`PlatformTenantsController`)
**Base Route**: `/api/super-admin/tenants`  
**Security**: `[Authorize(Roles = "super_admin")]`

| Method | Endpoint | Description | Request Payload | Response |
|---|---|---|---|---|
| `GET` | `/` | List all organizations with search, status, and industry filters | Query: `search`, `status`, `industry` | `ApiResponse<List<PlatformTenantDto>>` |
| `GET` | `/{id}` | Get organization by ID or unique slug | — | `ApiResponse<PlatformTenantDto>` |
| `POST` | `/` | Provision new organization, assign initial admin, and allocate DID hotline | `CreateTenantRequest` | `ApiResponse<PlatformTenantDto>` (201 Created) |
| `PUT` | `/{id}` | Update organization profile & business hours | `UpdateTenantRequest` | `ApiResponse<PlatformTenantDto>` |
| `PATCH` | `/{id}/status` | Activate, suspend, or deactivate organization | `UpdateTenantStatusRequest` | `ApiResponse<bool>` |
| `PUT` | `/{id}/features` | Update feature entitlements (`text[]`) | `UpdateTenantFeaturesRequest` | `ApiResponse<List<string>>` |
| `DELETE`| `/{id}` | Soft-deactivate organization | — | `ApiResponse<bool>` |
| `POST` | `/{id}/impersonate`| Issue impersonation JWT token for troubleshooting | — | `ApiResponse<ImpersonateTenantResponse>` |
| `GET` | `/{id}/stats` | Retrieve aggregated counts (users, active users, DIDs) | — | `ApiResponse<TenantStatsDto>` |

---

### 4.2 Subscription Packages & Tier Management (`PlatformPackagesController`)
**Base Route**: `/api/super-admin/packages`  
**Security**: `[Authorize(Roles = "super_admin")]`

| Method | Endpoint | Description | Request Payload | Response |
|---|---|---|---|---|
| `GET` | `/` | List all available subscription tiers with tenant counts | — | `ApiResponse<List<PlatformPackageDto>>` |
| `GET` | `/{id}` | Retrieve subscription tier details | — | `ApiResponse<PlatformPackageDto>` |
| `POST` | `/` | Create a new subscription tier with user limits and features | `CreatePackageRequest` | `ApiResponse<PlatformPackageDto>` (201 Created) |
| `PUT` | `/{id}` | Update pricing, tier, user quota, or module features | `UpdatePackageRequest` | `ApiResponse<PlatformPackageDto>` |
| `DELETE`| `/{id}` | Deactivate/remove subscription tier | — | `ApiResponse<bool>` |

---

### 4.3 Telephony & Call Infrastructure (`PlatformCallConfigController`)
**Base Route**: `/api/super-admin/call-config`  
**Security**: `[Authorize(Roles = "super_admin")]`

| Method | Endpoint | Description | Request Payload | Response |
|---|---|---|---|---|
| `GET` | `/dids` | List all virtual DIDs (filter by `tenantId`, `status`) | Query: `tenantId`, `status` | `ApiResponse<List<TenantDidMappingDto>>` |
| `POST` | `/dids` | Allocate or reserve a new virtual DID hotline | `CreateDidRequest` | `ApiResponse<TenantDidMappingDto>` (201 Created) |
| `PUT` | `/dids/{id}` | Update routing strategy, queue name, whisper & recording | `UpdateDidRequest` | `ApiResponse<TenantDidMappingDto>` |
| `DELETE`| `/dids/{id}` | Release DID number back to unallocated pool | — | `ApiResponse<bool>` |
| `GET` | `/carrier` | Fetch platform SIP trunk & carrier configurations | — | `ApiResponse<PlatformCarrierSettingsDto>` |
| `PUT` | `/carrier` | Update SIP gateways, codecs, failover, and IP whitelist | `UpdateCarrierSettingsRequest` | `ApiResponse<PlatformCarrierSettingsDto>` |
| `POST` | `/test-carrier`| Send SIP OPTIONS ping to verify carrier trunk latency | — | `ApiResponse<CarrierTestResultDto>` |

---

### 4.4 Global Role Matrix & Canonical Permissions (`PlatformRolesController`)
**Base Route**: `/api/super-admin/roles`  
**Security**: `[Authorize(Roles = "super_admin")]`

| Method | Endpoint | Description | Request Payload | Response |
|---|---|---|---|---|
| `GET` | `/` | List all canonical platform roles and assigned permissions | — | `ApiResponse<List<PlatformRoleDto>>` |
| `GET` | `/permission-groups` | Retrieve canonical permission hierarchy & taxonomy | — | `ApiResponse<List<CanonicalPermissionGroupDto>>` |
| `POST` | `/` | Clone or create custom role based on template | `CreateCustomRoleRequest` | `ApiResponse<PlatformRoleDto>` (201 Created) |
| `PUT` | `/{roleCodeOrId}/permissions`| Update granular permissions for a role | `UpdateRolePermissionsRequest` | `ApiResponse<bool>` |

---

### 4.5 System Health, Maintenance & Announcements (`PlatformSystemController`)
**Base Route**: `/api/super-admin/system`  
**Security**: `[Authorize(Roles = "super_admin")]`

| Method | Endpoint | Description | Request Payload | Response |
|---|---|---|---|---|
| `GET` | `/diagnostics` | Real-time diagnostic telemetry (DB, Redis, Telephony, Storage) | — | `ApiResponse<SystemDiagnosticsDto>` |
| `GET` | `/maintenance` | Check maintenance window state & scheduled times | — | `ApiResponse<PlatformSettingDto>` |
| `POST` | `/maintenance` | Engage or disengage global maintenance mode | `ToggleMaintenanceRequest` | `ApiResponse<bool>` |
| `GET` | `/announcements`| List all active broadcast announcements | — | `ApiResponse<List<BroadcastAnnouncementDto>>` |
| `POST` | `/announcements`| Publish banner announcement to all or specific tenants | `CreateAnnouncementRequest` | `ApiResponse<BroadcastAnnouncementDto>` (201 Created) |
| `DELETE`| `/announcements/{id}`| Dismiss or revoke announcement | — | `ApiResponse<bool>` |

---

### 4.6 Executive Dashboard & Platform Analytics (`PlatformDashboardController`)
**Base Route**: `/api/super-admin/dashboard`  
**Security**: `[Authorize(Roles = "super_admin")]`

| Method | Endpoint | Description | Request Payload | Response |
|---|---|---|---|---|
| `GET` | `/metrics` | Global KPI metrics (total tenants, active users, call minutes, MRR) | — | `ApiResponse<PlatformMetricsDto>` |
| `GET` | `/health` | Live cluster health status, uptime, and database latency | — | `ApiResponse<PlatformHealthCheckDto>` |
| `GET` | `/recent-activity`| Global audit feed of recent platform administrative operations | Query: `limit` (default: 15) | `ApiResponse<List<PlatformActivityItemDto>>` |

---

### 4.7 Multi-Tenant User Management & Audit Logs
- **Platform Users**: [`PlatformUsersController`](file:///d:/Customer_care/sales_rep_app/backend/Controllers/SuperAdmin/PlatformUsersController.cs) (`/api/super-admin/users`) allows cross-tenant filtering, admin account provisioning, role reassignment, and password resets.
- **Audit Logs & CSV Export**: [`AuditLogsController`](file:///d:/Customer_care/sales_rep_app/backend/Controllers/GhlAdmin/AuditLogsController.cs) (`/api/audit-logs` and `/api/audit-logs/export-csv`) supports full historical query filtering and streaming CSV export for compliance reporting.

---

## 5. Frontend Integration & Mock Data Architecture

### Mock Data Isolation
All seed datasets are organized under `frontend/src/mock/superadmin/`:
```
frontend/src/mock/
├── index.ts                     (Barrel export)
└── superadmin/
    └── superAdminMockData.ts    (Dedicated mock collections)
        ├── SUPER_ADMIN_MOCK_PACKAGES
        ├── SUPER_ADMIN_MOCK_DIDS
        ├── SUPER_ADMIN_MOCK_CARRIER_SETTINGS
        ├── SUPER_ADMIN_MOCK_ANNOUNCEMENTS
        ├── SUPER_ADMIN_MOCK_TENANTS
        ├── SUPER_ADMIN_MOCK_DIAGNOSTICS
        ├── SUPER_ADMIN_MOCK_MAINTENANCE_MODE
        └── SUPER_ADMIN_MOCK_METRICS
```

### Full Frontend Page Coverage
| Admin Module | Page Component | Features Integrated |
|---|---|---|
| **Companies** | [`CompaniesPage.tsx`](file:///d:/Customer_care/sales_rep_app/frontend/src/pages/Admin/Companies/CompaniesPage.tsx) | Tenant list, search, status filtering, new company wizard, drawer inspector, feature flags, impersonation, user assignment. |
| **Hotlines / DIDs** | [`PlatformCallConfigPage.tsx`](file:///d:/Customer_care/sales_rep_app/frontend/src/pages/Admin/CallConfig/PlatformCallConfigPage.tsx) | DID allocation, round-robin/priority routing, SIP carrier trunk settings, carrier latency ping test. |
| **Packages** | [`PlatformFeaturesPage.tsx`](file:///d:/Customer_care/sales_rep_app/frontend/src/pages/Admin/Features/PlatformFeaturesPage.tsx) | Tier card configuration, price editor, user/storage quota management, feature entitlement assignment. |
| **Roles & RBAC** | [`PlatformRolesPage.tsx`](file:///d:/Customer_care/sales_rep_app/frontend/src/pages/Admin/Roles/PlatformRolesPage.tsx) | Permission matrix, granular capability toggles, custom role creation from base template. |
| **Users** | [`UsersPage.tsx`](file:///d:/Customer_care/sales_rep_app/frontend/src/pages/Admin/Users/UsersPage.tsx) | Global user directory, role assignments, password reset generator, user status toggling. |
| **Audit Logs** | [`AuditLogsPage.tsx`](file:///d:/Customer_care/sales_rep_app/frontend/src/pages/Admin/AuditLogs/AuditLogsPage.tsx) | Real-time audit log timeline, before/after diff viewer, CSV export download. |
| **System Diagnostics** | [`PlatformSystemPage.tsx`](file:///d:/Customer_care/sales_rep_app/frontend/src/pages/Admin/System/PlatformSystemPage.tsx) | Service health cards, maintenance mode switch, broadcast announcement authoring. |

---

## 6. Build & Validation Verification

- **Backend Build**:
  - `dotnet build`: Completed with **0 errors and 0 warnings**.
  - EF Core migration generated: `20260929094119_AddSuperAdminPlatformModules`.
- **Frontend Build**:
  - `npm run build` (`tsc -b && vite build --mode dev`): Completed with **0 errors**, production bundle compiled cleanly.
