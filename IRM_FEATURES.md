# Investor Relations Manager (IRM) – Complete Feature Inventory & Specification

> **Document Version:** 1.0  
> **Target Role:** Investor Relations Manager (`irm`)  
> **Tenant Ecosystem:** GHL India Ventures (Investment & Wealth Management)  
> **Repository:** `VishnuNagarajanS/sales_rep_app`  
> **Last Updated:** October 2026  

---

## 1. Executive Summary & Role Definition

The **Investor Relations Manager (IRM)** role is a specialized persona in the Nexus platform tailored for **High-Net-Worth Individual (HNI)** client acquisition, institutional wealth management, regulatory compliance (SEBI/PMLA), and private market capital mobilization.

Unlike standard Sales Executives who handle high-volume preliminary leads, an IRM:
- Takes qualified handovers from the outbound sales team (`Interested` status).
- Conducts in-depth investor profiling and suitability assessments.
- Orchestrates and verifies SEBI-compliant **KYC** workflows (self-service & assisted).
- Structures investment commitments, validates ticket sizes, and closes **Investment Opportunities**.
- Manages long-term investor portfolios within **Investor 360**.
- Operates under strict **Pipeline Stage Isolation** to guarantee zero data duplication across functional stages.

---

## 2. IRM Navigation & Module Architecture

When an authenticated user with role `irm` logs into the platform, the dynamic sidebar presents a tailored navigation layout:

```
├── Dashboard (Dedicated IRM Dashboard)
├── Investors
│   ├── All Leads               (Global lifecycle inventory across all stages)
│   ├── My Leads                (Newly assigned 'Interested' handover queue)
│   ├── Follow-up               (Scheduled callbacks & nurturing queue)
│   ├── KYC                     (Verification desk & assisted onboarding)
│   ├── Opportunities           (High-ticket deals & investment amount confirmation)
│   ├── Investor 360            (Converted investor dossiers & AUM tracking)
│   ├── Other                   (Special call outcome & edge-case repository)
│   └── Pipeline                (Kanban visualization of the 5-stage lifecycle)
├── Calling
│   ├── Call Center             (Twilio WebRTC softphone & dialer)
│   └── Call History            (Call logs, recordings & durations)
├── Analytics
│   ├── Reports                 (Capital mobilization, KYC funnel & disposition reports)
│   └── Notifications           (Real-time SignalR notifications)
├── Help & Support
│   ├── Chat                    (Internal team communications)
│   └── Smarty AI               (AI assistant for deal insights & workflows)
└── Settings
    ├── Call Settings           (Microphone, speaker & device selection)
    └── Profile                 (Agent metrics, AUM target & performance scorecard)
```

---

## 3. Module-by-Module Feature Breakdown

### 3.1. Dedicated IRM Dashboard (`/dashboard`)
*Component: `IrmDashboardView.tsx`*

The IRM Dashboard serves as the daily command center with real-time financial tracking and task execution:

- **Capital Mobilization & AUM Tracker:**
  - Dynamic **Committed AUM** calculation dynamically computed across won opportunities, converted deals, and active Investor 360 entries.
  - **AUM Target Progress Bar** comparing current mobilized capital against annual/quarterly quota (e.g. ₹2.5 Cr baseline).
  - Indian currency notation formatter (e.g. `₹1.50 Cr`, `₹45.0 L`).
- **KYC Pipeline Status Counter:**
  - Cards for **Verified**, **Under Review**, and **Pending Action** KYC applications.
- **Leads & Pipeline Overview:**
  - Real-time counts of Active Leads, Open Deals, and Conversions.
- **Call & Communication Summary:**
  - Total Calls Made, Inbound vs Outbound breakdown, Average Call Duration.
- **Dual Tab Schedule Queue:**
  - **Follow-ups Tab:** Instant list of pending reminders due today with 1-click dialer and direct reschedule.
  - **Consultations Tab:** Scheduled investor discovery meetings and advisory slots.
