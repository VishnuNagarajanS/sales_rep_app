import React from 'react';
import {
  Building2,
  Users,
  PhoneCall,
  ShieldCheck,
  Activity,
  ArrowUpRight,
  TrendingUp,
  FileCheck,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { auditLogStore, tenantStore, userStore } from '../../../services/secondaryStores';
import './PlatformDashboardPage.css';

interface PlatformDashboardPageProps {
  onNavigate: (route: string) => void;
}

export const PlatformDashboardPage: React.FC<PlatformDashboardPageProps> = ({ onNavigate }) => {
  const { switchPersona } = useAuth();
  const auditLogs = auditLogStore.getAuditLogs();
  const tenants = tenantStore.getTenants();
  const users = userStore.getUsers();

  return (
    <div className="platform-dashboard-page">
      {/* Platform Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            ⚡ Platform Operator Console
          </h1>
          <p className="page-subtitle">
            System-wide multi-tenant telemetry, telephony health, and cross-organization activity feeds.
          </p>
        </div>
      </div>

      {/* Cross-Tenant Telemetry Cards */}
      <div className="platform-telemetry-grid">
        <div className="card platform-telemetry-card">
          <div className="platform-telemetry-label">TOTAL TENANT COMPANIES</div>
          <div className="platform-telemetry-val">
            {tenants.length}
          </div>
          <div className="platform-telemetry-sub-sky">
            {tenants.map(t => t.name).join(' & ')}
          </div>
        </div>

        <div className="card platform-telemetry-card">
          <div className="platform-telemetry-label">PLATFORM ACTIVE USERS</div>
          <div className="platform-telemetry-val">
            {users.length}
          </div>
          <div className="platform-telemetry-sub-green">
            Registered Accounts
          </div>
        </div>

        <div className="card platform-telemetry-card">
          <div className="platform-telemetry-label">SYSTEM CALLS TODAY</div>
          <div className="platform-telemetry-val platform-telemetry-val-purple">
            242
          </div>
          <div className="platform-telemetry-sub-muted">
            Zero carrier drops
          </div>
        </div>

        <div className="card platform-telemetry-card">
          <div className="platform-telemetry-label">INFRASTRUCTURE HEALTH</div>
          <div className="platform-telemetry-val platform-telemetry-val-green">
            99.98%
          </div>
          <div className="platform-telemetry-sub-green">
            All telephony trunks operational
          </div>
        </div>
      </div>

      {/* Per-Company Performance Matrix */}
      <div className="card platform-matrix-card">
        <div className="platform-matrix-header">
          <h3 className="platform-matrix-title">Tenant Organization Telemetry</h3>
          <button
            className="btn btn-ghost btn-sm platform-matrix-manage-btn"
            onClick={() => onNavigate('admin-companies')}
          >
            Manage Organizations &rarr;
          </button>
        </div>

        <table className="platform-matrix-table">
          <thead>
            <tr className="platform-matrix-thead-tr">
              <th className="platform-matrix-th-name">Tenant Name</th>
              <th className="platform-matrix-th-tagline">Domain Specialization</th>
              <th className="platform-matrix-th-center">Enabled Modules</th>
              <th className="platform-matrix-th-center">Virtual DID</th>
              <th className="platform-matrix-th-action">Drill-in Support Action</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map(t => (
              <tr key={t.id} className="platform-matrix-tbody-tr">
                <td className="platform-matrix-td-name">
                  <div className="platform-matrix-tenant-name">{t.name}</div>
                  <div className="platform-matrix-tenant-id">ID: {t.id}</div>
                </td>
                <td className="platform-matrix-td-tagline">{t.tagline}</td>
                <td className="platform-matrix-td-center">
                  <span className="platform-matrix-badge-purple">
                    {t.enabledFeatures.length} Active
                  </span>
                </td>
                <td className="platform-matrix-td-center platform-matrix-did">
                  +91 80 4700 800{t.slug === 'ghl' ? '1' : '2'}
                </td>
                <td className="platform-matrix-td-action">
                  <button
                    className="btn btn-secondary btn-sm platform-matrix-drill-btn"
                    onClick={() => switchPersona('company_admin', t.slug)}
                  >
                    Drill In Read-Only
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Platform Security Audit Feed */}
      <div className="card platform-audit-card">
        <h3 className="platform-audit-title">
          Live Cross-Tenant Security Audit Stream
        </h3>
        <div className="platform-audit-list">
          {auditLogs.slice(0, 4).map(l => (
            <div
              key={l.id}
              className="platform-audit-item"
            >
              <div>
                <div className="platform-audit-item-header">
                  <span className="platform-audit-company-badge">
                    [{l.companyName || 'PLATFORM'}]
                  </span>
                  <span className="platform-audit-action">{l.action}</span>
                </div>
                <div className="platform-audit-details">{l.details}</div>
              </div>
              <span className="platform-audit-time">{l.timestamp}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
