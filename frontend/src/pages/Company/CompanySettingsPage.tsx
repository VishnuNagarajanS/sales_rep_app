import React, { useState } from 'react';
import { Settings, Save, Building2, Clock, Globe, Shield, Library } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUnsavedChanges } from '../../context/NavigationGuardContext';
import { superAdminService } from '../../services/superAdminService';
import { DocumentUploader } from '../../components/common/DocumentUploader';
import { DocumentList } from '../../components/common/DocumentList';
import { PERMISSIONS } from '../../constants/permissions';
import { Tenant } from '../../types';
import './CompanySettingsPage.css';

export const CompanySettingsPage: React.FC = () => {
  const { tenant, setTenant, permissions } = useAuth();
  const canManageSettings = permissions.includes(PERMISSIONS.SETTINGS_UPDATE);
  const [companyName, setCompanyName] = useState(tenant?.name || '');
  const [tagline, setTagline] = useState(tenant?.tagline || '');
  const [timezone, setTimezone] = useState(tenant?.timezone || 'Asia/Kolkata (IST)');
  const [businessHours, setBusinessHours] = useState(tenant?.businessHours || '09:30 AM - 07:00 PM IST');
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Unsaved changes check
  const isDirty = !!tenant && (
    companyName.trim() !== tenant.name ||
    tagline.trim() !== (tenant.tagline || '') ||
    timezone.trim() !== (tenant.timezone || 'Asia/Kolkata (IST)') ||
    businessHours.trim() !== (tenant.businessHours || '09:30 AM - 07:00 PM IST')
  );

  useUnsavedChanges(
    isDirty,
    'You have unsaved changes in company profile settings. Are you sure you want to leave?',
    'company-settings'
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant || isSaving) return;
    if (!companyName.trim()) {
      alert('Organization name cannot be empty.');
      return;
    }

    setIsSaving(true);
    try {
      const updatedTenant: Tenant = {
        ...tenant,
        name: companyName.trim(),
        tagline: tagline.trim(),
        timezone: timezone.trim(),
        businessHours: businessHours.trim(),
      };
      const saved = await superAdminService.updateTenantApi(updatedTenant);
      setTenant(saved);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      alert(err?.message || 'Failed to save organization settings.');
    } finally {
      setIsSaving(false);
    }
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
            <label htmlFor="company-settings-name" className="form-label">Legal Organization Name</label>
            <input
              id="company-settings-name"
              name="companyName"
              type="text"
              className="form-input"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="company-settings-tagline" className="form-label">Industry Subtitle / Tagline</label>
            <input
              id="company-settings-tagline"
              name="tagline"
              type="text"
              className="form-input"
              value={tagline}
              onChange={e => setTagline(e.target.value)}
            />
          </div>

          <div className="company-settings-grid-2">
            <div className="form-group">
              <label htmlFor="company-settings-timezone" className="form-label">Primary Timezone</label>
              <input
                id="company-settings-timezone"
                name="timezone"
                type="text"
                className="form-input"
                value={timezone}
                onChange={e => setTimezone(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="company-settings-hours" className="form-label">Calling Business Hours</label>
              <input
                id="company-settings-hours"
                name="businessHours"
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

        <button
          type="submit"
          className="btn btn-primary company-settings-save-btn"
          disabled={isSaving || !companyName.trim()}
        >
          <Save size={15} /> {isSaving ? 'Saving Settings...' : 'Save Organization Settings'}
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
            entityId={tenant?.id || tenant?.slug || '1'}
            allowedCategories={['Brochure', 'Price List', 'Terms & Conditions', 'Policy Document', 'Other']}
          />

          <DocumentList
            entityType="company"
            entityId={tenant?.id || tenant?.slug || '1'}
            canDelete={true}
          />
        </div>
      )}
    </div>
  );
};
