# NexusSales Multi-Tenant Platform
## Complete Database Architecture & REST API Specification
**Version:** 2.0  
**Stack:** ASP.NET Core 8 Web API, PostgreSQL (Neon DB), Entity Framework Core 8, React 19, TypeScript  
**Target Tenants:** GHL India Ventures (AIF & Wealth Advisory) & Jamin Bazaar (Plotted Enclaves & Farmland)

---

## 1. Executive Summary & Architecture Model

NexusSales is built as a **Single Database, Multi-Tenant Partitioned Architecture**.
* **Tenant Isolation:** Every shared operational record is tagged with an indexed `CompanyId` (`1` = GHL India Ventures, `2` = Jamin Bazaar).
* **Feature Gating:** Each tenant's accessible feature suite is governed by `tenants.EnabledFeatures` (stored as JSON array).
* **Domain Modules:**
  * **Shared Core:** Leads, Customers, Follow-ups, Calls, Consultations, Users, Roles, Audit Logs.
  * **GHL India Trust (Wealth & AIF):** Deals, Deal Activities, Investors, Investment Opportunities.
  * **Jamin Bazaar (Real Estate):** Property Projects, Plots Inventory, Site Visits, Bookings.

```mermaid
graph TD
    subgraph Multi-Tenant Core Platform
        T[tenants]
        U[users]
        R[roles]
        A[AuditLogs]
    end

    subgraph Shared CRM Core (CompanyId Scoped)
        L[leads]
        C[customers]
        F[followups]
        CR[call_records]
        CS[consultations]
        N[Notifications]
    end

    subgraph GHL India Ventures Domain
        D[GhlDeals]
        DA[GhlDealActivities]
        I[GhlInvestors]
        O[GhlInvestmentOpportunities]
    end

    subgraph Jamin Bazaar Domain
        P[PropertyProjects]
        PL[Plots]
        SV[SiteVisits]
        B[Bookings]
    end

    T --> L
    T --> D
    T --> P
    L --> C
    D --> DA
    P --> PL
    PL --> B
    C --> SV
```

---

## 2. Database Schema Specification

The database requires **20 core tables** (with 3 optional tables for KYC Documents and internal team Chat).

### 2.1 Multi-Tenant Identity & Access Management (6 Tables)

#### 1. `tenants` (Active in PostgreSQL)
Master registry for companies on the platform.
* `Id` (INT, PK, Auto-increment) — e.g. `1` (GHL), `2` (Jamin)
* `Name` (VARCHAR(150), NOT NULL) — Company display name
* `Slug` (VARCHAR(50), UNIQUE, NOT NULL) — URL/identifier slug (`ghl`, `jamin`)
* `BrandColor` (VARCHAR(20), NOT NULL) — Primary UI accent (e.g. `#0284c7`, `#059669`)
* `Logo` (TEXT, NULLABLE) — URL to company logo asset
* `Tagline` (VARCHAR(255), NOT NULL) — Marketing sub-headline
* `EnabledFeatures` (JSONB / TEXT[], NOT NULL) — Active module list
* `Timezone` (VARCHAR(60), NOT NULL) — e.g. `Asia/Kolkata (IST)`
* `Currency` (VARCHAR(20), NOT NULL) — e.g. `₹ INR`
* `BusinessHours` (VARCHAR(100), NOT NULL) — e.g. `09:30 AM - 07:00 PM IST`
* `IsActive` (BOOLEAN, DEFAULT true)
* `CreatedAt` (TIMESTAMPTZ, NOT NULL)
* `UpdatedAt` (TIMESTAMPTZ, NULLABLE)

#### 2. `roles` (Active in PostgreSQL)
System roles and permission strings.
* `Id` (INT, PK) — `1` (Super Admin), `2` (Company Admin), `3` (Sales Manager), `4` (Sales Executive)
* `Name` (VARCHAR(50), NOT NULL) — Display role name
* `Code` (VARCHAR(50), UNIQUE, NOT NULL) — System role key (`super_admin`, `company_admin`, `sales_executive`, `irm`)
* `Permissions` (TEXT[], NOT NULL) — Array of granted permission keys (`leads.view`, `deals.create`, etc.)
* `CreatedAt` (TIMESTAMPTZ, NOT NULL)