- **Quick Action Triggers:**
  - Direct modals for `+ New Lead`, `+ Schedule Follow-up`, `+ Book Consultation`, and `+ New Deal`.
- **Live Event Synchronization:**
  - Automatically refreshes via `nexus_storage_updated` and `nexus_call_logged` custom events.

---

### 3.2. All Leads Directory (`/all-leads`)
*Component: `AllLeadsPage.tsx` | Controller: `IrmAllLeadsController.cs`*

An aggregated, multi-stage lead inventory giving the IRM 360° visibility over every prospect ever assigned to them:

- **Lifecycle Stage Tabs:**
  - Filter across: `All`, `My Leads`, `Follow-up`, `KYC`, `Opportunities`, `Converted`.
  - Dynamic stage badge counters update automatically as filters change.
- **Agent & Attribution Filters:**
  - Filter leads by assigner / creator (e.g., "Created by IRM" vs. "Handed over by Sales Agent").
  - Identifies originating sales executives to credit sourcing pipelines.
- **Direct Action & Navigation:**
  - Stage deep-linking: Clicking on a stage pill navigates directly to that specific module (e.g., clicking KYC badge navigates to `/kyc`).
  - Integrated click-to-call softphone launch directly from table rows.
- **Strict Role Isolation:**
  - Backend enforces that IRM agents can **only** inspect leads assigned to their user ID, even when manipulating query parameters.

---

### 3.3. My Leads (`/leads`)
*Component: `LeadsPage.tsx` | Service: `LeadService.cs`*

The intake inbox for high-intent prospects:

- **Handover Ingestion:**
  - Displays leads that have transitioned from outbound prospecting to `Interested` status and assigned to the logged-in IRM.
- **Strict Stage Isolation Rule:**
  - As soon as an IRM schedules a follow-up or advances the contact, the lead's status moves away from `Interested` (e.g., to `Follow-up Required`), automatically clearing it from "My Leads" into the "Follow-up" queue.
- **Prospect Dossier:**
  - Lead contact details, location, source, investment capacity, notes, and activity timeline.
  - Quick action buttons to dial, email, or schedule next interactions.

---

### 3.4. Follow-up Management (`/followups`)
*Component: `FollowupsPage.tsx` | Service: `FollowupService.cs`*

A structured reminder and task management system tailored to investor relationship nurturing:

- **Automatic Deduplication & Single-Active-Reminder Invariant:**
  - When scheduling a new follow-up for a contact, existing pending follow-ups for that contact are marked as `Completed` with note: *"Superseded by follow-up scheduled for [Date]"*.
- **Cross-Stage Isolation & Auto-Completion:**
  - When an investor advances from Follow-up to **KYC** or **Investment Opportunity**, stale pending follow-ups are automatically completed with note: *"Auto-completed: contact advanced to KYC/Opportunity stage"*.
- **Quick Outcomes & Notes:**
  - Log follow-up results (`Completed`, `Rescheduled`, `Cancelled`) with timestamped notes.
- **Call Center Integration:**
  - One-click click-to-call directly opens the Twilio WebRTC dialer and attaches call notes upon disposition.

---

### 3.5. KYC (Know Your Customer) Suite (`/kyc`)
*Component: `KYCPage.tsx` | Controller: `IrmKycController.cs` | Service: `KycService.cs`*

An enterprise-grade, SEBI/PMLA-compliant digital onboarding and identity verification engine:

#### A. Dual Onboarding Modes
1. **Self-Service Customer KYC (Link Flow):**
   - IRM sends a secure, tokenized KYC onboarding link to the investor via Email/SMS.
   - Public link with expiration timestamp (`KycLinkExpiresAt`) and token hashing.
   - Mandatory **Email OTP Verification** before allowing final submission.
   - Revoke and Resend link actions with one click.
2. **Assisted KYC (In-Person / Call-Assisted Flow):**
   - IRM enters details on behalf of the investor directly from the CRM desk.
   - Draft autosave functionality (`/api/irm/kyc/assisted-draft`).
   - **Customer Consent Verification:** Hard requirement confirming explicit customer consent timestamp before submission.

