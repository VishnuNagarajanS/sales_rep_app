import React from 'react';
import { Sparkles, CheckCircle2, Shield } from 'lucide-react';
import { FEATURES } from '../../../constants/features';
import './PlatformFeaturesPage.css';

export const PlatformFeaturesPage: React.FC = () => {
  const catalog = [
    { key: FEATURES.LEADS, name: 'Inbound Leads Management', cat: 'Sales Core', desc: 'Custom fields, stage qualification, CSV bulk import & conversion.' },
    { key: FEATURES.CUSTOMERS, name: 'Customer 360 Records', cat: 'Sales Core', desc: 'Unified contact timeline, past deals, and call history.' },
    { key: FEATURES.DEALS, name: 'Deals & Pipeline Kanban', cat: 'Sales Core', desc: 'Multi-stage pipeline board with tenant-configured stages.' },
    { key: FEATURES.FOLLOWUPS, name: 'Follow-ups & Reminders', cat: 'Sales Core', desc: 'Task scheduler with overdue alerting and quick callbacks.' },
    { key: FEATURES.CALLS, name: 'Live Call Center Engine', cat: 'Telephony', desc: 'Interactive softphone, live duration timer, and disposition modal.' },
    { key: FEATURES.CALL_RECORDING, name: 'Voice Call Recordings', cat: 'Telephony', desc: 'Secure cloud recording storage and audio player.' },
    { key: FEATURES.CALL_TRANSCRIPTION, name: 'Automated Call Transcripts', cat: 'Telephony', desc: 'Speech-to-text transcript processing for compliance.' },
    { key: FEATURES.PROPERTIES, name: 'Plotted Layouts & Inventory', cat: 'Jamin Operations', desc: 'Visual plot layout grid, square footage, and hold actions.' },
    { key: FEATURES.SITE_VISITS, name: 'Prospective Buyer Site Visits', cat: 'Jamin Operations', desc: 'Layout tour scheduling and escort tracking.' },
    { key: FEATURES.BOOKINGS, name: 'Plot Reservation Bookings', cat: 'Jamin Operations', desc: 'Token receipts and automatic inventory status transitions.' },
    { key: FEATURES.INVESTORS, name: 'HNW Investors 360', cat: 'GHL Advisory', desc: 'Wealth profile, capital allocation, and mandate evaluation.' },
    { key: FEATURES.CONSULTATIONS, name: 'Private Advisory Consultations', cat: 'GHL Advisory', desc: '1-on-1 private wealth consultation scheduling and agendas.' },
    { key: FEATURES.INVESTMENT_OPPORTUNITIES, name: 'Investment Opportunities', cat: 'GHL Advisory', desc: 'Commercial pre-leased syndicates and logistics funds.' },
    { key: FEATURES.REPORTS, name: 'Analytics & Leaderboards', cat: 'Intelligence', desc: 'Conversion funnels, agent leaderboards, and CSV exports.' },
  ];

  return (
    <div className="platform-features-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Sparkles size={24} color="#8b5cf6" /> Master Feature Catalogue
          </h1>
          <p className="page-subtitle">
            Platform entitlement building blocks available for packaging into tenant subscription tiers.
          </p>
        </div>
      </div>

      <div className="platform-features-grid">
        {catalog.map(item => (
          <div
            key={item.key}
            className="card platform-feature-card"
          >
            <div className="platform-feature-card-header">
              <span className="platform-feature-category">
                {item.cat}
              </span>
              <span className="platform-feature-key">
                {item.key}
              </span>
            </div>

            <h3 className="platform-feature-title">{item.name}</h3>
            <p className="platform-feature-desc">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