#### 3. `users` (Active in PostgreSQL)
System accounts across all companies and platform admins.
* `Id` (INT, PK, Auto-increment)
* `CompanyId` (INT, FK -> tenants.Id, NULLABLE for Super Admin)
* `RoleId` (INT, FK -> roles.Id, NOT NULL)
* `Name` (VARCHAR(100), NOT NULL)
* `Email` (VARCHAR(150), UNIQUE, NOT NULL)
* `PasswordHash` (VARCHAR(255), NOT NULL) — BCrypt hash
* `Phone` (VARCHAR(30), NOT NULL)
* `Status` (VARCHAR(30), DEFAULT 'Active') — `Active`, `Invited`, `Disabled`
* `LastLoginAt` (TIMESTAMPTZ, NULLABLE)
* `AvatarUrl` (TEXT, NULLABLE)
* `CreatedAt` (TIMESTAMPTZ, NOT NULL)

#### 4. `PasswordResetTokens` (Active in PostgreSQL)
Single-use tokens for forgotten password recovery.
* `Id` (INT, PK)
* `UserId` (INT, FK -> users.Id)
* `Token` (VARCHAR(255), UNIQUE, NOT NULL)
* `ExpiresAt` (TIMESTAMPTZ, NOT NULL)
* `Used` (BOOLEAN, DEFAULT false)

#### 5. `ExecutiveProfiles` (Active in PostgreSQL)
Performance quotas, metrics, and configurations per sales agent.
* `Id` (INT, PK)
* `UserId` (INT, FK -> users.Id, UNIQUE)
* `CompanyId` (INT, FK -> tenants.Id)
* `MonthlyLeadTarget` (INT, DEFAULT 50)
* `MonthlyRevenueTarget` (NUMERIC(14,2), DEFAULT 10000000)
* `Specializations` (TEXT[], NULLABLE)
* `MaxActiveLeads` (INT, DEFAULT 100)

#### 6. `AuditLogs` (Active in PostgreSQL)
Immutable security and compliance event journal.
* `Id` (INT, PK, Auto-increment)
* `CompanyId` (INT, FK -> tenants.Id, NULLABLE)
* `UserId` (INT, NULLABLE)
* `UserName` (VARCHAR(100), NOT NULL)
* `Action` (VARCHAR(50), NOT NULL) — `Create`, `Update`, `Delete`, `Export`, `Login`
* `EntityType` (VARCHAR(50), NOT NULL) — `Lead`, `Deal`, `User`, `Booking`, etc.
* `EntityId` (VARCHAR(50), NOT NULL)
* `Details` (TEXT, NOT NULL)
* `IpAddress` (VARCHAR(45), NULLABLE)
* `Timestamp` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW())

---

### 2.2 Shared Core CRM (6 Tables)

#### 7. `leads` (Active in PostgreSQL)
All inbound and assigned prospective clients.
* `Id` (INT, PK, Auto-increment)
* `CompanyId` (INT, FK -> tenants.Id, NOT NULL, INDEXED)
* `AssignedAgentId` (INT, FK -> users.Id, NOT NULL)
* `Name` (VARCHAR(150), NOT NULL)
* `Phone` (VARCHAR(50), NOT NULL)
* `Email` (VARCHAR(150), NULLABLE)
* `Location` (VARCHAR(150), NULLABLE)
* `Source` (VARCHAR(80), NOT NULL) — `Website Inbound`, `Referral`, `Campaign`, etc.
* `Status` (VARCHAR(50), NOT NULL) — `New`, `Contacted`, `Qualified`, `Proposal`, `Negotiation`, `Converted`, `Follow-up Required`, `Not Interested`, `Junk`
* `Priority` (VARCHAR(20), NOT NULL) — `Low`, `Medium`, `High`, `Urgent`
* `Notes` (TEXT, NULLABLE)
* `CustomFieldsJson` (TEXT / JSONB, NULLABLE) — Stores domain specifics: `investmentCapacity`, `assetClass`, `horizon`, `preferredPlotFacing`, etc.
* `NextFollowupDate` (TIMESTAMPTZ, NULLABLE)
* `CreatedAt` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW())
* `UpdatedAt` (TIMESTAMPTZ, NULLABLE)

