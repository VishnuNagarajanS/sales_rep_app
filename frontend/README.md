# NexusSales — Frontend Application

**NexusSales** is a multi-tenant Sales Engagement, CRM, and Telephony Cockpit built with **React 19**, **TypeScript**, and **Vite**.

> For the comprehensive architectural guide, user personas, and complete module specifications, refer to [Frontend_Architecture_and_User_Guide.md](../Frontend_Architecture_and_User_Guide.md).

---

## Quick Start (Frontend Standalone / Demo Mode)

No backend or database setup is required to run the frontend. It includes a built-in offline mock data engine (`storageService` via `localStorage`) with full persona switching.

```bash
# 1. Install dependencies
npm install

# 2. Start the development server
npm run dev
```

Open your browser at **`http://localhost:5173`**.

---

## Core Features

- **Multi-Tenant Dynamic Specialization**:
  - **GHL India Ventures**: Institutional Wealth, Investors, Consultations, and Investment Opportunities.
  - **Jamin Bazaar**: Plotted Communities, Master Layouts, Interactive Plot Grids, Site Visits, and Token Bookings.
- **Embedded Telephony**:
  - Global persistent In-Call Bar across all pages.
  - Live call duration timer, mute, hold, and quick notes.
  - Live webcam preview (`navigator.mediaDevices.getUserMedia`) and Google Meet integration.
  - Post-call disposition modal with automated task rescheduling.
  - Call recordings playback with audio waveforms and AI transcriptions.
- **Customer 360 Cockpit**: Split-view relationship management with unified activity timeline, linked deals, follow-up calendar, and document repository.
- **Role Scoping**: Persona-based access for Super Admin, Company Admin, Sales Manager, and Sales Executive.

---

## Technology Stack

- **Framework**: React 19 + TypeScript
- **Bundler**: Vite 8
- **Styling**: Vanilla CSS Design Tokens (Dark/Light mode, Glassmorphism, CSS Variables)
- **Icons**: Lucide React
- **CSV Processing**: PapaParse
- **State & Telephony**: React Context API (`AuthContext`, `CallContext`) + LocalStorage
