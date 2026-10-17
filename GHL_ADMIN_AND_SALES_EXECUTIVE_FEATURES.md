# GHL Admin & Sales Executive – Complete Feature Inventory & Specification

> **Document Version:** 1.0  
> **Target Roles:** Company Admin (`company_admin` / `admin` / `ghl_admin`), Sales Executive (`sales_executive`)  
> **Tenant Ecosystem:** GHL India Ventures & Multi-Tenant Wealth/Real-Estate CRM  
> **Repository:** `VishnuNagarajanS/sales_rep_app`  
> **Branch:** `vishnu-dev`  
> **Last Updated:** October 2026  

---

## Table of Contents
1. [Executive Summary & Role Definitions](#1-executive-summary--role-definitions)
2. [GHL Admin (Company Admin) Architecture & Features](#2-ghl-admin-company-admin-architecture--features)
   - [2.1 Navigation & Modular Structure](#21-navigation--modular-structure)
   - [2.2 Company Command Dashboard](#22-company-command-dashboard)
   - [2.3 Lead Management & Intelligent Assignment Engine](#23-lead-management--intelligent-assignment-engine)
   - [2.4 Customer Flow & Customer 360](#24-customer-flow--customer-360)
   - [2.5 Pipeline & Deals Management](#25-pipeline--deals-management)
   - [2.6 Follow-up Desk & Scheduling](#26-follow-up-desk--scheduling)
   - [2.7 Consultations & Discovery Meetings](#27-consultations--discovery-meetings)
   - [2.8 Telephony, Call Center & Call Recordings](#28-telephony-call-center--call-recordings)
   - [2.9 Work Handover & Leave Management Subsystem](#29-work-handover--leave-management-subsystem)
   - [2.10 Team & User Administration (Creation, Reset Password, Safe Delete)](#210-team--user-administration)
   - [2.11 Roles & Permissions (RBAC Matrix)](#211-roles--permissions-rbac-matrix)
   - [2.12 Reports & Analytics Engine](#212-reports--analytics-engine)
   - [2.13 Organization Settings & Governance](#213-organization-settings--governance)
3. [Sales Executive Architecture & Features](#3-sales-executive-architecture--features)
   - [3.1 Navigation & Sidebar Architecture](#31-navigation--sidebar-architecture)
   - [3.2 Sales Rep Command Dashboard](#32-sales-rep-command-dashboard)
   - [3.3 My Leads & Unassigned Queue](#33-my-leads--unassigned-queue)
   - [3.4 Lead Details & Activity Timeline](#34-lead-details--activity-timeline)
   - [3.5 Calling Engine & Call Outcome Dispositions](#35-calling-engine--call-outcome-dispositions)
   - [3.6 Follow-up Execution & Reminders](#36-follow-up-execution--reminders)
   - [3.7 Consultations & Discovery Desk](#37-consultations--discovery-desk)
   - [3.8 Customer Flow & Conversions](#38-customer-flow--conversions)
   - [3.9 Not-Interested & Junk Archival Desks](#39-not-interested--junk-archival-desks)
   - [3.10 Peer Coverage & Work Handover Responsibilities](#310-peer-coverage--work-handover-responsibilities)
   - [3.11 Personal Leave Requests & Scorecard](#311-personal-leave-requests--scorecard)
4. [Shared & Cross-Functional Platform Features](#4-shared--cross-functional-platform-features)
   - [4.1 Multi-Tenant Context & Data Isolation](#41-multi-tenant-context--data-isolation)
   - [4.2 WebRTC Softphone & Real-Time Telephony Infrastructure](#42-webrtc-softphone--real-time-telephony-infrastructure)
   - [4.3 Real-Time WebSocket Infrastructure (SignalR PlatformHub)](#43-real-time-websocket-infrastructure-signalr-platformhub)
   - [4.4 Smarty AI Assistant & LLM Tool Calling](#44-smarty-ai-assistant--llm-tool-calling)
   - [4.5 Security Events & Centralized Audit Trail](#45-security-events--centralized-audit-trail)
   - [4.6 Background Automation Jobs](#46-background-automation-jobs)
5. [Complete API Endpoint & Controller Matrix](#5-complete-api-endpoint--controller-matrix)
6. [Merge & Regression Checklist](#6-merge--regression-checklist)

---

## 1. Executive Summary & Role Definitions

In the Nexus CRM ecosystem, the sales lifecycle is divided into clear operational tiers to guarantee regulatory compliance, high-velocity lead conversions, and zero data loss:

```
┌────────────────────────────────────────────────────────────────────────┐
│                          GHL Admin (Company Admin)                     │
│  - Team Orchestration    - Intelligent Lead Assignment & Reassignment  │
│  - Pipeline Oversight    - Work Handover & Leave Decisions             │
│  - User Provisioning     - Password Reset & Session Invalidation       │
│  - RBAC & Auditing       - System Analytics & SLA Monitoring           │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
                    ▼                                ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────┐
│            Sales Executive           │  │  Investor Relations Manager  │
│  - Outbound/Inbound Calling Rep      │  │             (IRM)            │
│  - High-Volume Lead Qualification    │  │  - HNI Wealth Advisory       │
│  - Follow-up Management              │  │  - SEBI/PMLA KYC Compliance  │
│  - Discovery Consultations           │  │  - Ticket Size Confirmations │
│  - Outcome Tagging & Dispositions    │  │  - Opportunity Closures      │
│  - Handovers `Interested` to IRM     │  │  - Investor 360 Portfolio    │
└──────────────────────────────────────┘  └──────────────────────────────┘
```

- **GHL Admin (`company_admin`):** Exercises tenant-level control over agents, lead distributions, handover transitions, pipeline stages, settings, and team performance metrics.
- **Sales Executive (`sales_executive`):** First-line sales operator responsible for fast response times (SLA), cold outreach, qualification calls, follow-ups, and booking advisory consultations. Once a lead expresses intent (`Interested`), they bridge the lead to the IRM team for wealth structuring.

---

## 2. GHL Admin (Company Admin) Architecture & Features

### 2.1 Navigation & Modular Structure
When a user with `company_admin` logs into the GHL tenant ecosystem, the dynamic sidebar organizes features across structured operational categories:

```
├── Dashboard (Company Command Dashboard)
├── Sales
│   ├── Leads                   (Complete company lead directory)
│   ├── Assigned Leads          (Leads assigned to active agents)
│   ├── Pending Leads           (Unassigned leads awaiting allocation)
│   ├── Follow-ups              (Organization-wide follow-up calendar)
│   ├── Customers 360           (Active customer dossiers & accounts)
│   ├── Pipeline                (Kanban view of deals across pipeline stages)
│   └── Archived Leads          (Junk, Not-Interested & Wrong Number archives)
├── Calling
│   ├── Call Center             (Twilio WebRTC softphone & team dialer)
│   └── Call History            (Complete recording repository & logs)
├── Investors (Tenant-Specific: GHL)
│   ├── Consultations           (Advisory discovery slots & referrals)
│   ├── KYC Leads               (SEBI/PMLA compliance verification queue)
│   ├── Opportunities           (High-ticket deals & commitments)
│   └── Investors 360           (Mobilized capital & portfolio records)
├── Analytics
│   ├── Reports                 (Agent performance, conversions & calls)
│   └── Notifications           (Real-time SignalR notifications)
├── Administration
│   ├── Users                   (Team management, invites, password resets, safe delete)
│   ├── Work Handover           (Live coverage desks, history & overdue return)
│   ├── Leave Requests          (Employee leave approvals & coverage checks)
│   └── Audit Logs              (Detailed audit trails & actor logs)
├── Settings
│   ├── Call Settings           (Audio device selection & mic tests)
│   └── Company Settings        (Business hours, recording toggle, lead SLA)
└── Help and Support
    ├── Chat                    (Internal team chat with unread badges)
    └── Smarty AI               (LLM assistant for CRM queries & insights)
```

---

### 2.2 Company Command Dashboard
*Component: `CompanyDashboardPage.tsx` | Route: `/dashboard`*

1. **Executive KPI Metric Tiles:**
   - **Active Leads Counter:** Real-time count of non-archived leads in the company pipeline.
   - **Pending Follow-ups:** Count of callbacks and scheduled interactions due across all agents.
   - **Open Deals & Pipeline Value:** Total monetary value across open deal stages formatted in Indian currency (`₹ Cr / L`).
   - **Total Customers:** Active converted client accounts.
2. **Team Workforce Availability Banner:**
   - Highlights agents currently on approved leave and indicates whether their desk is actively covered by an assigned successor.
3. **Conversion Funnel Breakdown:**
   - Visual distribution from New Lead ➔ Contacted ➔ Qualified/Interested ➔ Opportunity ➔ Converted Customer.
4. **Quick Action Modal Triggers:**
   - Direct shortcuts to `+ Create Lead`, `+ Assign Leads`, `+ Add Team Member`, and `+ Start Work Handover`.

---

### 2.3 Lead Management & Intelligent Assignment Engine
*Components: `LeadsPage.tsx`, `AssignedLeadsPage.tsx`, `PendingLeadsPage.tsx`, `ArchivedLeadsPage.tsx`*  
*Controller: `GhlLeadAssignmentController.cs`*

1. **Lead Segregation Views:**
   - **All Leads (`/leads`):** Full table of tenant leads with search, source filters, status pills, and bulk operations.
   - **Assigned Leads (`/assigned-leads`):** Shows leads allocated to Sales Executives or IRMs with agent name, assignment timestamp, and last activity.
   - **Pending Leads (`/pending-leads`):** Filtered view of unassigned leads awaiting allocation.
   - **Archived Leads (`/archived-leads`):** Isolated graveyard for disqualified leads (`Not Interested`, `Junk`, `Wrong Number`) with recorded disposition reasons.
2. **Intelligent Assignment Engine (`api/ghl/leads/assign` & `api/ghl/leads/reassign`):**
   - **Manual Multi-Lead Assignment:** Select multiple leads via checkboxes and assign to a selected active Sales Executive.
   - **Reassignment Workflow:** Transfer already-assigned leads from one agent to another with automatic transfer of associated open follow-up tasks.
   - **Leave & Coverage Awareness:**
     - The engine inspects `_context.LeaveRequests` and `_context.WorkHandovers`.
     - **Blocks assignment** to any agent who is currently on approved leave or whose desk is covered by another agent:
       ```
       "Agent Naveen is on approved leave until 20 Oct. Cannot assign new leads."
       ```
3. **Automated Round-Robin Lead Rotation (`api/ghl/leads/auto-assign`):**
   - Evenly distributes unallocated leads across active and available Sales Executives.
   - Maintains a rotation pointer based on `LeadAssignmentHistories` to ensure fair distribution across batch uploads.
   - Automatically filters out inactive, on-leave, or covered agents from the rotation pool.
4. **Follow-up Synchronization:**
   - When a lead is assigned or reassigned, all pending follow-up records (`Followup.Status == Pending`) linked to that lead are automatically reassigned to the new agent's queue.
5. **CSV Batch Import / Export:**
   - Upload lead spreadsheets with automatic column mapping (Name, Phone, Email, Location, Source, Initial Notes).
   - Export filtered lead lists to CSV for offline analysis.

---

### 2.4 Customer Flow & Customer 360
*Component: `CustomersPage.tsx` | Controller: `SalesExecutiveCustomersController.cs` & `CustomerService.cs`*

1. **Unified Customer Dossier:**
   - Complete profile containing contact information, linked deals, total investment value, KYC verification status, and consultation history.
2. **Activity Timeline:**
   - Chronological log of all calls (with duration and recording links), follow-ups, and notes.
3. **Document Repository:**
   - Secure upload and viewing of customer identity proofs, PAN cards, agreement documents, and KYC packages.
4. **Associated Deals & Opportunities:**
   - Real-time tabulation of all deals won, lost, or pending for the customer.

---

### 2.5 Pipeline & Deals Management
*Components: `PipelinePage.tsx`, `DealsPage.tsx` | Controller: `GhlDealsController.cs`*

1. **Kanban Visual Board (`/pipeline`):**
   - Drag-and-drop or status-click deal progression across pipeline stages:
     - `Lead In` ➔ `Discovery Call` ➔ `Proposal Sent` ➔ `KYC / Compliance` ➔ `Negotiation` ➔ `Closed Won` / `Closed Lost`.
2. **Deal Attributes & Financials:**
   - Deal Title, Value in INR, Expected Close Date, Priority, Assigned Agent, and Customer link.
3. **Win / Loss Disposition:**
   - Marking a deal as `Closed Lost` requires a mandatory reason (e.g. Budget Mismatch, Competitor, Regulatory Concern).
4. **Concurrency Protection:**
   - Utilizes optimistic concurrency control (`xmin` / timestamp tokens) to prevent conflicting edits by multiple team members.

---

### 2.6 Follow-up Desk & Scheduling
*Component: `FollowupsPage.tsx` | Controller: `FollowupService.cs`*

1. **Centralized Team Follow-up Calendar:**
   - Filter by date range, agent, status (`Pending`, `Completed`, `Cancelled`), and priority (`High`, `Medium`, `Low`).
2. **Scheduled Interaction Engine:**
   - Schedule future callbacks with specific agenda items and reminder timestamps.
3. **One-Click Telephony Integration:**
   - Click phone icon directly from the follow-up row to trigger the softphone dialer with pre-populated customer details.
4. **Automated Completion:**
   - When an agent completes a call with that contact and logs a call disposition, the associated pending follow-up is automatically marked `Completed`.

---

### 2.7 Consultations & Discovery Meetings
*Component: `ConsultationsPage.tsx` | Controller: `ConsultationService.cs`*

1. **Consultation Slot Management:**
   - Book and track specialized advisory consultations between clients and designated wealth consultants / IRMs.
2. **Status Lifecycle:**
   - `Scheduled` (0) ➔ `Completed` (1) ➔ `Cancelled` (2) ➔ `No Show` (3).
3. **Referral Attribution:**
   - Tracks `ReferredByAgentName` so original Sales Executives receive credit when their booked consultation leads to a deal.

---

### 2.8 Telephony, Call Center & Call Recordings
*Components: `CallCenterPage.tsx`, `CallHistoryPage.tsx`*  
*Controllers: `SalesExecutiveCallsController.cs`, `RecordingPlaybackController.cs`, `TwiMLController.cs`*

1. **Twilio WebRTC Softphone:**
   - Browser-based dialer using WebRTC tokens (`/api/voice/token`).
   - Live call controls: Dial, Hangup, Mute, Hold, Audio Device switcher.
2. **Call Outcome Modal:**
   - Pops up upon call termination with mandatory disposition selection:
     - `Interested`, `Follow-up Required`, `Not Interested`, `Wrong Number`, `Busy`, `No Response`, `Other`.
   - Mandatory note/reason required for edge-case dispositions (`Other`, `Contacted`).
3. **Call History & Recording Repository:**
   - Detailed logs with Contact Name, Number, Duration, Direction (Inbound/Outbound), Agent Name, Timestamp, and Recording link.
   - Integrated audio player with waveform scrubber, playback speed controls (1x, 1.25x, 1.5x, 2x), and download capability.
4. **Carrier Status Indicator:**
   - Shows live connection status to Twilio Programmable Voice or external SIP carriers.

---

### 2.9 Work Handover & Leave Management Subsystem
*Components: `LeaveRequestsPage.tsx`, `WorkHandoverPage.tsx`*  
*Controllers: `LeaveRequestsController.cs`, `WorkHandoverController.cs`, `WorkHandoverService.cs`*

1. **Leave Approval Workflow:**
   - Review pending leave applications submitted by Sales Executives and IRMs.
   - Inspect requested leave dates (Half-day morning/afternoon, Full-day, Multi-day).
   - Approve or reject leave requests with mandatory decision notes.
2. **Pre-Leave Work Handover Delegation:**
   - Before an agent goes on leave, their active workload (Leads, Pending Follow-ups, Consultations, Deals) can be temporarily handed over to an active colleague of the **same role**.
   - Workload Preview modal shows exact item counts before confirming handover.
3. **Coverage Execution (`work_handovers`):**
   - Automatically marks the original agent as "Covered" and the successor as "Covering".
   - Items carry `HandoverId` and `OriginalOwnerId` to preserve true historical ownership.
4. **Automated Return & Due Date Checker:**
   - Background service `HandoverDueDateCheckerService.cs` runs periodically.
   - Automatically returns handed-over workload to the original owner when the leave period expires, or alerts admin of overdue coverage.

---

### 2.10 Team & User Administration
*Component: `CompanyUsersPage.tsx` | Controller: `AdminUsersController.cs` & `AdminUserService.cs`*

1. **User Directory & Filtering:**
   - Search by name, email, phone, role code (`sales_executive`, `irm`, `company_admin`), and status (`Active`, `Invited`, `Disabled`).
2. **Instant Creation vs Email Invitation:**
   - **Instant Provisioning:** Creates user immediately with an auto-generated temporary password (`Nexus#XXXX!`).
   - **Email Invitation:** Dispatches an invitation email with a secure registration link via Google Gmail SMTP service (`IEmailService`).
3. **Dedicated Reset Password Engine (`POST /api/AdminUsers/{id}/reset-password`):**
   - **Database Password Update:** Securely hashes password via BCrypt (workFactor 11) and updates `users.PasswordHash`.
   - **Direct Login Guarantee:** Sets `user.MustChangePassword = false` so the user can immediately authenticate.
   - **Active Session Invalidation:** Immediately finds all active tokens in `user_sessions` for that user, sets `IsActive = false`, records `RevokedReason`, and broadcasts SignalR `SessionRevoked`.
   - **Custom Password Override:** Admins can either use the auto-generated password or type a custom password (min 6 chars) right from the modal.
4. **Role Transfer with Workload Handover (`/api/AdminUsers/{id}/transfer-role`):**
   - Transfer an agent's role (e.g. Sales Executive to IRM) while seamlessly migrating their active leads, follow-ups, and deals to a successor agent.
5. **Safe User Deletion with Strict Same-Role Successor Filtering (`DELETE /api/AdminUsers/{id}`):**
   - **Dynamic Workload Inspection:** Before deletion, the backend inspects open Leads, Follow-ups, Consultations, Deals, and Customers.
   - **Strict Successor Role Filter:**
     - Deleting an **IRM** strictly displays only other **IRMs** in the successor dropdown.
     - Deleting a **Sales Executive** strictly displays only other **Sales Executives**.
   - **Tailored Workload Breakdown:**
     - Sales Exec shows 3 cards: *Active Leads*, *Pending Follow-ups*, *Scheduled Consultations*.
     - IRM shows 5 cards: *My Leads*, *In Follow-up*, *KYC Queue*, *Opportunities*, *Converted*.
   - **Transactional Handover:** Reassigns all open records to the chosen successor in a single atomic database transaction before removing the user row.

---

### 2.11 Roles & Permissions (RBAC Matrix)
*Components: `CompanyUsersPage.tsx`, `Sidebar.tsx` | Service: `RoleService.cs`*

| Functional Domain | Permission Key | Description | Company Admin | Sales Exec | IRM |
| :--- | :--- | :--- | :---: | :---: | :---: |
| **Leads** | `leads.view` | View assigned/company leads | **Yes** (All) | **Yes** (Assigned) | **Yes** (Assigned) |
| | `leads.create` | Create new leads | **Yes** | **Yes** | **Yes** |
| | `leads.assign` | Assign / Reassign leads | **Yes** | No | No |
| | `leads.export` | Export leads to CSV | **Yes** | No | No |
| **Deals** | `deals.view` | View deals / opportunities | **Yes** | **Yes** (Own) | **Yes** (Own) |
| | `deals.create` | Create deals | **Yes** | **Yes** | **Yes** |
| | `deals.delete` | Delete deals | **Yes** | No | No |
| **Calls** | `calls.make` | Access WebRTC softphone | **Yes** | **Yes** | **Yes** |
| | `calls.view` | View call records | **Yes** (All) | **Yes** (Own) | **Yes** (Own) |
| | `calls.recordings.play` | Listen to call recordings | **Yes** | **Yes** (Own) | **Yes** (Own) |
| **Follow-ups** | `followups.view` | View follow-ups | **Yes** (All) | **Yes** (Own) | **Yes** (Own) |
| | `followups.create` | Schedule callbacks | **Yes** | **Yes** | **Yes** |
| **Users** | `users.view` | View team members | **Yes** | No | No |
| | `users.manage` | Create, invite, reset password | **Yes** | No | No |
| **Settings** | `settings.view` | View company configuration | **Yes** | No | No |
| | `settings.update` | Update company settings | **Yes** | No | No |
| **Audit** | `audit.view` | View company audit logs | **Yes** | No | No |

---

### 2.12 Reports & Analytics Engine
*Component: `ReportsPage.tsx` | Controller: `ReportsController.cs`*

1. **Agent Performance Matrix:**
   - Total Calls, Connected Calls, Total Talk Time, Average Duration, Conversion Rate by agent.
2. **Call Outcome Distribution:**
   - Breakdown of calls by disposition: Interested, Follow-up Required, Not Interested, Busy, Wrong Number.
3. **Pipeline Velocity & Conversion Time:**
   - Average days taken from initial lead creation to conversion or deal closure.
4. **Source Attribution:**
   - Performance ranking of inbound marketing channels (Meta Ads, Google Search, Referrals, Direct).

---

### 2.13 Organization Settings & Governance
*Component: `CompanySettingsPage.tsx` | Controller: `CompanySettingsController.cs`*

1. **Company Profile & Branding:**
   - Legal Name, Brand Color, Logo upload, Currency (`INR`), Timezone (`IST`).
2. **Business Hours Configuration:**
   - Define active operational hours (e.g. 09:30 AM – 06:30 PM). Out-of-hours calls route to voicemail or out-of-office disposition.
3. **Telephony & Recording Compliance:**
   - Global toggle for call recording enablement and recording disclosure consent.
4. **Lead SLA Thresholds:**
   - Configurable response SLA (e.g. 15 minutes / 1 hour) highlighting overdue uncontacted leads in orange/red alerts.

---

## 3. Sales Executive Architecture & Features

### 3.1 Navigation & Sidebar Architecture
When a user with `sales_executive` logs in, their interface is streamlined for focus and fast execution:

```
├── Dashboard (Sales Rep Command Center)
├── Sales
│   ├── Leads                   (My active leads & unassigned pool)
│   ├── Follow-ups              (Pending callback reminders with badge counter)
│   ├── Consultations           (Scheduled advisory discovery slots)
│   ├── Customers 360           (Accounts converted by this agent)
│   ├── Not - Interested        (Disqualified leads queue)
│   └── Junk                    (Invalid contact archive)
├── Calling
│   ├── Call Center             (Twilio WebRTC dialer & softphone)
│   └── Call History            (Personal call recordings & durations)
├── Analytics
│   ├── Reports                 (Personal target scorecard & call metrics)
│   └── Notifications           (Live system alerts)
├── Help and Support
│   ├── Chat                    (Internal team communications)
│   └── Smarty AI               (AI deal co-pilot)
└── Settings
    ├── Leave Requests          (Submit leave & nominate covering peer)
    ├── Call Settings           (Microphone & speaker device configuration)
    └── Profile                 (Personal profile & quota target)
```

---

### 3.2 Sales Rep Command Dashboard
*Component: `DashboardPage.tsx` (or `SalesExecutiveDashboard.tsx`)*

1. **Target Scorecard:**
   - Daily Calls Goal vs Completed (e.g. 42 / 60 Calls).
   - Talk Time Target (e.g. 2h 15m / 3h 00m).
   - Conversions / Handover Target (e.g. 4 / 6 Qualified Leads).
2. **Today's Action Queue:**
   - Follow-up reminders due today with countdown timers and instant dialer buttons.
   - Consultations scheduled for today.
3. **Live Unassigned Lead Counter:**
   - Shows newly arrived leads in the company pool ready for claiming.

---

### 3.3 My Leads & Unassigned Queue
*Component: `LeadsPage.tsx` | Controller: `SalesExecutiveLeadsController.cs`*

1. **Tabbed Workflow:**
   - **My Leads:** Leads explicitly assigned to this Sales Executive or covered during peer leave.
   - **Unassigned Pool:** Inbound leads not yet assigned to any agent, available for quick self-claiming.
2. **Lead Card / Row Attributes:**
   - Lead Name, Contact Number (with click-to-call icon), Email, Location, Lead Source, Status Badge, SLA Timer.
3. **SLA Response Indicator:**
   - Visual badge alerting the agent if a new lead has exceeded the company's first-response SLA window.
4. **Quick Filters & Search:**
   - Search by name, phone, or location. Filter by priority (`High`, `Medium`, `Low`) or source.

---

### 3.4 Lead Details & Activity Timeline
*Component: `LeadDetailsDrawer.tsx` / `LeadDetailsPage.tsx`*

1. **Complete Lead Dossier:**
   - Contact identifiers, notes, property/wealth interests, custom fields, and tags.
2. **Interactive Activity Feed:**
   - Chronological log of every call attempt, recording audio player, note added, or status transition.
3. **Quick Action Bar:**
   - `Call Lead`, `Schedule Follow-up`, `Book Consultation`, `Convert / Handover`.

---

### 3.5 Calling Engine & Call Outcome Dispositions
*Components: `CallCenterPage.tsx`, `CallOutcomeModal.tsx` | Controller: `SalesExecutiveCallsController.cs`*

1. **Outbound Calling Flow:**
   - Click phone number ➔ WebRTC dialer initiates connection ➔ Audio connected ➔ Timer counts live talk-time.
2. **Mandatory Call Disposition Workflow:**
   - When the call concludes, the **Call Outcome Modal** enforces immediate disposition recording:
     - **`Interested`:**
       - Lead is marked qualified.
       - Any open sales follow-ups are closed.
       - Lead bridges into the IRM pipeline for investor wealth profiling.
     - **`Follow-up Required`:**
       - Opens follow-up scheduling inputs (Date, Time, Priority, Agenda).
       - Automatically registers a pending callback in `followups`.
     - **`Not Interested`:**
       - Prompts for disposition reason (Budget mismatch, Not looking now, Location constraint).
       - Moves lead to `Not-Interested` desk and removes active follow-up clutter.
     - **`Wrong Number` / `Junk`:**
       - Routes lead to `Junk` desk and flags phone number.
     - **`Busy` / `No Response`:**
       - Increments attempt counter and sets suggested callback.
     - **`Other`:**
       - Enforces mandatory custom note explaining the unique situation.

---

### 3.6 Follow-up Execution & Reminders
*Component: `FollowupsPage.tsx` | Controller: `SalesExecutiveFollowupsController.cs`*

1. **Dynamic Pending Counter Badge:**
   - Sidebar displays live badge count of follow-ups assigned to the agent that are due today or overdue.
2. **One-Click Call Trigger:**
   - Clicking call button launches softphone directly with the contact's phone and attaches the call record to the follow-up.
3. **Reschedule & Complete Options:**
   - Easily reschedule with date picker if client requests another time slot.

---

### 3.7 Consultations & Discovery Desk
*Component: `ConsultationsPage.tsx` | Controller: `SalesExecutiveConsultationsController.cs`*

1. **Book Discovery Slots:**
   - When a prospect is ready for an advisory session, book a consultation slot selecting client date/time.
2. **Meeting Notes:**
   - Attach agenda items, client investment preferences, and background information for the consultant.

---

### 3.8 Customer Flow & Conversions
*Component: `CustomersPage.tsx` | Controller: `SalesExecutiveCustomersController.cs`*

1. **Converted Client Dossiers:**
   - Displays all leads successfully converted into customer accounts by this agent.
2. **Long-Term Relationship Notes:**
   - Maintain client preferences and relationship history for future repeat business.

---

### 3.9 Not-Interested & Junk Archival Desks
*Components: `NotInterestedPage.tsx`, `JunkPage.tsx`*

1. **Isolated Desks:**
   - Prevents disqualified leads from cluttering the active pipeline while preserving complete call logs and reasons.
2. **Restoration Capability:**
   - If an old lead re-engages, the agent or admin can restore the lead back to active status with a single click.

---

### 3.10 Peer Coverage & Work Handover Responsibilities
*Component: `SalesLayout.tsx` | Controller: `WorkHandoverUserController.cs`*

1. **Active Coverage Top Banner:**
   - When covering for an absent peer, a sticky top banner appears:
     ```
     "Active Coverage Mode: You are temporarily covering for Naveen until 20 Oct."
     ```
2. **Covered Items Tag:**
   - Handed-over leads and follow-ups are marked with a distinct badge (`Covering Naveen`), enabling the agent to prioritize their absent colleague's client SLAs.
3. **Seamless Relinquishment:**
   - Once the leave period ends or the admin returns the handover, covered items return to the original agent automatically.

---

### 3.11 Personal Leave Requests & Scorecard
*Components: `LeaveRequestsPage.tsx`, `ProfilePage.tsx` | Controller: `LeaveRequestsController.cs`*

1. **Leave Application:**
   - Submit leave requests (Casual, Sick, Annual, Half-Day).
   - Nominate a covering colleague from active Sales Executives.
   - Track leave approval status and leave balance in real-time.
2. **Agent Scorecard (`/profile`):**
   - Personal metrics: Total Calls, Average Talk Time, Qualified Leads, Won Deals, and Customer Rating.

---

## 4. Shared & Cross-Functional Platform Features

### 4.1 Multi-Tenant Context & Data Isolation
1. **Tenant Identification:**
   - Incoming HTTP requests resolve tenant via JWT claim `company_id`, query parameter `companyId`, or header `x-tenant-id`.
2. **Database Query Filtering:**
   - Every database query across `Leads`, `Deals`, `Customers`, `CallRecords`, `Followups`, `Users`, and `AuditLogs` is strictly scoped by `CompanyId`.
3. **Tenant-Level Customization:**
   - Dynamic branding (Logo, Accent Color), enabled features list, and localized business hours.

---

### 4.2 WebRTC Softphone & Real-Time Telephony Infrastructure
1. **Twilio Voice Integration:**
   - Client fetches JWT capabilities token via `/api/voice/token`.
   - Browser WebRTC softphone communicates directly with Twilio Voice Gateways.
2. **Audio Waveform & Playback Engine:**
   - Audio recordings stored on secure cloud object storage (DigitalOcean Spaces / AWS S3).
   - Proxied through `/api/voice/recordings/stream` with range-request streaming support, seekable waveform, and playback speed adjustment.
3. **Audio AI Transcription:**
   - Automated speech-to-text pipeline generates transcripts and keyword summaries for completed calls.

---

### 4.3 Real-Time WebSocket Infrastructure (SignalR PlatformHub)
*Hub: `PlatformHub.cs` | Client Service: `signalRService.ts`*

The platform maintains persistent WebSocket connections for real-time synchronization:

| Event Name | Payload | Trigger / Purpose |
| :--- | :--- | :--- |
| `SessionRevoked` | `{ reason, userId }` | Triggered when admin resets password or revokes sessions; forces instant client logout. |
| `LeadAssigned` | `{ leadId, agentId }` | Alerts an agent instantly when new leads are allocated to their queue. |
| `HandoverStarted` | `{ handoverId, originalUserId, coveringUserId }` | Activates peer coverage banners across the interface. |
| `HandoverEnded` | `{ handoverId }` | Deactivates coverage mode and refreshes queues. |
| `AnnouncementBroadcast` | `{ announcement }` | Delivers real-time critical/info broadcast banners to all active users. |

---

### 4.4 Smarty AI Assistant & LLM Tool Calling
*Component: `SmartyAIPage.tsx` / `SmartyAiDrawer.tsx` | Controller: `AiAssistantController.cs`*

1. **CRM Intelligence Co-Pilot:**
   - Natural language queries (e.g. *"Show my high-priority follow-ups for today"* or *"What was the outcome of my last call with Rajesh?"*).
2. **Deterministic LLM Tool Calling:**
   - Connects to OpenAI-compatible LLM backends with structured tool execution:
     - `search_leads`: Finds matching prospects.
     - `get_followups`: Retrieves scheduled callbacks.
     - `get_call_history`: Pulls recording transcripts and outcome notes.

---

### 4.5 Security Events & Centralized Audit Trail
*Controller: `AuditLogsController.cs`*

1. **Security Event Logging:**
   - Records every `LOGIN_SUCCESS`, `LOGIN_FAILURE`, `PASSWORD_RESET_ADMIN`, and `SESSION_REVOKED` with IP address, user agent, and timestamp in `security_events`.
2. **Operational Audit Trail:**
   - Logs modifications across `Leads`, `Deals`, `Users`, and `Handovers` in `audit_logs` capturing `ActorEmail`, `Action`, `EntityId`, and `Details`.

---

### 4.6 Background Automation Jobs
1. **`HandoverDueDateCheckerService.cs`:**
   - Hourly background daemon checking active work handovers past their `PlannedEndAt` date.
   - Automatically executes return handovers or dispatches administrative reminders.
2. **`LeaveReminderBackgroundService.cs`:**
   - Daily cron job sending morning notifications to team members regarding scheduled leaves and active coverage.

---

## 5. Complete API Endpoint & Controller Matrix

### 5.1 GHL Admin Endpoints

| HTTP Verb | Route | Controller | Functionality |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/AdminUsers?companyId={id}` | `AdminUsersController` | List company users with leave and coverage status |
| `POST` | `/api/AdminUsers?companyId={id}` | `AdminUsersController` | Create new user or dispatch email invite |
| `PUT` | `/api/AdminUsers/{id}` | `AdminUsersController` | Update user details, role, and status |
| `POST` | `/api/AdminUsers/{id}/reset-password` | `AdminUsersController` | Reset password (BCrypt), clear MustChangePassword, revoke sessions |
| `POST` | `/api/AdminUsers/{id}/transfer-role` | `AdminUsersController` | Change user role and migrate workload |
| `DELETE` | `/api/AdminUsers/{id}?handoverToUserId={id}`| `AdminUsersController` | Safely delete user with same-role workload handover |
| `GET` | `/api/AdminUsers/{id}/workload` | `AdminUsersController` | Get workload counts (3 cards for Sales, 5 for IRM) |
| `GET` | `/api/ghl/agents` | `GhlLeadAssignmentController` | List agents eligible for lead allocation |
| `POST` | `/api/ghl/leads/assign` | `GhlLeadAssignmentController` | Manually assign multiple leads to an agent |
| `POST` | `/api/ghl/leads/reassign` | `GhlLeadAssignmentController` | Reassign leads to another agent |
| `POST` | `/api/ghl/leads/auto-assign` | `GhlLeadAssignmentController` | Round-robin auto-assignment skipping on-leave agents |
| `GET` | `/api/ghl/archived-leads` | `GhlLeadAssignmentController` | Retrieve disqualified leads archive |
| `GET` | `/api/ghl/handover/candidates` | `WorkHandoverController` | List same-role handover candidates |
| `POST` | `/api/ghl/handover/preview` | `WorkHandoverController` | Preview handover workload counts |
| `POST` | `/api/ghl/handover/start` | `WorkHandoverController` | Start active work handover |
| `POST` | `/api/ghl/handover/{id}/return` | `WorkHandoverController` | Complete and return work handover |
| `GET` | `/api/LeaveRequests` | `LeaveRequestsController` | View all employee leave applications |
| `POST` | `/api/LeaveRequests/{id}/decide` | `LeaveRequestsController` | Approve or reject employee leave |
| `GET` | `/api/ghl/deals` | `GhlDealsController` | Retrieve pipeline deals across stages |
| `POST` | `/api/ghl/deals` | `GhlDealsController` | Create or update deal stage |

---

### 5.2 Sales Executive Endpoints

| HTTP Verb | Route | Controller | Functionality |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/sales-executive/dashboard` | `SalesExecutiveDashboardController` | Fetch personal target metrics and queues |
| `GET` | `/api/sales-executive/leads` | `SalesExecutiveLeadsController` | List my assigned leads and unassigned pool |
| `GET` | `/api/sales-executive/leads/{id}` | `SalesExecutiveLeadsController` | Get lead details and activity history |
| `POST` | `/api/sales-executive/calls` | `SalesExecutiveCallsController` | Log call record and outcome disposition |
| `GET` | `/api/sales-executive/calls` | `SalesExecutiveCallsController` | List my call records and recordings |
| `GET` | `/api/sales-executive/followups` | `SalesExecutiveFollowupsController` | List scheduled follow-ups with pending badge |
| `POST` | `/api/sales-executive/followups` | `SalesExecutiveFollowupsController` | Schedule new callback interaction |
| `GET` | `/api/sales-executive/consultations`| `SalesExecutiveConsultationsController` | List scheduled advisory discovery sessions |
| `POST` | `/api/sales-executive/consultations`| `SalesExecutiveConsultationsController` | Book new consultation slot |
| `GET` | `/api/sales-executive/customers` | `SalesExecutiveCustomersController` | List converted customer accounts |
| `GET` | `/api/LeaveRequests/my-requests` | `LeaveRequestsController` | View my personal leave applications |
| `POST` | `/api/LeaveRequests/my-requests` | `LeaveRequestsController` | Apply for leave with nominated covering peer |
| `GET` | `/api/LeaveRequests/my-balance` | `LeaveRequestsController` | Check remaining leave balances |
| `GET` | `/api/ghl/handover/my-status` | `WorkHandoverUserController` | Check if currently covered or covering a peer |

---

### 5.3 Shared Endpoints

| HTTP Verb | Route | Controller | Functionality |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | `AuthController` | Authenticate user, issue JWT token & Jti |
| `POST` | `/api/auth/logout` | `AuthController` | Invalidate active user session |
| `GET` | `/api/voice/token` | `VoiceTokenController` | Generate Twilio WebRTC capabilities token |
| `GET` | `/api/voice/recordings/stream/{id}`| `RecordingPlaybackController` | Stream call audio with seekbar support |
| `POST` | `/api/ai/chat` | `AiAssistantController` | Query Smarty AI with tool-augmented retrieval |
| `GET` | `/api/health` | `HealthController` | Database and carrier connectivity healthcheck |

---

## 6. Merge & Regression Checklist

When merging branches into `main` or `vishnu-dev`, verify every item below to guarantee zero feature regression:

- [ ] **Reset Password:**
  - `POST /api/AdminUsers/{id}/reset-password` responds with `tempPassword`.
  - Old password fails immediately (`401 Unauthorized`).
  - New password succeeds immediately.
  - Active sessions in `user_sessions` marked `IsActive = false`.
  - `MustChangePassword` is `false`.
- [ ] **Safe Deletion & Handover Recipient Filtering:**
  - Deleting an IRM shows **only** IRMs in the successor list.
  - Deleting a Sales Exec shows **only** Sales Execs in the successor list.
  - Sales Exec deletion displays 3 workload cards (*Leads*, *Follow-ups*, *Consultations*).
  - IRM deletion displays 5 workload cards (*My Leads*, *In Follow-up*, *KYC*, *Opportunities*, *Converted*).
- [ ] **Lead Assignment Engine:**
  - Manual assignment assigns leads and migrates pending follow-ups.
  - Auto-assignment skips agents on approved leave or under active coverage.
  - Concurrency tokens prevent race conditions during bulk assignment.
- [ ] **Telephony & Outcome Tagging:**
  - `Interested` disposition bridges lead into IRM queue and cleans open sales follow-ups.
  - `Follow-up Required` registers scheduled callback.
  - `Not Interested` routes lead to `/archived-leads` and stores disposition note.
- [ ] **Work Handover & Leave Decisions:**
  - Approved leave creates handover item tracking original owner.
  - Background service checks overdue returns cleanly.
- [ ] **Test Coverage:**
  - Frontend Vitest suite: 70/70 tests passing (`npm test`).
  - Backend xUnit suite: 16/16 tests passing (`dotnet test`).
  - TypeScript compilation: 0 errors (`npx tsc --noEmit`).