#### 8. `customers` (Active in PostgreSQL)
Converted leads who have closed transactions or active portfolios.
* `Id` (INT, PK, Auto-increment)
* `CompanyId` (INT, FK -> tenants.Id, NOT NULL)
* `AssignedAgentId` (INT, FK -> users.Id, NOT NULL)
* `Name` (VARCHAR(150), NOT NULL)
* `Phone` (VARCHAR(50), NOT NULL)
* `Email` (VARCHAR(150), NULLABLE)
* `Location` (VARCHAR(150), NULLABLE)
* `Status` (VARCHAR(30), DEFAULT 'Active') — `Active`, `VIP`, `Inactive`
* `TotalValue` (NUMERIC(14,2), DEFAULT 0)
* `Notes` (TEXT, NULLABLE)
* `CreatedAt` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW())

#### 9. `followups` (Active in PostgreSQL)
Actionable scheduled tasks and callbacks.
* `Id` (INT, PK, Auto-increment)
* `CompanyId` (INT, FK -> tenants.Id, NOT NULL)
* `AssignedAgentId` (INT, FK -> users.Id, NOT NULL)
* `ContactId` (VARCHAR(50), NOT NULL)
* `ContactType` (VARCHAR(20), DEFAULT 'lead') — `lead`, `customer`, `investor`
* `ContactName` (VARCHAR(150), NOT NULL)
* `ContactPhone` (VARCHAR(50), NULLABLE)
* `ScheduledAt` (TIMESTAMPTZ, NOT NULL)
* `Priority` (VARCHAR(20), DEFAULT 'Medium')
* `Status` (VARCHAR(30), DEFAULT 'Pending') — `Pending`, `Completed`, `Cancelled`
* `Notes` (TEXT, NULLABLE)
* `CompletedAt` (TIMESTAMPTZ, NULLABLE)
* `CreatedAt` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW())

#### 10. `call_records` (Active in PostgreSQL)
Telephony dialer logs and interaction recordings.
* `Id` (INT, PK, Auto-increment)
* `CompanyId` (INT, FK -> tenants.Id, NOT NULL)
* `AgentId` (INT, FK -> users.Id, NOT NULL)
* `ContactName` (VARCHAR(150), NOT NULL)
* `ContactPhone` (VARCHAR(50), NOT NULL)
* `Direction` (VARCHAR(20), NOT NULL) — `inbound`, `outbound`
* `Duration` (INT, DEFAULT 0) — Seconds
* `Disposition` (VARCHAR(50), NOT NULL) — `Interested`, `Not Interested`, `Follow-up Required`, `Call Back`, `Converted`
* `RecordingUrl` (TEXT, NULLABLE)
* `Transcription` (TEXT, NULLABLE)
* `Notes` (TEXT, NULLABLE)
* `Timestamp` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW())

#### 11. `consultations` (Active in PostgreSQL)
Formal structured investment or land advisory sessions.
* `Id` (INT, PK, Auto-increment)
* `CompanyId` (INT, FK -> tenants.Id, NOT NULL)
* `ConsultantId` (INT, FK -> users.Id, NOT NULL)
* `InvestorId` (VARCHAR(50), NOT NULL)
* `InvestorName` (VARCHAR(150), NOT NULL)
* `InvestorPhone` (VARCHAR(50), NULLABLE)
* `ScheduledAt` (TIMESTAMPTZ, NOT NULL)
* `Status` (VARCHAR(30), DEFAULT 'Scheduled') — `Scheduled`, `Completed`, `Rescheduled`, `Cancelled`
* `Agenda` (TEXT, NULLABLE)
* `OutcomeNotes` (TEXT, NULLABLE)
* `CreatedAt` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW())

#### 12. `Notifications` (Active in PostgreSQL)
User-level notifications and real-time alerts.
* `Id` (INT, PK, Auto-increment)
* `CompanyId` (INT, FK -> tenants.Id, NULLABLE)
* `TargetUserId` (INT, FK -> users.Id, NULLABLE) — NULL for broadcast
* `Type` (VARCHAR(30), NOT NULL) — `lead`, `call`, `followup`, `deal`, `system`
* `Title` (VARCHAR(200), NOT NULL)
* `Message` (TEXT, NOT NULL)
* `Read` (BOOLEAN, DEFAULT false)
* `Link` (VARCHAR(255), NULLABLE)
* `CreatedAt` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW())