#### B. 5-Step Digital Form Schema
1. **Step 1: Personal Details:** Full Name, DOB, Father's Name, Gender, Investor Type (Individual, Corporate, NRI, Trust), Resident Type, Occupation.
2. **Step 2: Identity & Address:** PAN number, Aadhaar number, Address Line 1 & 2, City, State, Pincode, Country.
3. **Step 3: Banking & Demat:** Bank Name, Account Number, IFSC Code, Account Type, Demat Account Number, DP ID (NSDL / CDSL).
4. **Step 4: Nominee Details:** Up to 3 nominees with Name, Relationship, DOB, Allocation %, Guardian info if minor.
5. **Step 5: Document Uploads & Live Photo:** PAN Card scan, Aadhaar Front/Back, Cancelled Cheque / Bank Statement, Demat Master Slip, Passport-size Photo, Webcam Face Match.

#### C. Manual Verification Desk & Checklist
- **Permission Check:** Requires authenticated `kyc.verify` claim.
- **Verification Checklist:**
  - Identity Check (PAN/Aadhaar format and name match).
  - Bank Account Verification (IFSC & Cheque matching).
  - Document Authenticity Check.
  - Demat Account Matching.
  - Nominee Verification (if declared).
- **Status Decisions:**
  - `Verified` (Approved) → Advances linked deal to `investment_opportunity`.
  - `Wrong` / `Needs Correction` → Requires mandatory comment and flags specific sections (e.g. `pan, bank`) for re-upload.
  - `Pending Review`.
- **Per-Section Verification Drafts:**
  - Ability to independently mark Aadhaar, PAN, or Bank sections as `verified` or `wrong` with itemized reasons.

---

### 3.6. Investment Opportunities (`/opportunities`)
*Component: `OpportunitiesPage.tsx` | Controller: `GhlDealsController.cs`*

Deal execution module for high-ticket investor allocations:

- **Pipeline Stages:**
  - `Enquiry` → `Contacted` → `Consultation` → `Qualified` → `Opportunity` → `Committed` → `Closed Won` → `Closed Lost`.
- **Investment Amount Lifecycle:**
  - Input target commitment amount.
  - Formal **Investment Amount Confirmation Modal**: Requires explicit confirmation of the mobilized capital before deal closure.
  - Amount editing guard with warning dialogs.
- **1-Click Conversion to Investor 360:**
  - Once funds/term sheets are finalized, clicking **Convert to Investor 360**:
    - Creates or updates the linked entity in the PostgreSQL `Investors` table.
    - Transitions deal stage to `converted` / `Closed Won`.
    - Automatically appends activity audit log entry.
    - Notifies the platform fleet via SignalR.
- **Stage Aging Metric:**
  - Automatically calculates "Days in Stage" to flag stalled opportunities.

---

### 3.7. Investor 360 (`/investors`)
*Component: `InvestorsPage.tsx` | Repository: `InvestorRepository.cs`*

Comprehensive wealth portfolio and relationship ledger:

- **Investor Dossier (Drawer View):**
  - **Overview Tab:** Committed AUM, Investment Mandate, Investment Capacity, Risk Tolerance (Conservative, Moderate, Aggressive), Preferred Asset Class (Private Equity, Commercial Real Estate, Pre-IPO, Structured Debt), Referral Source, Notes.
  - **Calls Tab:** Complete history of calls with audio playback, duration, and disposition.
  - **Consultations Tab:** Scheduled and completed advisory sessions.
  - **Opportunities Tab:** Active and past deals linked to this investor.
  - **Follow-ups Tab:** Active and completed task history.
  - **Documents Tab:** Investor-specific identity docs + access to shared company collateral.
- **Export Facility:**
  - One-click CSV export using `papaparse` for audit and external compliance reporting.
- **Data Integrity:**
  - Unified on the `Investors` database table with stable backend IDs (no mock data fallback).

---

### 3.8. IRM "Other" Disposition Hub (`/other`)
*Component: `IrmOtherPage.tsx` | Controller: `IrmOtherController.cs` | Service: `IrmOtherService.cs`*

