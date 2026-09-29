import React, { useState } from 'react';
import { Settings, Save, Building2, Clock, Globe, Shield, Library } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { DocumentUploader } from '../../components/common/DocumentUploader';
import { DocumentList } from '../../components/common/DocumentList';
import { PERMISSIONS } from '../../constants/permissions';
import './CompanySettingsPage.css';

export const CompanySettingsPage: React.FC = () => {
  const { tenant, permissions } = useAuth();
  const canManageSettings = permissions.includes(PERMISSIONS.SETTINGS_UPDATE);
  const [companyName, setCompanyName] = useState(tenant?.name || '');
  const [tagline, setTagline] = useState(tenant?.tagline || '');
  const [timezone, setTimezone] = useState(tenant?.timezone || 'Asia/Kolkata (IST)');
  const [businessHours, setBusinessHours] = useState(tenant?.businessHours || '09:30 AM - 07:00 PM IST');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="company-settings-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Settings size={24} color="var(--primary-600)" /> Company Profile & Settings
          </h1>
          <p className="page-subtitle">
            Configure organization branding, business hours, and operational defaults for {tenant?.name}.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="company-settings-form">
        {savedSuccess && (
          <div className="company-settings-alert-success">
            ✓ Settings saved successfully!
          </div>
        )}

        <div className="card company-settings-card">
          <h3 className="company-settings-card-title">General Organization Profile</h3>

          <div className="form-group">
            <label className="form-label">Legal Organization Name</label>
            <input
              type="text"
              className="form-input"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Industry Subtitle / Tagline</label>
            <input
              type="text"
              className="form-input"
              value={tagline}
              onChange={e => setTagline(e.target.value)}
            />
          </div>

          <div className="company-settings-grid-2">
            <div className="form-group">
              <label className="form-label">Primary Timezone</label>
              <input
                type="text"
                className="form-input"
                value={timezone}
                onChange={e => setTimezone(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Calling Business Hours</label>
              <input
                type="text"
                className="form-input"
                value={businessHours}
                onChange={e => setBusinessHours(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="card company-settings-entitlements-card">
          <h3 className="company-settings-card-title">Subscription Feature Entitlements</h3>
          <p className="company-settings-sub">
            These modules are enabled by your Platform Super Admin contract:
          </p>
          <div className="company-settings-badges-row">
            {tenant?.enabledFeatures.map(f => (
              <span
                key={f}
                className="company-settings-feature-badge"
              >
                ✓ {f}
              </span>
            ))}
          </div>
        </div>

        <button type="submit" className="btn btn-primary company-settings-save-btn">
          <Save size={15} /> Save Organization Settings
        </button>
      </form>

      {/* ── Company Document Library ── */}
      {tenant && (
        <div className="card company-settings-library-card">
          <div>
            <h3 className="company-settings-library-title">
              <Library size={17} color="var(--primary-600)" />
              Company Document Library
            </h3>
            <p className="company-settings-library-sub">
              Shared brochures, policy documents, and price lists available to all sales agents during calls.
            </p>
          </div>

          <DocumentUploader
            entityType="company"
            entityId={tenant.id}
            allowedCategories={['Brochure', 'Price List', 'Terms & Conditions', 'Policy Document', 'Other']}
          />

          <DocumentList
            entityType="company"
            entityId={tenant.id}
            canDelete={canManageSettings}
          />
        </div>
      )}
    </div>
  );
};