---

### 2.3 GHL India Ventures Domain: AIF Wealth Advisory (4 Tables)

#### 13. `GhlDeals` (Active in PostgreSQL)
High-ticket investment deals in the sales pipeline.
* `Id` (INT, PK, Auto-increment)
* `CompanyId` (INT, FK -> tenants.Id, NOT NULL, DEFAULT 1)
* `CustomerId` (INT, FK -> customers.Id, NULLABLE)
* `Title` (VARCHAR(200), NOT NULL)
* `Stage` (VARCHAR(50), NOT NULL) — `Discovery`, `Qualified`, `Proposal`, `Due Diligence`, `Committed`, `Closed Won`, `Closed Lost`
* `Value` (NUMERIC(14,2), NOT NULL)
* `ExpectedCloseDate` (TIMESTAMPTZ, NULLABLE)
* `InvestorType` (VARCHAR(50), DEFAULT 'HNW Individual') — `HNW Individual`, `Family Office`, `Institutional`
* `InvestmentRange` (VARCHAR(50), NULLABLE) — e.g. `₹15 Cr – ₹25 Cr`
* `PreferredAssetClass` (VARCHAR(50), DEFAULT 'AIF')
* `Priority` (VARCHAR(20), DEFAULT 'Medium')
* `Notes` (TEXT, NULLABLE)
* `CreatedAt` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW())

#### 14. `GhlDealActivities` (Active in PostgreSQL)
Chronological log of notes, calls, and stage movements for each deal.
* `Id` (INT, PK, Auto-increment)
* `DealId` (INT, FK -> GhlDeals.Id, NOT NULL)
* `CompanyId` (INT, NOT NULL, DEFAULT 1)
* `Type` (VARCHAR(30), NOT NULL) — `note`, `call`, `meeting`, `stage_change`
* `Text` (TEXT, NOT NULL)
* `FromStage` (VARCHAR(50), NULLABLE)
* `ToStage` (VARCHAR(50), NULLABLE)
* `LoggedByName` (VARCHAR(100), NOT NULL)
* `LoggedByRole` (VARCHAR(50), NULLABLE)
* `Timestamp` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW())

#### 15. `GhlInvestors` (Active in PostgreSQL)
HNW individual & institutional wealth investors.
* `Id` (INT, PK, Auto-increment)
* `CompanyId` (INT, NOT NULL, DEFAULT 1)
* `Name` (VARCHAR(150), NOT NULL)
* `Phone` (VARCHAR(50), NOT NULL)
* `Email` (VARCHAR(150), NULLABLE)
* `City` (VARCHAR(100), NULLABLE)
* `Status` (VARCHAR(30), DEFAULT 'Active')
* `InvestorType` (VARCHAR(50), NOT NULL)
* `TicketSize` (VARCHAR(50), NOT NULL) — e.g. `₹5 Cr+`
* `TotalInvested` (NUMERIC(14,2), DEFAULT 0)
* `PreferredAssetClass` (VARCHAR(50), DEFAULT 'AIF')
* `CreatedAt` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW())

#### 16. `GhlInvestmentOpportunities` (Active in PostgreSQL)
Curated alternative investment funds, private credit & yield vehicles.
* `Id` (INT, PK, Auto-increment)
* `CompanyId` (INT, NOT NULL, DEFAULT 1)
* `Title` (VARCHAR(200), NOT NULL) — e.g. `Bengaluru Commercial Yield Fund IV`
* `AssetClass` (VARCHAR(50), NOT NULL) — `AIF Category II`, `Private Credit`, `Commercial REIT`
* `TargetReturn` (VARCHAR(30), NOT NULL) — e.g. `16.5% IRR`
* `Tenure` (VARCHAR(30), NOT NULL) — e.g. `3-5 Years`
* `MinInvestment` (VARCHAR(30), NOT NULL) — e.g. `₹1 Cr`
* `TotalFundSize` (VARCHAR(50), NOT NULL) — e.g. `₹150 Cr`
* `Status` (VARCHAR(30), DEFAULT 'Active')
* `CreatedAt` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW())