Specialized compliance and operational tracking for unorthodox call outcomes:

- **Purpose:**
  - When an IRM marks a call outcome as "Other" in any module (Follow-up, KYC, Opportunities, Investor 360), the interaction is logged here to prevent dropped conversations.
- **Module Attribution Tabs:**
  - Filter across `All`, `Follow-up`, `KYC`, `Opportunities`, `Investor 360`.
- **Contextual Details:**
  - Captures custom reason, agent name, timestamp, and contact metadata.
- **Drawer Inspection & Redial:**
  - View full history drawer and redial the contact directly from the table.

---

### 3.9. Pipeline Kanban (`/pipeline`)
*Component: `PipelinePage.tsx` | Controller: `IrmPipelineController.cs`*

Visual drag-and-drop workflow tracking for GHL IRMs:

- **5 Canonical IRM Stages:**
  1. **Leads (`leads`):** Qualified handovers from sales or direct high-ticket IRM leads.
  2. **Follow-up (`followup`):** Nurturing HNIs, family offices, and institutional investors.
  3. **Qualified Investor (`qualified_investor`):** SEBI compliance checked, ticket size verified, KYC validated.
  4. **Investment Opportunity (`investment_opportunity`):** Pitch deck shared, term sheet under review, legal team active.
  5. **Converted (`converted`):** Agreement signed, funds transferred to fund.
- **Drag & Drop Stage Movement:**
  - Calls `PUT /api/irm/pipeline/{cardId}/move` with stage validation.
  - Permission checks ensure IRM agents cannot modify other agents' pipeline cards.
- **Activity Log Drawer:**
  - Log notes, calls, emails, and meetings attached to each card.

---

### 3.10. Calling & Softphone Suite (`/call-center`, `/call-history`)
*Components: `CallCenterPage.tsx`, `CallHistoryPage.tsx`, `CallCenterComponents.tsx`*

Integrated cloud telephony powered by Twilio WebRTC:

- **Browser Dialer (WebRTC Softphone):**
  - Integrated dial pad with national & international phone normalization (+91 E.164).
  - Live call states: `Ringing`, `In-Call`, `Mute`, `Hold`, `Keypad DTMF`, `Hang Up`.
- **Call Disposition & Wrap-up Drawer:**
  - Triggers immediately upon call termination.
  - Standard dispositions: `Interested`, `Callback Requested`, `Follow-up Required`, `Wrong Number`, `No Response`, `Other`.
  - Captures call notes and auto-schedules subsequent tasks.
- **Call History & Recording Playback:**
  - Chronological call log with duration, call direction (Inbound/Outbound), status, and cloud audio recording playback.
- **Hardware Configuration (`/call-settings`):**
  - Select active microphone, speaker output, and ringtone audio devices.

---

### 3.11. Dedicated IRM Reports (`/reports`)
*Component: `IrmReportsView.tsx`*

Executive analytics tailored to investment relationship metrics:

- **Tab 1: Capital Mobilization & AUM Metrics (`capital`):**
  - Total Mobilized AUM.
  - Average Deal Size / Ticket Size.
  - Quota Achievement Percentage.
  - Closed Won vs Lost ratios.
- **Tab 2: KYC Conversion Funnel (`kyc`):**
  - Stage conversion rate from Link Sent → Submitted → Verified.
  - Average verification turnaround time.
  - Defect rate (applications marked "Wrong" or "Needs Correction").
- **Tab 3: Communication & Dispositions (`dispositions`):**
  - Call volume vs connect rate.
  - Call outcome distribution pie chart.
  - "Other" reason categorization frequency.
- **Date Filters:**
  - `This Week`, `This Month`, `This Quarter`, `All Time`.

---

### 3.12. IRM Profile & Scorecard (`/profile`)
*Component: `IrmProfileView.tsx`*

The individual performance dashboard for the logged-in IRM:

