import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  ArrowRight,
  Eye,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Users,
  PhoneCall,
  Settings,
  MoreVertical,
  ExternalLink,
  ShieldAlert,
  Sparkles,
  Layers,
  Save,
  Trash2,
  X,
  LayoutGrid,
  List as ListIcon,
  Check,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { Tenant, User, SubscriptionPackage } from '../../../types';
import { superAdminService } from '../../../services/superAdminService';
import { FEATURES } from '../../../constants/features';
import { SYSTEM_ROLES } from '../../../constants/roles';
import { Modal } from '../../../components/common/Modal';
import { Drawer } from '../../../components/common/Drawer';
import './CompaniesPage.css';

interface CompaniesPageProps {
  initialOpenWizard?: boolean;
  selectedTenantId?: string;
}

export const CompaniesPage: React.FC<CompaniesPageProps> = ({
  initialOpenWizard = false,
  selectedTenantId,
}) => {
  const { switchPersona } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [packages, setPackages] = useState<SubscriptionPackage[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Active' | 'Inactive' | 'Suspended'>('all');
  const [industryFilter, setIndustryFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Wizard state
  const [isWizardOpen, setIsWizardOpen] = useState(initialOpenWizard);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardName, setWizardName] = useState('');
  const [wizardLegalName, setWizardLegalName] = useState('');
  const [wizardSlug, setWizardSlug] = useState('');
  const [wizardIndustry, setWizardIndustry] = useState('Commercial Real Estate');
  const [wizardTagline, setWizardTagline] = useState('');
  const [wizardBrandColor, setWizardBrandColor] = useState('#8b5cf6');
  const [wizardTimezone, setWizardTimezone] = useState('Asia/Kolkata (IST)');
  const [wizardCurrency, setWizardCurrency] = useState('₹ INR');
  const [wizardBusinessHours, setWizardBusinessHours] = useState('09:30 AM - 06:30 PM IST');
  const [wizardPlan, setWizardPlan] = useState('Wealth Advisory Enterprise Suite');
  const [wizardSelectedFeatures, setWizardSelectedFeatures] = useState<string[]>([
    FEATURES.LEADS,
    FEATURES.CUSTOMERS,
    FEATURES.DEALS,
    FEATURES.FOLLOWUPS,
    FEATURES.CALLS,
    FEATURES.CALL_RECORDING,
    FEATURES.CALL_TRANSCRIPTION,
    FEATURES.REPORTS,
  ]);
  const [wizardAdminName, setWizardAdminName] = useState('');
  const [wizardAdminEmail, setWizardAdminEmail] = useState('');
  const [wizardAdminPhone, setWizardAdminPhone] = useState('+91 98450 ');
  const [wizardDidNumber, setWizardDidNumber] = useState('+91 80 4700 8003');
  const [wizardRoutingStrategy, setWizardRoutingStrategy] = useState('Round-Robin');

  // Detail Drawer state
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'profile' | 'features' | 'users' | 'telephony' | 'danger'>('profile');
  const [drawerTenantEdit, setDrawerTenantEdit] = useState<Tenant | null>(null);
  const [drawerUsers, setDrawerUsers] = useState<User[]>([]);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // Add User to Company Modal
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('+91 98450 ');
  const [newUserRole, setNewUserRole] = useState<'company_admin'>('company_admin');

  const loadData = () => {
    const allTenants = superAdminService.getTenants();
    setTenants(allTenants);
    setPackages(superAdminService.getPackages());

    if (selectedTenantId) {
      const match = allTenants.find(t => t.id === selectedTenantId || t.slug === selectedTenantId);
      if (match) {
        openTenantDrawer(match);
      }
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('nexus_admin_updated', loadData);
    window.addEventListener('nexus_storage_updated', loadData);
    return () => {
      window.removeEventListener('nexus_admin_updated', loadData);
      window.removeEventListener('nexus_storage_updated', loadData);
    };
  }, []);

  const handleViewAsCompany = (t: Tenant) => {
    sessionStorage.setItem('nexus_support_mode_active', 'true');
    sessionStorage.setItem('nexus_support_company_name', t.name);
    switchPersona('company_admin', t.slug);
  };

  const openTenantDrawer = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setDrawerTenantEdit({ ...tenant });
    setDrawerUsers(superAdminService.getUsers({ companyId: tenant.id }));
    setDrawerTab('profile');
    setIsDetailDrawerOpen(true);
    setSaveSuccessMsg('');
  };

  const handleSaveDrawerTenant = () => {
    if (!drawerTenantEdit) return;
    const updated = superAdminService.updateTenant(drawerTenantEdit);
    setSelectedTenant(updated);
    setSaveSuccessMsg('Organization profile and entitlements saved successfully.');
    setTimeout(() => setSaveSuccessMsg(''), 3000);
  };

  const handleToggleFeatureInDrawer = (featureKey: string) => {
    if (!drawerTenantEdit) return;
    const current = drawerTenantEdit.enabledFeatures || [];
    const updatedFeatures = current.includes(featureKey)
      ? current.filter(f => f !== featureKey)
      : [...current, featureKey];
    setDrawerTenantEdit({ ...drawerTenantEdit, enabledFeatures: updatedFeatures });
  };

  const handleToggleTenantStatus = (newStatus: 'Active' | 'Inactive' | 'Suspended') => {
    if (!selectedTenant) return;
    const updated = superAdminService.toggleTenantStatus(selectedTenant.id, newStatus);
    if (updated) {
      setSelectedTenant(updated);
      setDrawerTenantEdit(updated);
      setSaveSuccessMsg(`Organization status changed to ${newStatus}.`);
      setTimeout(() => setSaveSuccessMsg(''), 3000);
    }
  };

  const handleAddUserToCompany = () => {
    if (!selectedTenant || !newUserName || !newUserEmail) return;
    const roles = superAdminService.getRoles();
    superAdminService.createUser({
      name: newUserName,
      email: newUserEmail,
      phone: newUserPhone,
      role: roles.company_admin || SYSTEM_ROLES.company_admin,
      companyId: selectedTenant.id,
      companySlug: selectedTenant.slug,
      companyName: selectedTenant.name,
      status: 'Active',
      designation: 'Company Administrator',
    });
    setDrawerUsers(superAdminService.getUsers({ companyId: selectedTenant.id }));
    setIsAddUserModalOpen(false);
    setNewUserName('');
    setNewUserEmail('');
  };

  // Complete Onboarding Wizard
  const handleDeployOrganization = () => {
    if (!wizardName.trim()) return;

    superAdminService.createTenant(
      {
        name: wizardName.trim(),
        legalName: wizardLegalName.trim() || wizardName.trim(),
        slug: wizardSlug.trim().toLowerCase() || wizardName.toLowerCase().replace(/[^a-z0-9]/g, ''),
        industry: wizardIndustry,
        tagline: wizardTagline || 'Enterprise Sales Fleet',
        brandColor: wizardBrandColor,
        timezone: wizardTimezone,
        currency: wizardCurrency,
        businessHours: wizardBusinessHours,
        subscriptionPlan: wizardPlan,
        enabledFeatures: wizardSelectedFeatures,
        status: 'Active',
      },
      wizardAdminEmail
        ? {
            name: wizardAdminName || 'Primary Administrator',
            email: wizardAdminEmail,
            phone: wizardAdminPhone,
          }
        : undefined,
      wizardDidNumber
        ? {
            phoneNumber: wizardDidNumber,
            routingStrategy: wizardRoutingStrategy,
          }
        : undefined
    );

    setIsWizardOpen(false);
    setWizardStep(1);
    // Reset fields
    setWizardName('');
    setWizardAdminEmail('');
  };

  // Filtered tenants
  const filteredTenants = tenants.filter(t => {
    if (statusFilter !== 'all' && (t.status || 'Active') !== statusFilter) return false;
    if (industryFilter !== 'all' && t.industry !== industryFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = t.name.toLowerCase().includes(q);
      const matchSlug = t.slug.toLowerCase().includes(q);
      const matchIndustry = (t.industry || '').toLowerCase().includes(q);
      if (!matchName && !matchSlug && !matchIndustry) return false;
    }
    return true;
  });

  const allIndustries = Array.from(new Set(tenants.map(t => t.industry).filter(Boolean)));

  // Feature catalog definition
  const featureCategories = [
    {
      category: 'Sales & CRM Core',
      features: [
        { key: FEATURES.LEADS, label: 'Inbound Leads Management' },
        { key: FEATURES.CUSTOMERS, label: 'Customer 360 Profiles' },
        { key: FEATURES.DEALS, label: 'Deals & Pipeline Kanban' },
        { key: FEATURES.FOLLOWUPS, label: 'Follow-ups & Task Reminders' },
        { key: FEATURES.REPORTS, label: 'Sales Performance Reports' },
      ],
    },
    {
      category: 'Telephony & Live Softphone',
      features: [
        { key: FEATURES.CALLS, label: 'Interactive Live Softphone' },
        { key: FEATURES.CALL_RECORDING, label: 'Cloud Voice Recordings' },
        { key: FEATURES.CALL_TRANSCRIPTION, label: 'Whisper AI Speech Transcripts' },
      ],
    },
    {
      category: 'Jamin Real Estate & Plotted Operations',
      features: [
        { key: FEATURES.PROPERTIES, label: 'Interactive Plot Inventory Grid' },
        { key: FEATURES.SITE_VISITS, label: 'Prospective Buyer Site Visits' },
        { key: FEATURES.BOOKINGS, label: 'Token Reservation & Allotment' },
      ],
    },
    {
      category: 'GHL Wealth Advisory & Institutional',
      features: [
        { key: FEATURES.INVESTORS, label: 'HNW Investors & Mandates' },
        { key: FEATURES.CONSULTATIONS, label: 'Private Advisory Sessions' },
        { key: FEATURES.INVESTMENT_OPPORTUNITIES, label: 'Commercial Real Estate Tranches' },
      ],
    },
  ];

  return (
    <div className="companies-page-container">
      {/* Top Header */}
      <div className="page-header-row">
        <div>
          <div className="header-breadcrumbs">
            <span>PLATFORM CONSOLE</span> &gt; <span className="current">ORGANIZATIONS</span>
          </div>
          <h1 className="page-main-title">Client Organizations & Tenants</h1>
          <p className="page-main-desc">
            Deploy, provision, and govern multi-tenant workspaces, subscription packages, and telephony routing.
          </p>
        </div>

        <div className="header-actions-row">
          <div className="view-mode-toggle">
            <button
              className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Grid View"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              className={`view-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
              title="Table View"
            >
              <ListIcon size={15} />
            </button>
          </div>

          <button
            className="btn btn-primary btn-sm btn-deploy-org"
            onClick={() => {
              setWizardStep(1);
              setIsWizardOpen(true);
            }}
          >
            <Plus size={14} /> Provision New Organization
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card companies-filter-card">
        <div className="filter-search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="companies-search-input"
            placeholder="Search organizations by name, slug, or industry..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-controls-group">
          {/* Status Tabs */}
          <div className="status-tabs-pill">
            <button
              className={`status-tab ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              All ({tenants.length})
            </button>
            <button
              className={`status-tab ${statusFilter === 'Active' ? 'active' : ''}`}
              onClick={() => setStatusFilter('Active')}
            >
              Active
            </button>
            <button
              className={`status-tab ${statusFilter === 'Inactive' ? 'active' : ''}`}
              onClick={() => setStatusFilter('Inactive')}
            >
              Onboarding
            </button>
            <button
              className={`status-tab ${statusFilter === 'Suspended' ? 'active' : ''}`}
              onClick={() => setStatusFilter('Suspended')}
            >
              Suspended
            </button>
          </div>

          {/* Industry Filter Dropdown */}
          <select
            className="companies-select-input"
            value={industryFilter}
            onChange={e => setIndustryFilter(e.target.value)}
          >
            <option value="all">All Industries</option>
            {allIndustries.map(ind => (
              <option key={ind} value={ind}>
                {ind}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="companies-cards-grid">
          {filteredTenants.map(t => {
            const stats = superAdminService.getTenantStats(t.id);
            const isSuspended = t.status === 'Suspended';
            return (
              <div key={t.id} className={`card company-tenant-card ${isSuspended ? 'card-suspended' : ''}`}>
                <div className="tenant-card-header">
                  <div className="tenant-identity-wrap">
                    <span
                      className="tenant-large-avatar"
                      style={{ backgroundColor: t.brandColor || '#8b5cf6' }}
                    >
                      {t.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <h3 className="tenant-card-name">{t.name}</h3>
                      <div className="tenant-card-slug">
                        <code>{t.slug}</code> • ID: {t.id}
                      </div>
                    </div>
                  </div>

                  <span className={`tenant-status-chip ${t.status?.toLowerCase() || 'active'}`}>
                    {t.status || 'Active'}
                  </span>
                </div>

                <p className="tenant-card-tagline">{t.tagline || 'Enterprise Sales Organization'}</p>

                <div className="tenant-meta-specs">
                  <div className="meta-spec-item">
                    <span className="spec-label">Industry</span>
                    <span className="spec-value">{t.industry || 'Commercial Sales'}</span>
                  </div>
                  <div className="meta-spec-item">
                    <span className="spec-label">Plan Tier</span>
                    <span className="spec-value text-purple">{t.subscriptionPlan || 'Enterprise'}</span>
                  </div>
                  <div className="meta-spec-item">
                    <span className="spec-label">Active Reps</span>
                    <span className="spec-value text-blue">{stats.usersCount} Assigned</span>
                  </div>
                  <div className="meta-spec-item">
                    <span className="spec-label">Inbound DID</span>
                    <span className="spec-value font-mono">
                      +91 80 4700 800{t.slug === 'ghl' ? '1' : t.slug === 'jamin' ? '2' : '9'}
                    </span>
                  </div>
                </div>

                <div className="tenant-features-summary">
                  <span className="features-count-badge">
                    <Sparkles size={12} /> {t.enabledFeatures.length} Modules Active
                  </span>
                  <span className="timezone-badge">{t.timezone || 'IST'}</span>
                </div>

                <div className="tenant-card-footer">
                  <button
                    className="btn btn-secondary btn-sm btn-support-mode"
                    title="Inspect tenant CRM in safe read-only mode"
                    onClick={() => handleViewAsCompany(t)}
                  >
                    <ExternalLink size={13} /> View as Company
                  </button>

                  <button
                    className="btn btn-primary btn-sm btn-manage-drawer"
                    onClick={() => openTenantDrawer(t)}
                  >
                    <Settings size={13} /> Configure
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="card companies-table-card">
          <table className="companies-data-table">
            <thead>
              <tr>
                <th>Organization Name</th>
                <th>Slug & ID</th>
                <th>Industry</th>
                <th>Plan Tier</th>
                <th>Users</th>
                <th>DID Hotline</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTenants.map(t => {
                const stats = superAdminService.getTenantStats(t.id);
                return (
                  <tr key={t.id}>
                    <td>
                      <div className="table-tenant-name-col">
                        <span
                          className="table-avatar-badge"
                          style={{ backgroundColor: t.brandColor || '#8b5cf6' }}
                        >
                          {t.name.slice(0, 2).toUpperCase()}
                        </span>
                        <div>
                          <div className="table-org-name">{t.name}</div>
                          <div className="table-org-tagline">{t.tagline}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <code>{t.slug}</code>
                    </td>
                    <td>{t.industry}</td>
                    <td>
                      <span className="plan-tier-badge">{t.subscriptionPlan || 'Enterprise'}</span>
                    </td>
                    <td>{stats.usersCount}</td>
                    <td>
                      <code>+91 80 4700 800{t.slug === 'ghl' ? '1' : t.slug === 'jamin' ? '2' : '9'}</code>
                    </td>
                    <td>
                      <span className={`tenant-status-chip ${t.status?.toLowerCase() || 'active'}`}>
                        {t.status || 'Active'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="table-actions-cluster">
                        <button
                          className="btn btn-secondary btn-xs"
                          onClick={() => handleViewAsCompany(t)}
                          title="View as Company in Read-Only Mode"
                        >
                          <ExternalLink size={12} /> View As
                        </button>
                        <button
                          className="btn btn-primary btn-xs"
                          onClick={() => openTenantDrawer(t)}
                        >
                          Configure
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6-STEP COMPANY ONBOARDING WIZARD MODAL */}
      {/* ========================================================================= */}
      {isWizardOpen && (
        <Modal
          isOpen={isWizardOpen}
          onClose={() => setIsWizardOpen(false)}
          title="⚡ Provision New Enterprise Organization"
          size="lg"
        >
          <div className="wizard-modal-container">
            {/* Step Stepper Header */}
            <div className="wizard-stepper">
              {[
                { step: 1, label: 'Profile' },
                { step: 2, label: 'Localization' },
                { step: 3, label: 'Entitlements' },
                { step: 4, label: 'Primary Admin' },
                { step: 5, label: 'Telephony' },
                { step: 6, label: 'Review' },
              ].map(s => (
                <div
                  key={s.step}
                  className={`wizard-step-item ${wizardStep === s.step ? 'active' : ''} ${
                    wizardStep > s.step ? 'completed' : ''
                  }`}
                  onClick={() => {
                    if (wizardStep > s.step) setWizardStep(s.step);
                  }}
                >
                  <div className="step-circle">{wizardStep > s.step ? <Check size={12} /> : s.step}</div>
                  <span className="step-name">{s.label}</span>
                </div>
              ))}
            </div>

            {/* Step 1: Organization Profile */}
            {wizardStep === 1 && (
              <div className="wizard-step-content animate-fade-in">
                <h3 className="wizard-step-title">1. Organization Details & Brand Identity</h3>
                <p className="wizard-step-desc">
                  Basic entity information and system namespace slug for multi-tenant isolation.
                </p>

                <div className="form-grid-two">
                  <div className="form-group">
                    <label className="form-label required">Organization Display Name</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Paramount Asset Capital"
                      value={wizardName}
                      onChange={e => {
                        setWizardName(e.target.value);
                        if (!wizardSlug) {
                          setWizardSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''));
                        }
                      }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label required">Tenant URL Slug (Unique Namespace)</label>
                    <div className="input-group-prefix">
                      <span className="prefix-tag">nexus.io/</span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="paramount"
                        value={wizardSlug}
                        onChange={e => setWizardSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Legal Registered Entity Name</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Paramount Capital Ventures Private Limited"
                      value={wizardLegalName}
                      onChange={e => setWizardLegalName(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Domain Specialization / Industry</label>
                    <select
                      className="form-control"
                      value={wizardIndustry}
                      onChange={e => setWizardIndustry(e.target.value)}
                    >
                      <option value="Commercial Real Estate">Commercial Real Estate Advisory</option>
                      <option value="Plotted Developments & Farmlands">Plotted Developments & Farmlands</option>
                      <option value="Institutional Wealth Management">Institutional Wealth Management</option>
                      <option value="Residential Brokerage">Residential Brokerage</option>
                      <option value="Alternative Investment Funds">Alternative Investment Funds (AIF)</option>
                    </select>
                  </div>

                  <div className="form-group span-2">
                    <label className="form-label">Corporate Tagline / Subtitle</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Premier commercial real estate syndication and wealth advisory"
                      value={wizardTagline}
                      onChange={e => setWizardTagline(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Brand Color Accent</label>
                    <div className="color-picker-row">
                      <input
                        type="color"
                        className="color-swatch-input"
                        value={wizardBrandColor}
                        onChange={e => setWizardBrandColor(e.target.value)}
                      />
                      <input
                        type="text"
                        className="form-control"
                        value={wizardBrandColor}
                        onChange={e => setWizardBrandColor(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Localization */}
            {wizardStep === 2 && (
              <div className="wizard-step-content animate-fade-in">
                <h3 className="wizard-step-title">2. Regional Settings & SLA Timers</h3>
                <p className="wizard-step-desc">
                  Timezone, display currency, operational shift hours, and lead routing SLA policies.
                </p>

                <div className="form-grid-two">
                  <div className="form-group">
                    <label className="form-label">Default System Timezone</label>
                    <select
                      className="form-control"
                      value={wizardTimezone}
                      onChange={e => setWizardTimezone(e.target.value)}
                    >
                      <option value="Asia/Kolkata (IST)">Asia/Kolkata (IST - UTC+05:30)</option>
                      <option value="Asia/Dubai (GST)">Asia/Dubai (GST - UTC+04:00)</option>
                      <option value="Asia/Singapore (SGT)">Asia/Singapore (SGT - UTC+08:00)</option>
                      <option value="Europe/London (GMT)">Europe/London (GMT - UTC+00:00)</option>
                      <option value="America/New_York (EST)">America/New_York (EST - UTC-05:00)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Base Currency & Denomination</label>
                    <select
                      className="form-control"
                      value={wizardCurrency}
                      onChange={e => setWizardCurrency(e.target.value)}
                    >
                      <option value="₹ INR">₹ INR (Indian Rupee - Lakhs & Crores)</option>
                      <option value="$ USD">$ USD (US Dollar - Millions)</option>
                      <option value="AED">AED (UAE Dirham)</option>
                      <option value="£ GBP">£ GBP (British Pound)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Sales Working Shift Hours</label>
                    <input
                      type="text"
                      className="form-control"
                      value={wizardBusinessHours}
                      onChange={e => setWizardBusinessHours(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Inbound Lead SLA Escalation Timer</label>
                    <select className="form-control" defaultValue="15">
                      <option value="5">5 Minutes (Hyper-Fast SLA)</option>
                      <option value="15">15 Minutes (Standard VIP)</option>
                      <option value="30">30 Minutes (Standard Sales)</option>
                      <option value="60">60 Minutes</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Entitlements */}
            {wizardStep === 3 && (
              <div className="wizard-step-content animate-fade-in">
                <h3 className="wizard-step-title">3. Feature Packages & Module Entitlements</h3>
                <p className="wizard-step-desc">
                  Select a subscription package template or fine-tune individual functional switches.
                </p>

                <div className="package-preset-row">
                  {packages.map(pkg => (
                    <div
                      key={pkg.id}
                      className={`package-preset-card ${wizardPlan === pkg.name ? 'selected' : ''}`}
                      onClick={() => {
                        setWizardPlan(pkg.name);
                        setWizardSelectedFeatures([...pkg.features]);
                      }}
                    >
                      <div className="pkg-preset-header">
                        <span className="pkg-tier-chip">{pkg.tier}</span>
                        <span className="pkg-price">
                          {pkg.currency}
                          {(pkg.priceMonthly / 1000).toFixed(0)}k/mo
                        </span>
                      </div>
                      <h4 className="pkg-preset-name">{pkg.name}</h4>
                      <p className="pkg-preset-desc">{pkg.description}</p>
                    </div>
                  ))}
                </div>

                <div className="feature-checklist-section">
                  <h4 className="checklist-heading">Included Modules Checklist</h4>
                  <div className="features-checklist-grid">
                    {featureCategories.map(cat => (
                      <div key={cat.category} className="cat-group-card">
                        <div className="cat-group-title">{cat.category}</div>
                        {cat.features.map(f => {
                          const isChecked = wizardSelectedFeatures.includes(f.key);
                          return (
                            <label key={f.key} className="feature-check-label">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  if (isChecked) {
                                    setWizardSelectedFeatures(wizardSelectedFeatures.filter(k => k !== f.key));
                                  } else {
                                    setWizardSelectedFeatures([...wizardSelectedFeatures, f.key]);
                                  }
                                }}
                              />
                              <span>{f.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Admin Account */}
            {wizardStep === 4 && (
              <div className="wizard-step-content animate-fade-in">
                <h3 className="wizard-step-title">4. Provision Primary Company Administrator</h3>
                <p className="wizard-step-desc">
                  Create the root tenant administrator account who will manage employee reps and company settings.
                </p>

                <div className="form-grid-two">
                  <div className="form-group">
                    <label className="form-label required">Administrator Full Name</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Siddharth Menon"
                      value={wizardAdminName}
                      onChange={e => setWizardAdminName(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label required">Work Email Address</label>
                    <input
                      type="email"
                      className="form-control"
                      placeholder="siddharth@paramountcapital.io"
                      value={wizardAdminEmail}
                      onChange={e => setWizardAdminEmail(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Direct Mobile Number</label>
                    <input
                      type="text"
                      className="form-control"
                      value={wizardAdminPhone}
                      onChange={e => setWizardAdminPhone(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Initial Password Strategy</label>
                    <select className="form-control" defaultValue="auto">
                      <option value="auto">Generate Secure Password & Invite via Email</option>
                      <option value="preset">Preset to 'Password@123' (Demo Mode)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: Telephony */}
            {wizardStep === 5 && (
              <div className="wizard-step-content animate-fade-in">
                <h3 className="wizard-step-title">5. Virtual DID Telephony & Routing</h3>
                <p className="wizard-step-desc">
                  Allocate an inbound virtual DID number from the carrier pool and configure distribution.
                </p>

                <div className="form-grid-two">
                  <div className="form-group">
                    <label className="form-label required">Inbound Hotline Virtual DID</label>
                    <input
                      type="text"
                      className="form-control"
                      value={wizardDidNumber}
                      onChange={e => setWizardDidNumber(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Call Distribution Routing Strategy</label>
                    <select
                      className="form-control"
                      value={wizardRoutingStrategy}
                      onChange={e => setWizardRoutingStrategy(e.target.value)}
                    >
                      <option value="Round-Robin">Round-Robin (Available Reps)</option>
                      <option value="Skill/Priority">Skill & Priority Based Routing</option>
                      <option value="Least-Busy Rep">Least-Busy Rep Allocation</option>
                    </select>
                  </div>

                  <div className="form-group span-2">
                    <div className="info-box-telephony">
                      <PhoneCall size={18} color="#38bdf8" />
                      <div>
                        <strong>Automatic Carrier Provisioning:</strong> This number will be bound to Twilio SIP Trunking
                        with Whisper-Large-v3 speech transcription and automatic cloud call recording enabled.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 6: Review */}
            {wizardStep === 6 && (
              <div className="wizard-step-content animate-fade-in">
                <h3 className="wizard-step-title">6. Review & Deploy Organization</h3>
                <p className="wizard-step-desc">
                  Verify the deployment configuration before committing atomic multi-tenant provisioning.
                </p>

                <div className="review-summary-card">
                  <div className="review-row">
                    <span className="review-key">Organization:</span>
                    <span className="review-val font-bold">
                      {wizardName} (<code>{wizardSlug}</code>)
                    </span>
                  </div>
                  <div className="review-row">
                    <span className="review-key">Industry:</span>
                    <span className="review-val">{wizardIndustry}</span>
                  </div>
                  <div className="review-row">
                    <span className="review-key">Subscription Package:</span>
                    <span className="review-val text-purple">{wizardPlan}</span>
                  </div>
                  <div className="review-row">
                    <span className="review-key">Active Modules:</span>
                    <span className="review-val">{wizardSelectedFeatures.length} Features Enabled</span>
                  </div>
                  <div className="review-row">
                    <span className="review-key">Primary Administrator:</span>
                    <span className="review-val">
                      {wizardAdminName || 'Admin'} &lt;{wizardAdminEmail || 'Not Provided'}&gt;
                    </span>
                  </div>
                  <div className="review-row">
                    <span className="review-key">Inbound Virtual DID:</span>
                    <span className="review-val font-mono">{wizardDidNumber}</span>
                  </div>
                  <div className="review-row">
                    <span className="review-key">Routing Strategy:</span>
                    <span className="review-val">{wizardRoutingStrategy}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Wizard Modal Footer */}
            <div className="wizard-modal-footer">
              <button
                className="btn btn-ghost"
                onClick={() => {
                  if (wizardStep > 1) setWizardStep(wizardStep - 1);
                  else setIsWizardOpen(false);
                }}
              >
                {wizardStep === 1 ? 'Cancel' : 'Back'}
              </button>

              {wizardStep < 6 ? (
                <button
                  className="btn btn-primary"
                  disabled={wizardStep === 1 && !wizardName.trim()}
                  onClick={() => setWizardStep(wizardStep + 1)}
                >
                  Continue <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  className="btn btn-primary btn-deploy-confirm"
                  onClick={handleDeployOrganization}
                >
                  <Sparkles size={15} /> Confirm & Deploy Organization
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* COMPANY DETAIL & CONFIGURATION DRAWER */}
      {/* ========================================================================= */}
      {isDetailDrawerOpen && selectedTenant && drawerTenantEdit && (
        <Drawer
          isOpen={isDetailDrawerOpen}
          onClose={() => setIsDetailDrawerOpen(false)}
          title={`Configure: ${selectedTenant.name}`}
          size="lg"
        >
          <div className="tenant-drawer-container">
            {/* Drawer Header Badge */}
            <div className="drawer-top-banner">
              <div className="banner-left">
                <span
                  className="drawer-tenant-avatar"
                  style={{ backgroundColor: drawerTenantEdit.brandColor || '#8b5cf6' }}
                >
                  {drawerTenantEdit.name.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <h3 className="drawer-tenant-title">{drawerTenantEdit.name}</h3>
                  <div className="drawer-tenant-meta">
                    Slug: <code>{drawerTenantEdit.slug}</code> • Plan: {drawerTenantEdit.subscriptionPlan || 'Enterprise'}
                  </div>
                </div>
              </div>

              <div className="banner-right">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleViewAsCompany(selectedTenant)}
                >
                  <ExternalLink size={13} /> View as Company
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleSaveDrawerTenant}
                >
                  <Save size={13} /> Save Changes
                </button>
              </div>
            </div>

            {saveSuccessMsg && (
              <div className="drawer-alert-success animate-fade-in">
                <CheckCircle2 size={16} /> {saveSuccessMsg}
              </div>
            )}

            {/* Drawer Tabs */}
            <div className="drawer-nav-tabs">
              <button
                className={`drawer-tab-btn ${drawerTab === 'profile' ? 'active' : ''}`}
                onClick={() => setDrawerTab('profile')}
              >
                Profile & Branding
              </button>
              <button
                className={`drawer-tab-btn ${drawerTab === 'features' ? 'active' : ''}`}
                onClick={() => setDrawerTab('features')}
              >
                Feature Flags ({drawerTenantEdit.enabledFeatures.length})
              </button>
              <button
                className={`drawer-tab-btn ${drawerTab === 'users' ? 'active' : ''}`}
                onClick={() => setDrawerTab('users')}
              >
                Assigned Reps ({drawerUsers.length})
              </button>
              <button
                className={`drawer-tab-btn ${drawerTab === 'telephony' ? 'active' : ''}`}
                onClick={() => setDrawerTab('telephony')}
              >
                Telephony & Routing
              </button>
              <button
                className={`drawer-tab-btn danger-tab ${drawerTab === 'danger' ? 'active' : ''}`}
                onClick={() => setDrawerTab('danger')}
              >
                Status & Governance
              </button>
            </div>

            {/* Tab 1: Profile & Branding */}
            {drawerTab === 'profile' && (
              <div className="drawer-tab-pane animate-fade-in">
                <div className="form-grid-two">
                  <div className="form-group">
                    <label className="form-label">Organization Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={drawerTenantEdit.name}
                      onChange={e => setDrawerTenantEdit({ ...drawerTenantEdit, name: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Legal Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={drawerTenantEdit.legalName || ''}
                      onChange={e => setDrawerTenantEdit({ ...drawerTenantEdit, legalName: e.target.value })}
                    />
                  </div>

                  <div className="form-group span-2">
                    <label className="form-label">Tagline / Mission</label>
                    <input
                      type="text"
                      className="form-control"
                      value={drawerTenantEdit.tagline || ''}
                      onChange={e => setDrawerTenantEdit({ ...drawerTenantEdit, tagline: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Industry Classification</label>
                    <input
                      type="text"
                      className="form-control"
                      value={drawerTenantEdit.industry || ''}
                      onChange={e => setDrawerTenantEdit({ ...drawerTenantEdit, industry: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Brand Color</label>
                    <div className="color-picker-row">
                      <input
                        type="color"
                        className="color-swatch-input"
                        value={drawerTenantEdit.brandColor || '#8b5cf6'}
                        onChange={e => setDrawerTenantEdit({ ...drawerTenantEdit, brandColor: e.target.value })}
                      />
                      <input
                        type="text"
                        className="form-control"
                        value={drawerTenantEdit.brandColor || '#8b5cf6'}
                        onChange={e => setDrawerTenantEdit({ ...drawerTenantEdit, brandColor: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Timezone</label>
                    <input
                      type="text"
                      className="form-control"
                      value={drawerTenantEdit.timezone || 'Asia/Kolkata (IST)'}
                      onChange={e => setDrawerTenantEdit({ ...drawerTenantEdit, timezone: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Currency</label>
                    <input
                      type="text"
                      className="form-control"
                      value={drawerTenantEdit.currency || '₹ INR'}
                      onChange={e => setDrawerTenantEdit({ ...drawerTenantEdit, currency: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Feature Flags */}
            {drawerTab === 'features' && (
              <div className="drawer-tab-pane animate-fade-in">
                <p className="tab-pane-desc">
                  Toggle individual modules for this tenant. Enabled modules immediately appear in the company's navigation bar.
                </p>

                <div className="drawer-features-stack">
                  {featureCategories.map(cat => (
                    <div key={cat.category} className="cat-feature-card">
                      <h4 className="cat-header-title">{cat.category}</h4>
                      <div className="feature-toggle-rows">
                        {cat.features.map(f => {
                          const isEnabled = drawerTenantEdit.enabledFeatures.includes(f.key);
                          return (
                            <div key={f.key} className="feature-switch-row">
                              <div>
                                <div className="feature-row-label">{f.label}</div>
                                <code className="feature-row-code">{f.key}</code>
                              </div>
                              <label className="switch-control">
                                <input
                                  type="checkbox"
                                  checked={isEnabled}
                                  onChange={() => handleToggleFeatureInDrawer(f.key)}
                                />
                                <span className="switch-slider round" />
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab 3: Users */}
            {drawerTab === 'users' && (
              <div className="drawer-tab-pane animate-fade-in">
                <div className="tab-pane-header-action">
                  <h4 className="tab-subheading">Employee Directory ({drawerUsers.length} accounts)</h4>
                  <button
                    className="btn btn-primary btn-xs"
                    onClick={() => setIsAddUserModalOpen(true)}
                  >
                    <Plus size={12} /> Add Employee
                  </button>
                </div>

                <div className="drawer-users-list">
                  {drawerUsers.map(u => (
                    <div key={u.id} className="drawer-user-item">
                      <div className="drawer-user-avatar">
                        {u.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="drawer-user-info">
                        <div className="drawer-user-name">{u.name}</div>
                        <div className="drawer-user-email">{u.email} • {u.phone}</div>
                        <div className="drawer-user-role-badge">{u.role.name}</div>
                      </div>
                      <span className={`status-pill ${u.status.toLowerCase()}`}>
                        {u.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab 4: Telephony */}
            {drawerTab === 'telephony' && (
              <div className="drawer-tab-pane animate-fade-in">
                <div className="form-grid-two">
                  <div className="form-group span-2">
                    <label className="form-label">Dedicated Virtual DID Number</label>
                    <input
                      type="text"
                      className="form-control"
                      value={drawerTenantEdit.phone || '+91 80 4700 8001'}
                      onChange={e => setDrawerTenantEdit({ ...drawerTenantEdit, phone: e.target.value })}
                    />
                  </div>

                  <div className="form-group span-2">
                    <label className="form-label">Inbound Call Routing Strategy</label>
                    <select
                      className="form-control"
                      value={drawerTenantEdit.defaultRoutingStrategy || 'Round-Robin'}
                      onChange={e =>
                        setDrawerTenantEdit({ ...drawerTenantEdit, defaultRoutingStrategy: e.target.value })
                      }
                    >
                      <option value="Round-Robin">Round-Robin (Available Reps)</option>
                      <option value="Skill/Priority">Skill & Priority Based Routing</option>
                      <option value="Least-Busy Rep">Least-Busy Rep Allocation</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 5: Status & Governance */}
            {drawerTab === 'danger' && (
              <div className="drawer-tab-pane animate-fade-in">
                <div className="danger-zone-card">
                  <div className="danger-zone-header">
                    <ShieldAlert size={20} color="#ef4444" />
                    <div>
                      <h4 className="danger-zone-title">Organization Status & Access Governance</h4>
                      <p className="danger-zone-desc">
                        Manage organization lifecycle. Suspending will immediately lock out all employee accounts.
                      </p>
                    </div>
                  </div>

                  <div className="status-action-row">
                    <div className="status-current-badge">
                      Current Status: <strong className="uppercase">{selectedTenant.status || 'Active'}</strong>
                    </div>

                    <div className="status-buttons-cluster">
                      {selectedTenant.status !== 'Active' && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleToggleTenantStatus('Active')}
                        >
                          <CheckCircle2 size={13} color="#10b981" /> Activate Organization
                        </button>
                      )}

                      {selectedTenant.status !== 'Suspended' && (
                        <button
                          className="btn btn-secondary btn-sm btn-suspend"
                          onClick={() => handleToggleTenantStatus('Suspended')}
                        >
                          <AlertTriangle size={13} color="#f59e0b" /> Suspend Organization
                        </button>
                      )}

                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => {
                          if (confirm(`Are you sure you want to permanently delete organization "${selectedTenant.name}"?`)) {
                            superAdminService.deleteTenant(selectedTenant.id);
                            setIsDetailDrawerOpen(false);
                          }
                        }}
                      >
                        <Trash2 size={13} /> Delete Organization
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Drawer>
      )}

      {/* Add User Modal */}
      {isAddUserModalOpen && (
        <Modal
          isOpen={isAddUserModalOpen}
          onClose={() => setIsAddUserModalOpen(false)}
          title={`Add Employee to ${selectedTenant?.name}`}
          size="md"
        >
          <div className="add-user-modal-form">
            <div className="form-group">
              <label className="form-label required">Employee Full Name</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Priya Nair"
                value={newUserName}
                onChange={e => setNewUserName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label required">Work Email Address</label>
              <input
                type="email"
                className="form-control"
                placeholder="priya@company.com"
                value={newUserEmail}
                onChange={e => setNewUserEmail(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input
                type="text"
                className="form-control"
                value={newUserPhone}
                onChange={e => setNewUserPhone(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Role Assignment</label>
              <select
                className="form-control"
                value="company_admin"
                disabled
              >
                <option value="company_admin">Company Admin</option>
              </select>
            </div>

            <div className="modal-actions-footer">
              <button className="btn btn-ghost" onClick={() => setIsAddUserModalOpen(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={!newUserName || !newUserEmail}
                onClick={handleAddUserToCompany}
              >
                Provision Account
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};