---

### 2.4 Jamin Bazaar Domain: Plotted Enclaves & Farmland (4 Tables)

#### 17. `PropertyProjects` (Schema Ready in PostgreSQL)
Plotted land enclaves, master communities, and farmland projects.
* `Id` (TEXT / INT, PK)
* `CompanyId` (TEXT / INT, FK -> tenants.Id, NOT NULL, DEFAULT 2)
* `Name` (TEXT, NOT NULL) — e.g. `Devanahalli Eco Enclave`
* `Location` (TEXT, NOT NULL) — e.g. `Devanahalli, North Bengaluru`
* `Status` (TEXT, NOT NULL) — `Upcoming`, `Active`, `Sold Out`
* `TotalPlots` (INT, NOT NULL)
* `AvailablePlots` (INT, NOT NULL)
* `HoldPlots` (INT, DEFAULT 0)
* `SoldPlots` (INT, DEFAULT 0)
* `Description` (TEXT, NULLABLE)
* `PriceRange` (TEXT, NULLABLE) — e.g. `₹75 L – ₹1.8 Cr`
* `CreatedAt` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW())

#### 18. `Plots` (Schema Ready in PostgreSQL)
Individual layout unit inventory and status tracking.
* `Id` (TEXT, PK)
* `ProjectId` (TEXT, FK -> PropertyProjects.Id, NOT NULL)
* `ProjectName` (TEXT, NOT NULL)
* `PlotNumber` (TEXT, NOT NULL) — e.g. `Plot #42`
* `SizeSqft` (NUMERIC(10,2), NOT NULL) — e.g. `2400.00`
* `PricePerSqft` (NUMERIC(10,2), NOT NULL) — e.g. `4500.00`
* `TotalPrice` (NUMERIC(14,2), NOT NULL)
* `Status` (TEXT, NOT NULL) — `Available`, `Hold`, `Sold`
* `Dimension` (TEXT, NULLABLE) — e.g. `40 x 60 ft`
* `Facing` (TEXT, NULLABLE) — `North`, `East`, `Corner`
* `HoldByCustomer` (TEXT, NULLABLE)
* `HoldByAgent` (TEXT, NULLABLE)
* `HoldExpiry` (TIMESTAMPTZ, NULLABLE)

#### 19. `SiteVisits` (Schema Ready in PostgreSQL)
Customer field visit appointments for land inspection.
* `Id` (TEXT, PK)
* `CompanyId` (TEXT, FK -> tenants.Id, NOT NULL, DEFAULT 2)
* `CustomerId` (TEXT, NOT NULL)
* `CustomerName` (TEXT, NOT NULL)
* `CustomerPhone` (TEXT, NOT NULL)
* `ProjectId` (TEXT, FK -> PropertyProjects.Id, NOT NULL)
* `ProjectName` (TEXT, NOT NULL)
* `PlotNumber` (TEXT, NULLABLE)
* `ScheduledAt` (TEXT / TIMESTAMPTZ, NOT NULL)
* `AssignedAgentId` (TEXT, NOT NULL)
* `AssignedAgentName` (TEXT, NOT NULL)
* `Status` (TEXT, NOT NULL) — `Scheduled`, `Completed`, `Rescheduled`, `Cancelled`, `No-show`
* `OutcomeNotes` (TEXT, NULLABLE)

#### 20. `Bookings` (Schema Ready in PostgreSQL)
Confirmed plot purchases, advance payments, and legal allotment agreements.
* `Id` (TEXT, PK)
* `CompanyId` (TEXT, FK -> tenants.Id, NOT NULL, DEFAULT 2)
* `CustomerId` (TEXT, NOT NULL)
* `CustomerName` (TEXT, NOT NULL)
* `CustomerPhone` (TEXT, NOT NULL)
* `ProjectId` (TEXT, NOT NULL)
* `ProjectName` (TEXT, NOT NULL)
* `PlotId` (TEXT, FK -> Plots.Id, NOT NULL)
* `PlotNumber` (TEXT, NOT NULL)
* `BookingDate` (TEXT / TIMESTAMPTZ, NOT NULL)
* `BookingAmount` (NUMERIC(14,2), NOT NULL) — Token advance
* `TotalAmount` (NUMERIC(14,2), NOT NULL) — Full plot price
* `PaymentTerms` (TEXT, NOT NULL)
* `Status` (TEXT, NOT NULL) — `Pending`, `Confirmed`, `Cancelled`
* `AgentId` (TEXT, NOT NULL)
* `AgentName` (TEXT, NOT NULL)

