import React, { useState, useEffect } from 'react';
import { Building2, Plus, ArrowRight, Eye } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { tenantStore, userStore, auditLogStore } from '../../../services/secondaryStores';
import { Tenant, User } from '../../../types';
import { StatusChip } from '../../../components/common/StatusChip';
import { Modal } from '../../../components/common/Modal';
import { FEATURES } from '../../../constants/features';
import './CompaniesPage.css';

export const CompaniesPage: React.FC = () => {
  const { switchPersona } = useAuth();
  const [companies, setCompanies] = useState<Tenant[]>(() => tenantStore.getTenants());

  useEffect(() => {
    const handleUpdate = () => setCompanies(tenantStore.getTenants());
    window.addEventListener('nexus_storage_updated', handleUpdate);
    return () => window.removeEventListener('nexus_storage_updated', handleUpdate);
  }, []);
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);

  // Wizard state
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newIndustry, setNewIndustry] = useState('Commercial Real Estate');
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([
    FEATURES.LEADS,
    FEATURES.CUSTOMERS,
    FEATURES.DEALS,
    FEATURES.CALLS,
    FEATURES.CALL_RECORDING,
    FEATURES.REPORTS,
  ]);
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [didNumber, setDidNumber] = useState('+91 80 4700 9000');
  const [routingStrategy, setRoutingStrategy] = useState('Round-Robin');

  const toggleFeature = (feat: string) => {
    if (selectedFeatures.includes(feat)) {
      setSelectedFeatures(selectedFeatures.filter(f => f !== feat));
    } else {
      setSelectedFeatures([...selectedFeatures, feat]);
    }
  };

  const handleCompleteOnboarding = () => {
    if (!newCompanyName.trim()) return;
    const cleanSlug = newCompanyName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const slug = cleanSlug || `tenant-${Date.now().toString().slice(-4)}`;

    const newTenant: Tenant = {
      id: `t-${slug}-${Date.now()}`,
      name: newCompanyName.trim(),
      legalName: newCompanyName.trim(),
      slug,
      brandColor: '#8b5cf6',
      industry: newIndustry,
      tagline: `${newIndustry} Solutions`,
      enabledFeatures: selectedFeatures,
      timezone: 'Asia/Kolkata (IST)',
      currency: '₹ INR',
      businessHours: '09:00 AM - 06:00 PM IST',
      email: adminEmail.trim() || `admin@${slug}.com`,
      phone: didNumber,
      defaultRoutingStrategy: routingStrategy,
      status: 'Active',
      createdAt: new Date().toISOString(),
    };

    tenantStore.saveTenant(newTenant);

    // Also provision the primary company admin account
    const newAdminUser: User = {
      id: `usr-${slug}-admin-${Date.now()}`,
      name: adminName.trim() || `${newCompanyName.trim()} Admin`,
      email: adminEmail.trim() || `admin@${slug}.com`,
      phone: didNumber || '+91 80 4700 9000',
      companyId: newTenant.id,
      companySlug: slug,
      companyName: newTenant.name,
      role: {
        id: 'r-company-admin',
        name: 'Company Admin',
        code: 'company_admin',
        permissions: [],
      },
      status: 'Active',
      createdAt: new Date().toISOString(),
    };
    userStore.saveUser(newAdminUser);

    auditLogStore.addAuditLog({
      id: `aud-${Date.now()}`,
      timestamp: 'Just now',
      actorName: 'Super Admin',
      actorEmail: 'alex@nexusplatform.io',
      action: 'TENANT_ONBOARDED',
      entityType: 'Tenant',
      entityId: newTenant.id,
      companyId: newTenant.id,
      companyName: newTenant.name,
      details: `Provisioned tenant ${newTenant.name} with ${selectedFeatures.length} modules and admin ${newAdminUser.email}`,
    });

    setIsOnboardingModalOpen(false);
    setWizardStep(1);
    setNewCompanyName('');
    setAdminName('');
    setAdminEmail('');
  };

  const renderCompanyLogo = (c: Tenant) => {
    if (c.slug === 'ghl' || c.logo?.includes('ghl') || c.logo?.includes('Ventures')) {
      return (
        <div className="company-logo-ghl">
          <img
            src="/og-image -GHL Ventures.png"
            alt={c.name}
            className="company-logo-img-ghl"
          />
        </div>
      );
    }
    if (c.slug === 'jamin' || c.logo?.includes('jamin')) {
      return (
        <div className="company-logo-jamin">
          <img
            src="/jamin-logo.png"
            alt={c.name}
            className="company-logo-img-jamin"
          />
        </div>
      );
    }
    if (c.logo) {
      return (
        <img
          src={c.logo}
          alt={c.name}
          className="company-logo-img-custom"
        />
      );
    }
    return (
      <div
        className="company-logo-fallback"
        style={{
          background: `linear-gradient(135deg, ${c.brandColor || '#8b5cf6'} 0%, #1e1b4b 100%)`,
        }}
      >
        {c.name.charAt(0).toUpperCase()}
      </div>
    );
  };

  const isStepValid = () => {
    if (wizardStep === 1) return newCompanyName.trim().length > 0;
    if (wizardStep === 4) return adminName.trim().length > 0 && adminEmail.trim().length > 0;
    return true;
  };

  return (
    <div className="companies-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Building2 size={24} color="#8b5cf6" /> Tenant Companies & Organizations
          </h1>
          <p className="page-subtitle">
            Onboard new enterprises, provision feature entitlement packages, and manage cross-tenant accounts.
          </p>
        </div>

        <button
          className="btn btn-primary companies-btn-onboard"
          onClick={() => {
            setWizardStep(1);
            setIsOnboardingModalOpen(true);
          }}
        >
          <Plus size={15} /> Onboard New Tenant (6-Step Wizard)
        </button>
      </div>

      {/* Companies List Cards */}
      <div className="companies-grid">
        {companies.map(c => (
          <div key={c.id} className="card card-hover company-card">
            <div className="company-card-top">
              <div className="company-card-title-group">
                {renderCompanyLogo(c)}
                <div>
                  <h3 className="company-card-name">{c.name}</h3>
                  <div className="company-card-id">ID: {c.id}</div>
                </div>
              </div>

              <StatusChip status={c.status || 'Active'} size="sm" />
            </div>

            <p className="company-card-tagline">{c.tagline}</p>

            <div className="company-entitlements-box">
              <div className="company-entitlements-title">
                Active Entitlement Package ({c.enabledFeatures.length} features):
              </div>
              <div className="company-features-tags">
                {c.enabledFeatures.slice(0, 6).map((f: string) => (
                  <span
                    key={f}
                    className="company-feature-tag"
                  >
                    {f}
                  </span>
                ))}
                {c.enabledFeatures.length > 6 && (
                  <span className="company-features-more">
                    +{c.enabledFeatures.length - 6} more
                  </span>
                )}
              </div>
            </div>

            {/* Drill-in "View as Company" action (Blueprint Section 7.16) */}
            <div className="company-card-bottom">
              <span className="company-hours-text">
                {c.businessHours}
              </span>

              <button
                className="btn btn-secondary btn-sm company-view-btn"
                title="Impersonate / Drill into tenant workspace"
                onClick={() => switchPersona('company_admin', c.slug)}
              >
                <Eye size={13} /> View as Company
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 6-Step Onboarding Wizard Modal (Blueprint Section 7.16) */}
      <Modal
        isOpen={isOnboardingModalOpen}
        onClose={() => setIsOnboardingModalOpen(false)}
        title={`Tenant Onboarding Wizard (Step ${wizardStep} of 6)`}
        subtitle="Provision isolated tenant workspace with feature entitlements and phone routing"
        maxWidth={620}
        footer={
          <>
            {wizardStep > 1 && (
              <button
                className="btn btn-secondary"
                onClick={() => setWizardStep(s => s - 1)}
              >
                Back
              </button>
            )}

            {wizardStep < 6 ? (
              <button
                className="btn btn-primary companies-wizard-btn-purple"
                disabled={!isStepValid()}
                onClick={() => isStepValid() && setWizardStep(s => s + 1)}
              >
                Next Step <ArrowRight size={14} />
              </button>
            ) : (
              <button
                className="btn btn-primary companies-wizard-btn-green"
                disabled={!isStepValid()}
                onClick={handleCompleteOnboarding}
              >
                Review & Activate Tenant
              </button>
            )}
          </>
        }
      >
        <div className="companies-modal-stack">
          {/* Step 1: Details */}
          {wizardStep === 1 && (
            <>
              <h4 className="companies-step-heading">Step 1: Organization Details</h4>
              <div className="form-group">
                <label className="form-label">Legal Company Name *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={newCompanyName}
                  onChange={e => setNewCompanyName(e.target.value)}
                  placeholder="e.g. Prestige Plotted Ventures"
                />
                <div className="companies-step-help">
                  Required to generate tenant namespace and isolated storage.
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Industry Domain *</label>
                <select
                  className="form-select"
                  value={newIndustry}
                  onChange={e => setNewIndustry(e.target.value)}
                >
                  <option value="Plotted Communities & Farmland">Plotted Communities & Farmland (Real Estate)</option>
                  <option value="Commercial High-Yield REITs">Commercial High-Yield REITs (Wealth Advisory)</option>
                  <option value="Luxury Residential">Luxury Residential Villa Development</option>
                  <option value="Logistics & Warehousing Parks">Logistics & Warehousing Parks</option>
                </select>
              </div>
            </>
          )}

          {/* Step 2: Feature Package Checklist */}
          {wizardStep === 2 && (
            <>
              <div className="companies-features-header">
                <h4 className="companies-step-heading">Step 2: Feature Package Selection</h4>
                <div className="companies-features-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm companies-features-mini-btn"
                    onClick={() => setSelectedFeatures(Object.values(FEATURES))}
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm companies-features-mini-btn"
                    onClick={() => setSelectedFeatures([])}
                  >
                    Clear All
                  </button>
                </div>
              </div>
              <p className="companies-features-desc">
                Select entitlement flags to be activated for this company ({selectedFeatures.length} of {Object.values(FEATURES).length} active):
              </p>
              <div className="companies-features-grid">
                {Object.values(FEATURES).map((val: string) => (
                  <label
                    key={val}
                    className={`company-feature-checkbox-label ${selectedFeatures.includes(val) ? 'is-selected' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedFeatures.includes(val)}
                      onChange={() => toggleFeature(val)}
                      className="company-feature-checkbox"
                    />
                    <span className={selectedFeatures.includes(val) ? 'is-selected-feature' : ''}>
                      {val}
                    </span>
                  </label>
                ))}
              </div>
            </>
          )}

          {/* Step 3: Default Roles */}
          {wizardStep === 3 && (
            <>
              <h4 className="companies-step-heading">Step 3: Default Role Templates</h4>
              <p className="companies-features-desc">
                The following standard RBAC role definitions will be provisioned in the tenant's namespace:
              </p>
              <div className="companies-modal-stack">
                {['Company Admin (Full tenant privileges)', 'Sales Manager (Team management, reports, reassignment)', 'Sales Executive (Own leads, calling dialer, status updates)'].map((r, i) => (
                  <div key={i} className="company-role-item">
                    ✓ <strong>{r}</strong>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Step 4: Admin Account */}
          {wizardStep === 4 && (
            <>
              <h4 className="companies-step-heading">Step 4: Initial Company Admin Account</h4>
              <div className="form-group">
                <label className="form-label">Admin Full Name *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={adminName}
                  onChange={e => setAdminName(e.target.value)}
                  placeholder="e.g. Ramesh Chandra"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Corporate Email Address *</label>
                <input
                  type="email"
                  className="form-input"
                  required
                  value={adminEmail}
                  onChange={e => setAdminEmail(e.target.value)}
                  placeholder="ramesh@company.com"
                />
              </div>
            </>
          )}

          {/* Step 5: Call Configuration */}
          {wizardStep === 5 && (
            <>
              <h4 className="companies-step-heading">Step 5: Telephony & Call Routing Configuration</h4>
              <div className="form-group">
                <label className="form-label">Virtual Inbound DID Phone Number</label>
                <input
                  type="text"
                  className="form-input"
                  value={didNumber}
                  onChange={e => setDidNumber(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Routing Strategy</label>
                <select
                  className="form-select"
                  value={routingStrategy}
                  onChange={e => setRoutingStrategy(e.target.value)}
                >
                  <option value="Round-Robin">Round-Robin (Equally distributed among available agents)</option>
                  <option value="Least-Busy">Least-Busy Agent (Shortest cumulative talk time)</option>
                  <option value="Skill-Based">Skill-Based / VIP Priority Routing</option>
                </select>
              </div>
            </>
          )}

          {/* Step 6: Review & Activate */}
          {wizardStep === 6 && (
            <>
              <h4 className="companies-step-heading-green">
                Step 6: Review Configuration & Activate
              </h4>
              <div className="company-review-box">
                <div><strong>Company:</strong> {newCompanyName || 'New Venture'} ({newIndustry})</div>
                <div><strong>Admin:</strong> {adminName || 'Admin'} ({adminEmail || 'admin@company.com'})</div>
                <div><strong>DID Number:</strong> {didNumber} ({routingStrategy})</div>
                <div><strong>Enabled Modules:</strong> {selectedFeatures.join(', ')}</div>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};