- **Personal Metrics:**
  - Total Target AUM vs. Realized AUM.
  - Active Deal Count and Pipeline Value.
  - Total Call Count, Talk Time, and Average Call Duration.
  - KYC Verification Score (number of investors successfully onboarded).
- **Personal Information & Credentials:**
  - Name, Email, Phone, Company attribution, Role code display.

---

### 3.13. Collaboration & Productivity Tools
- **Internal Team Chat (`/chat`):** Real-time text messaging, thread support, attachment sharing, and unread notification badges.
- **Smarty AI Assistant (`/smarty-ai`):** Context-aware AI assistant leveraging Groq LLM to summarize deal histories, suggest follow-up schedules, and explain compliance rules.
- **Notifications Hub (`/notifications`):** SignalR-driven instant alert feed for lead assignments, KYC submissions, and deal updates.

---

## 4. Administrative Governance & Workload Coverage

### 4.1. Temporary IRM Coverage & Reassignment
*Controller: `IrmReassignmentController.cs`*

To prevent missed follow-ups or compliance delays when an IRM takes leave:
- Company Admins can assign **Coverage Reassignment** from `OriginalIrm` to `CoveringIrm`.
- Automatically transfers:
  - Active Leads
  - Pending Follow-ups
  - In-flight KYC applications
  - Open Deals & Investment Opportunities
  - Investor 360 contacts
- Tracks coverage state via `IrmCoverageAssignments` table with timestamp and reason.
- **One-Click Revert:** Once leave concludes, the admin clicks **End Coverage**, which automatically restores all records back to the original IRM.

---

## 5. Summary Table: IRM Backend API Endpoints

| Category | HTTP Method | Endpoint | Description |
|---|---|---|---|
| **All Leads** | `GET` | `/api/irm/all-leads` | Multi-stage leads inventory for assigned IRM |
| **KYC** | `GET` | `/api/irm/kyc/all` | List all KYC applications with optional status filter |
| **KYC** | `GET` | `/api/irm/kyc/{id}` | Retrieve comprehensive KYC details by ID |
| **KYC** | `POST` | `/api/irm/kyc/send-link` | Generate and dispatch secure KYC onboarding link |
| **KYC** | `POST` | `/api/irm/kyc/assisted-draft` | Save auto-draft of assisted KYC without final submit |
| **KYC** | `POST` | `/api/irm/kyc/assisted-submit` | Finalize assisted KYC submission with verified consent |
| **KYC** | `PATCH` | `/api/irm/kyc/{id}/status` | Update KYC status (Verified, Wrong, Pending) with checklist |
| **KYC** | `PATCH` | `/api/irm/kyc/{id}/verification`| Save per-section check marks (Aadhaar, PAN, Bank) |
| **KYC** | `POST` | `/api/irm/kyc/{id}/resend-link` | Resend valid link to investor |
| **KYC** | `POST` | `/api/irm/kyc/{id}/revoke-link` | Invalidate active KYC token |
| **KYC (Public)**| `POST` | `/api/irm/kyc/otp/send` | Send investor OTP for self-service verification |
| **KYC (Public)**| `POST` | `/api/irm/kyc/otp/verify` | Verify investor OTP |
| **KYC (Public)**| `POST` | `/api/irm/kyc/submit` | Public submission of investor self-service form |
| **Other** | `GET` | `/api/irm/other` | Retrieve call records marked with "Other" outcome |
| **Other** | `GET` | `/api/irm/call-outcomes` | Retrieve standard allowed outcomes per module |
| **Pipeline** | `GET` | `/api/irm/pipeline` | Fetch Kanban board cards for the IRM |
| **Pipeline** | `PUT` | `/api/irm/pipeline/{cardId}/move` | Move card across pipeline stages |
| **Pipeline** | `POST` | `/api/irm/pipeline/{cardId}/activity`| Log card note or interaction |
| **Coverage** | `POST` | `/api/irm/admin/reassign` | Reassign IRM portfolio during leave |
| **Coverage** | `POST` | `/api/irm/admin/coverage/end` | Revert coverage back to primary IRM |