---

## 3. Complete REST API Specification

Total REST endpoints: **92 APIs** across **15 Controller groups**.

### Module 1: Authentication & Authorization (`/api/auth`)
| Method | Endpoint | Description | Auth Roles |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Authenticate email/password, issue JWT token & tenant context | Public |
| `POST` | `/api/auth/logout` | Invalidate current user session | Authenticated |
| `POST` | `/api/auth/refresh-token` | Renew expired JWT token | Public (Refresh token) |
| `POST` | `/api/auth/forgot-password` | Generate reset token email | Public |
| `POST` | `/api/auth/reset-password` | Validate token and set new password | Public |
| `GET` | `/api/auth/me` | Fetch active user profile, tenant and permissions | Authenticated |

### Module 2: Super Admin Platform Management (`/api/admin`)
| Method | Endpoint | Description | Auth Roles |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/admin/dashboard` | Platform metrics, tenant counts, active users | `super_admin` |
| `GET` | `/api/admin/companies` | List all registered tenants with status | `super_admin` |
| `POST` | `/api/admin/companies` | Provision new company tenant | `super_admin` |
| `GET` | `/api/admin/companies/{id}` | Get company configuration & feature flags | `super_admin` |
| `PUT` | `/api/admin/companies/{id}` | Update company status, branding, `EnabledFeatures` | `super_admin` |
| `DELETE` | `/api/admin/companies/{id}` | Suspend or delete company tenant | `super_admin` |
| `GET` | `/api/admin/users` | List all users across all tenants | `super_admin` |
| `POST` | `/api/admin/users` | Provision global platform administrator | `super_admin` |
| `PUT` | `/api/admin/users/{id}` | Update user status / reset credentials | `super_admin` |
| `GET` | `/api/admin/roles` | List all system roles & permission sets | `super_admin` |
| `GET` | `/api/admin/call-config` | Global telephony gateway configuration | `super_admin` |
| `PUT` | `/api/admin/call-config` | Update global SIP/WebRTC credentials | `super_admin` |

### Module 3: Company Tenant Administration (`/api/company`)
| Method | Endpoint | Description | Auth Roles |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/company/settings` | Get current tenant profile, timezone, currency | `company_admin` |
| `PUT` | `/api/company/settings` | Update tenant business hours, branding, details | `company_admin` |
| `GET` | `/api/company/users` | List company employees, reps, managers | `company_admin`, `sales_manager` |
| `POST` | `/api/company/users` | Invite new employee to company | `company_admin` |
| `PUT` | `/api/company/users/{id}` | Update employee role, quota, active status | `company_admin` |
| `DELETE` | `/api/company/users/{id}` | Deactivate employee account | `company_admin` |
| `GET` | `/api/company/teams` | List company sales teams and assignment pools | `company_admin`, `sales_manager` |
| `POST` | `/api/company/teams` | Create new sales team | `company_admin` |

### Module 4: Leads Management (`/api/sales-executive/leads`)
| Method | Endpoint | Description | Auth Roles |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/sales-executive/leads` | Paginated leads filtered by status, priority, search | All roles (scoped) |
| `POST` | `/api/sales-executive/leads` | Create lead (writes `CompanyId` and custom fields) | All roles |
| `POST` | `/api/sales-executive/leads/import-csv` | Bulk CSV import with field mapping | `company_admin`, `sales_manager` |
| `GET` | `/api/sales-executive/leads/{id}` | Fetch detailed lead profile & history | All roles (scoped) |
| `PUT` | `/api/sales-executive/leads/{id}` | Update lead information & contact details | All roles (scoped) |
| `DELETE` | `/api/sales-executive/leads/{id}` | Remove lead or move to Junk | All roles (scoped) |
| `POST` | `/api/sales-executive/leads/{id}/assign` | Reassign lead to another agent or IRM | `company_admin`, `sales_manager` |
| `POST` | `/api/sales-executive/leads/{id}/convert` | Convert lead into a Customer record | All roles |
| `GET` | `/api/sales-executive/leads/assigned` | Quick-fetch leads assigned to authenticated agent | `sales_executive`, `irm` |

### Module 5: Customers (`/api/sales-executive/customers`)
| Method | Endpoint | Description | Auth Roles |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/sales-executive/customers` | List active customers & lifetime values | All roles (scoped) |
| `POST` | `/api/sales-executive/customers` | Manually register customer | All roles |
| `GET` | `/api/sales-executive/customers/{id}` | Customer 360 view (deals, plots, calls) | All roles (scoped) |
| `PUT` | `/api/sales-executive/customers/{id}` | Update customer contact & notes | All roles (scoped) |
| `DELETE` | `/api/sales-executive/customers/{id}` | Deactivate or archive customer | `company_admin` |

