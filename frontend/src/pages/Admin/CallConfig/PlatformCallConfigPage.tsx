import React, { useState } from 'react';
import { PhoneCall, ShieldCheck, Radio, Server, Check } from 'lucide-react';
import './PlatformCallConfigPage.css';

export const PlatformCallConfigPage: React.FC = () => {
  const [provider, setProvider] = useState('Twilio Elastic SIP Trunking');
  const [recordingRetention, setRecordingRetention] = useState('180 Days');

  return (
    <div className="platform-callconfig-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <PhoneCall size={24} color="#8b5cf6" /> Telephony & Trunking Configuration
          </h1>
          <p className="page-subtitle">
            Virtual DID phone number routing maps, carrier trunks, and tenant isolation policies.
          </p>
        </div>
      </div>

      {/* DID Mapping Table */}
      <div className="card platform-callconfig-table-card">
        <div className="platform-callconfig-card-header">
          <h3 className="platform-callconfig-card-title">Virtual DID Inbound Mapping</h3>
        </div>

        <table className="platform-callconfig-table">
          <thead>
            <tr className="platform-callconfig-thead-tr">
              <th className="platform-callconfig-th-did">Inbound Virtual DID</th>
              <th className="platform-callconfig-th-left">Mapped Tenant Organization</th>
              <th className="platform-callconfig-th-left">Routing Strategy</th>
              <th className="platform-callconfig-th-center">Recording & Transcription</th>
              <th className="platform-callconfig-th-right">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="platform-callconfig-td-did">
                +91 80 4700 8001
              </td>
              <td className="platform-callconfig-td-tenant-ghl">
                GHL India Ventures
              </td>
              <td className="platform-callconfig-td-strategy">VIP Priority / Wealth Advisory Queue</td>
              <td className="platform-callconfig-td-center">
                <span className="platform-callconfig-ai-status">Active (Whisper AI)</span>
              </td>
              <td className="platform-callconfig-td-right">
                <span className="platform-callconfig-online-badge">● Online</span>
              </td>
            </tr>
            <tr className="platform-callconfig-tr-border">
              <td className="platform-callconfig-td-did">
                +91 80 4700 8002
              </td>
              <td className="platform-callconfig-td-tenant-jamin">
                Jamin Bazaar
              </td>
              <td className="platform-callconfig-td-strategy">Round-Robin (Available Land Agents)</td>
              <td className="platform-callconfig-td-center">
                <span className="platform-callconfig-ai-status">Active (Whisper AI)</span>
              </td>
              <td className="platform-callconfig-td-right">
                <span className="platform-callconfig-online-badge">● Online</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Global Telephony Provider Card */}
      <div className="card platform-callconfig-provider-card">
        <h3 className="platform-callconfig-provider-title">
          Platform Carrier & SIP Settings
        </h3>

        <div className="platform-callconfig-form-stack">
          <div className="form-group">
            <label className="platform-callconfig-label">Telephony Gateway Carrier</label>
            <input
              type="text"
              className="platform-callconfig-input"
              value={provider}
              onChange={e => setProvider(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="platform-callconfig-label">Call Recording Retention Policy</label>
            <input
              type="text"
              className="platform-callconfig-input"
              value={recordingRetention}
              onChange={e => setRecordingRetention(e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