### Module 6: Follow-ups & Reminders (`/api/sales-executive/followups`)
| Method | Endpoint | Description | Auth Roles |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/sales-executive/followups` | List pending, completed, or overdue follow-ups | All roles (scoped) |
| `POST` | `/api/sales-executive/followups` | Schedule callback or meeting task | All roles |
| `GET` | `/api/sales-executive/followups/{id}` | View follow-up details | All roles (scoped) |
| `PUT` | `/api/sales-executive/followups/{id}` | Reschedule or update follow-up notes | All roles (scoped) |
| `PATCH` | `/api/sales-executive/followups/{id}/complete`| Mark follow-up as completed | All roles (scoped) |
| `DELETE` | `/api/sales-executive/followups/{id}` | Cancel follow-up task | All roles (scoped) |

### Module 7: Telephony & Call Center (`/api/sales-executive/calls`)
| Method | Endpoint | Description | Auth Roles |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/sales-executive/calls` | Call history log with duration and disposition | All roles (scoped) |
| `POST` | `/api/sales-executive/calls` | Save call disposition, duration, notes | All roles |
| `POST` | `/api/sales-executive/calls/initiate` | Trigger click-to-call / WebRTC session | All roles |
| `GET` | `/api/sales-executive/calls/{id}/recording` | Stream call recording audio | Authenticated (permission) |
| `GET` | `/api/sales-executive/calls/stats` | Today's talk-time, call counts, connected rate | All roles |

### Module 8: Consultations (`/api/sales-executive/consultations`)
| Method | Endpoint | Description | Auth Roles |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/sales-executive/consultations` | List advisory sessions | All roles (scoped) |
| `POST` | `/api/sales-executive/consultations` | Book consultation | All roles |
| `PUT` | `/api/sales-executive/consultations/{id}` | Reschedule consultation | All roles (scoped) |
| `PATCH` | `/api/sales-executive/consultations/{id}/outcome` | Submit advisory outcome notes | All roles (scoped) |
| `DELETE` | `/api/sales-executive/consultations/{id}` | Cancel consultation | All roles (scoped) |

### Module 9: GHL Deals Pipeline (`/api/ghl/deals`)
| Method | Endpoint | Description | Auth Roles |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/ghl/deals` | List deals grouped by Kanban stages | `ghl` tenant roles |
| `POST` | `/api/ghl/deals` | Create investment pipeline deal | `ghl` tenant roles |
| `GET` | `/api/ghl/deals/{id}` | Deal details & financial values | `ghl` tenant roles |
| `PUT` | `/api/ghl/deals/{id}` | Update deal stage, probability, close date | `ghl` tenant roles |
| `DELETE` | `/api/ghl/deals/{id}` | Delete deal | `company_admin`, `sales_manager` |
| `GET` | `/api/ghl/deals/{id}/activities` | Get deal chronological timeline | `ghl` tenant roles |
| `POST` | `/api/ghl/deals/{id}/activities` | Log note, meeting, or stage change | `ghl` tenant roles |

### Module 10: GHL Investors & Opportunities (`/api/ghl/*`)
| Method | Endpoint | Description | Auth Roles |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/ghl/investors` | List HNW investor accounts | `ghl` tenant roles |
| `POST` | `/api/ghl/investors` | Create investor profile & AUM mandate | `ghl` tenant roles |
| `GET` | `/api/ghl/investors/{id}` | Investor portfolio details | `ghl` tenant roles |
| `PUT` | `/api/ghl/investors/{id}` | Update ticket size & asset class preference | `ghl` tenant roles |
| `DELETE` | `/api/ghl/investors/{id}` | Archive investor profile | `company_admin` |
| `GET` | `/api/ghl/investment-opportunities` | List active AIF funds and yield offerings | `ghl` tenant roles |
| `POST` | `/api/ghl/investment-opportunities` | Create investment opportunity | `company_admin`, `sales_manager` |
| `PUT` | `/api/ghl/investment-opportunities/{id}` | Update fund size, return, tenure | `company_admin` |
| `DELETE` | `/api/ghl/investment-opportunities/{id}` | Archive opportunity | `company_admin` |

### Module 11: Jamin Bazaar Real Estate Domain (`/api/properties`, etc.)
| Method | Endpoint | Description | Auth Roles |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/properties` | List plotted enclave developments & farmland | `jamin` tenant roles |
| `POST` | `/api/properties` | Create new real estate master project | `company_admin` |
| `GET` | `/api/properties/{id}` | Project details & plot inventory metrics | `jamin` tenant roles |
| `PUT` | `/api/properties/{id}` | Update project description & price range | `company_admin` |
| `GET` | `/api/plots` | List plots filtered by project & availability | `jamin` tenant roles |
| `POST` | `/api/plots` | Add plot to enclave inventory | `company_admin` |
| `PUT` | `/api/plots/{id}` | Update plot status (`Available`, `Hold`, `Sold`) | `jamin` tenant roles |
| `GET` | `/api/site-visits` | List scheduled physical site visits | `jamin` tenant roles |
| `POST` | `/api/site-visits` | Schedule customer site inspection | `jamin` tenant roles |
| `PUT` | `/api/site-visits/{id}` | Record visit outcome notes & status | `jamin` tenant roles |
| `GET` | `/api/bookings` | List plot booking agreements | `jamin` tenant roles |
| `POST` | `/api/bookings` | Book plot unit with advance payment | `jamin` tenant roles |
| `PUT` | `/api/bookings/{id}` | Confirm allotment or cancel booking | `company_admin`, `sales_manager` |

### Module 12: Audit Logs & System Health
| Method | Endpoint | Description | Auth Roles |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/audit-logs` | Filtered audit events by date, user, entity | `company_admin`, `super_admin` |
| `POST` | `/api/audit-logs` | Manually record audit event | Internal / System |
| `GET` | `/api/health` | Service & database connectivity heartbeat | Public |
| `GET` | `/api/sales-executive/dashboard` | Active counters (leads, calls, followups) | Authenticated |

### Module 13: Notifications & User Profile
| Method | Endpoint | Description | Auth Roles |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/notifications` | User's alerts list | Authenticated |
| `PATCH` | `/api/notifications/{id}/read` | Mark notification as read | Authenticated |
| `PATCH` | `/api/notifications/read-all` | Mark all notifications read | Authenticated |
| `GET` | `/api/sales-executive/profile` | Current agent quota, performance stats | Authenticated |
| `PUT` | `/api/sales-executive/profile` | Update contact & preferences | Authenticated |

### Module 14: Analytics & Reports (`/api/reports`)
| Method | Endpoint | Description | Auth Roles |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/reports/leads` | Lead pipeline conversion rate & source analysis | `sales_manager`, `company_admin` |
| `GET` | `/api/reports/sales-performance` | Agent performance leaderboard & talk time | `sales_manager`, `company_admin` |
| `GET` | `/api/reports/deals` | Deal revenue forecast & stage velocity | `sales_manager`, `company_admin` |
| `GET` | `/api/reports/export` | Download Excel/CSV report of metrics | `company_admin` |

### Module 15: KYC & Document Management (`/api/documents`)
| Method | Endpoint | Description | Auth Roles |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/documents` | List uploaded KYC files for an entity | Authenticated (scoped) |
| `POST` | `/api/documents/upload` | Multipart file upload (ID, Agreement, PAN) | Authenticated |
| `GET` | `/api/documents/{id}/download` | Generate signed download URL | Authenticated (scoped) |
| `DELETE` | `/api/documents/{id}` | Delete document | `company_admin` |
