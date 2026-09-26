import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Package,
  Layers,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Check,
  Building2,
  Users,
  HardDrive,
  IndianRupee,
  Search,
} from 'lucide-react';
import { SubscriptionPackage, Tenant } from '../../../types';
import { superAdminService } from '../../../services/superAdminService';
import { FEATURES } from '../../../constants/features';
import { Modal } from '../../../components/common/Modal';
import './PlatformFeaturesPage.css';

export const PlatformFeaturesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'packages' | 'catalog'>('packages');
  const [packages, setPackages] = useState<SubscriptionPackage[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [searchCatalogQuery, setSearchCatalogQuery] = useState('');

  // Create / Edit Package Modal
  const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
  const [editingPkgId, setEditingPkgId] = useState<string | null>(null);
  const [pkgName, setPkgName] = useState('');
  const [pkgCode, setPkgCode] = useState('');
  const [pkgTier, setPkgTier] = useState<'Starter' | 'Growth' | 'Enterprise'>('Growth');
  const [pkgPrice, setPkgPrice] = useState(29999);
  const [pkgMaxUsers, setPkgMaxUsers] = useState(30);
  const [pkgMaxStorage, setPkgMaxStorage] = useState(150);
  const [pkgDesc, setPkgDesc] = useState('');
  const [pkgSelectedFeatures, setPkgSelectedFeatures] = useState<string[]>([]);
  const [pkgIsPopular, setPkgIsPopular] = useState(false);

  // Success Feedback
  const [successMsg, setSuccessMsg] = useState('');

  const loadData = () => {
    setPackages(superAdminService.getPackages());
    setTenants(superAdminService.getTenants());
  };

  useEffect(() => {
    loadData();
    window.addEventListener('nexus_admin_updated', loadData);
    return () => window.removeEventListener('nexus_admin_updated', loadData);
  }, []);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const featureCatalog = [
    { key: FEATURES.LEADS, name: 'Inbound Leads Management', cat: 'Sales Core', desc: 'Custom fields, dynamic lead scoring, stage qualification, CSV bulk import & conversion.' },
    { key: FEATURES.CUSTOMERS, name: 'Customer 360 Records', cat: 'Sales Core', desc: 'Unified contact timeline, past deals, document vault, and call history.' },
    { key: FEATURES.DEALS, name: 'Deals & Pipeline Kanban', cat: 'Sales Core', desc: 'Multi-stage pipeline board with tenant-configured stages and financial values.' },
    { key: FEATURES.FOLLOWUPS, name: 'Follow-ups & Reminders', cat: 'Sales Core', desc: 'Task scheduler with overdue alerting, quick callbacks, and multi-channel reminders.' },
    { key: FEATURES.CALLS, name: 'Live Call Center Engine', cat: 'Telephony', desc: 'Embedded WebRTC softphone, live duration timer, objection handling script, and disposition modal.' },
    { key: FEATURES.CALL_RECORDING, name: 'Voice Call Recordings', cat: 'Telephony', desc: 'Secure cloud recording storage, audio waveform player, and compliance archival.' },
    { key: FEATURES.CALL_TRANSCRIPTION, name: 'Automated AI Transcripts', cat: 'Telephony', desc: 'OpenAI Whisper-Large speech-to-text transcript processing for dispute resolution.' },
    { key: FEATURES.PROPERTIES, name: 'Plotted Layouts & Inventory', cat: 'Jamin Real Estate', desc: 'Visual plot layout grid, square yardage, pricing tiers, and hold/release actions.' },
    { key: FEATURES.SITE_VISITS, name: 'Prospective Buyer Site Visits', cat: 'Jamin Real Estate', desc: 'Layout tour scheduling, cab & driver allocation, escort tracking, and post-visit survey.' },
    { key: FEATURES.BOOKINGS, name: 'Plot Reservation Bookings', cat: 'Jamin Real Estate', desc: 'Token receipts, advance allotment letters, and automatic inventory status transitions.' },
    { key: FEATURES.INVESTORS, name: 'HNW Investors 360', cat: 'GHL Wealth Advisory', desc: 'Ultra-HNI profiles, committed AUM tracking, capital allocation, and mandate evaluation.' },
    { key: FEATURES.CONSULTATIONS, name: 'Private Advisory Consultations', cat: 'GHL Wealth Advisory', desc: '1-on-1 private wealth consultation scheduling, agendas, and investment advisory notes.' },
    { key: FEATURES.INVESTMENT_OPPORTUNITIES, name: 'Commercial CRE Tranches', cat: 'GHL Wealth Advisory', desc: 'Commercial pre-leased syndicates, industrial logistics funds, and target yield tracking.' },
    { key: FEATURES.REPORTS, name: 'Analytics & Leaderboards', cat: 'Intelligence', desc: 'Conversion funnels, agent performance leaderboards, talk-time metrics, and CSV exports.' },
  ];

  const handleOpenCreatePackage = () => {
    setEditingPkgId(null);
    setPkgName('');
    setPkgCode('');
    setPkgTier('Growth');
    setPkgPrice(29999);
    setPkgMaxUsers(30);
    setPkgMaxStorage(150);
    setPkgDesc('');
    setPkgSelectedFeatures([
      FEATURES.LEADS,
      FEATURES.CUSTOMERS,
      FEATURES.DEALS,
      FEATURES.FOLLOWUPS,
      FEATURES.CALLS,
      FEATURES.REPORTS,
    ]);
    setPkgIsPopular(false);
    setIsPackageModalOpen(true);
  };

  const handleOpenEditPackage = (pkg: SubscriptionPackage) => {
    setEditingPkgId(pkg.id);
    setPkgName(pkg.name);
    setPkgCode(pkg.code);
    setPkgTier(pkg.tier);
    setPkgPrice(pkg.priceMonthly);
    setPkgMaxUsers(pkg.maxUsers);
    setPkgMaxStorage(pkg.maxStorageGb);
    setPkgDesc(pkg.description);
    setPkgSelectedFeatures([...pkg.features]);
    setPkgIsPopular(Boolean(pkg.isPopular));
    setIsPackageModalOpen(true);
  };

  const handleSavePackage = () => {
    if (!pkgName.trim()) return;

    if (editingPkgId) {
      const existing = packages.find(p => p.id === editingPkgId);
      if (existing) {
        superAdminService.updatePackage({
          ...existing,
          name: pkgName,
          code: pkgCode || existing.code,
          tier: pkgTier,
          priceMonthly: pkgPrice,
          maxUsers: pkgMaxUsers,
          maxStorageGb: pkgMaxStorage,
          description: pkgDesc,
          features: pkgSelectedFeatures,
          isPopular: pkgIsPopular,
        });
        showSuccess(`Subscription tier "${pkgName}" updated.`);
      }
    } else {
      superAdminService.createPackage({
        name: pkgName,
        code: pkgCode || pkgName.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
        tier: pkgTier,
        priceMonthly: pkgPrice,
        maxUsers: pkgMaxUsers,
        maxStorageGb: pkgMaxStorage,
        description: pkgDesc,
        features: pkgSelectedFeatures,
        isPopular: pkgIsPopular,
      });
      showSuccess(`Subscription package "${pkgName}" created.`);
    }

    setIsPackageModalOpen(false);
  };

  const handleDeletePackage = (pkg: SubscriptionPackage) => {
    if (confirm(`Are you sure you want to delete package "${pkg.name}"?`)) {
      superAdminService.deletePackage(pkg.id);
      showSuccess(`Package "${pkg.name}" removed.`);
    }
  };

  const filteredCatalog = featureCatalog.filter(
    f =>
      f.name.toLowerCase().includes(searchCatalogQuery.toLowerCase()) ||
      f.key.toLowerCase().includes(searchCatalogQuery.toLowerCase()) ||
      f.cat.toLowerCase().includes(searchCatalogQuery.toLowerCase()) ||
      f.desc.toLowerCase().includes(searchCatalogQuery.toLowerCase())
  );

  return (
    <div className="platform-features-page-container">
      {/* Header */}
      <div className="features-page-header">
        <div>
          <div className="header-breadcrumbs">
            <span>PLATFORM CONSOLE</span> &gt; <span className="current">PACKAGES & ENTITLEMENTS</span>
          </div>
          <h1 className="page-main-title">Feature Catalog & Subscription Packages</h1>
          <p className="page-main-desc">
            Define modular software building blocks, configure commercial subscription tiers, and assign tenant quotas.
          </p>
        </div>

        <div className="features-header-actions">
          <div className="features-view-tabs">
            <button
              className={`view-tab-btn ${activeTab === 'packages' ? 'active' : ''}`}
              onClick={() => setActiveTab('packages')}
            >
              <Package size={14} /> Subscription Packages ({packages.length})
            </button>
            <button
              className={`view-tab-btn ${activeTab === 'catalog' ? 'active' : ''}`}
              onClick={() => setActiveTab('catalog')}
            >
              <Sparkles size={14} /> Master Feature Catalog ({featureCatalog.length})
            </button>
          </div>

          {activeTab === 'packages' && (
            <button className="btn btn-primary btn-sm btn-create-pkg" onClick={handleOpenCreatePackage}>
              <Plus size={14} /> Create Package Tier
            </button>
          )}
        </div>
      </div>

      {successMsg && (
        <div className="features-success-alert animate-fade-in">
          <CheckCircle2 size={16} /> {successMsg}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: SUBSCRIPTION PACKAGES */}
      {/* ========================================================================= */}
      {activeTab === 'packages' && (
        <div className="packages-tab-container animate-fade-in">
          <div className="packages-grid">
            {packages.map(pkg => {
              const enrolledTenants = tenants.filter(t => t.subscriptionPlan === pkg.name);
              return (
                <div key={pkg.id} className={`card package-card ${pkg.isPopular ? 'popular-glow' : ''}`}>
                  {pkg.isPopular && <div className="popular-badge">MOST POPULAR</div>}

                  <div className="package-card-top">
                    <span className={`pkg-tier-pill ${pkg.tier.toLowerCase()}`}>{pkg.tier}</span>
                    <div className="pkg-actions-menu">
                      <button
                        className="pkg-action-icon-btn"
                        title="Edit Package"
                        onClick={() => handleOpenEditPackage(pkg)}
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        className="pkg-action-icon-btn text-danger"
                        title="Delete Package"
                        onClick={() => handleDeletePackage(pkg)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <h3 className="pkg-name-title">{pkg.name}</h3>
                  <p className="pkg-description-text">{pkg.description}</p>

                  <div className="pkg-pricing-row">
                    <span className="pkg-currency-symbol">{pkg.currency}</span>
                    <span className="pkg-price-number">{pkg.priceMonthly.toLocaleString()}</span>
                    <span className="pkg-price-period">/ month / organization</span>
                  </div>

                  <div className="pkg-quotas-box">
                    <div className="quota-item">
                      <Users size={14} color="#38bdf8" />
                      <span>Up to {pkg.maxUsers} Users</span>
                    </div>
                    <div className="quota-item">
                      <HardDrive size={14} color="#34d399" />
                      <span>{pkg.maxStorageGb} GB Cloud Storage</span>
                    </div>
                  </div>

                  <div className="pkg-features-included-section">
                    <h5 className="features-included-heading">
                      Included Modules ({pkg.features.length})
                    </h5>
                    <div className="pkg-features-tags-list">
                      {pkg.features.map(fKey => {
                        const match = featureCatalog.find(c => c.key === fKey);
                        return (
                          <span key={fKey} className="pkg-feature-tag">
                            <Check size={11} color="#10b981" />
                            {match?.name || fKey}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pkg-enrolled-tenants-footer">
                    <span className="enrolled-label">
                      <Building2 size={13} /> Active Subscribers ({enrolledTenants.length}):
                    </span>
                    <div className="enrolled-badges-wrap">
                      {enrolledTenants.length > 0 ? (
                        enrolledTenants.map(t => (
                          <span key={t.id} className="enrolled-tenant-chip">
                            {t.name}
                          </span>
                        ))
                      ) : (
                        <span className="no-subscribers-text">No client organizations enrolled</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: MASTER FEATURE CATALOG */}
      {/* ========================================================================= */}
      {activeTab === 'catalog' && (
        <div className="catalog-tab-container animate-fade-in">
          <div className="card catalog-search-card">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              className="catalog-search-input"
              placeholder="Search feature catalog by keyword or operational category..."
              value={searchCatalogQuery}
              onChange={e => setSearchCatalogQuery(e.target.value)}
            />
          </div>

          <div className="catalog-grid">
            {filteredCatalog.map(item => (
              <div key={item.key} className="card catalog-feature-card">
                <div className="catalog-card-header">
                  <span className="catalog-category-tag">{item.cat}</span>
                  <code className="catalog-key-badge">{item.key}</code>
                </div>

                <h3 className="catalog-feature-title">{item.name}</h3>
                <p className="catalog-feature-desc">{item.desc}</p>

                <div className="catalog-status-footer">
                  <span className="catalog-availability-badge">
                    <CheckCircle2 size={12} color="#10b981" /> Production Ready
                  </span>
                  <span className="catalog-code-hint">Dynamic Tenant-Scoped</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CREATE / EDIT PACKAGE MODAL */}
      {/* ========================================================================= */}
      {isPackageModalOpen && (
        <Modal
          isOpen={isPackageModalOpen}
          onClose={() => setIsPackageModalOpen(false)}
          title={editingPkgId ? '⚡ Edit Subscription Package Tier' : '⚡ Create Subscription Package Tier'}
          size="lg"
        >
          <div className="pkg-modal-content">
            <div className="form-grid-two">
              <div className="form-group">
                <label className="form-label required">Package Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Commercial Brokerage Pro"
                  value={pkgName}
                  onChange={e => {
                    setPkgName(e.target.value);
                    if (!pkgCode) {
                      setPkgCode(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
                    }
                  }}
                />
              </div>

              <div className="form-group">
                <label className="form-label required">Unique Package Code</label>
                <input
                  type="text"
                  className="form-control font-mono"
                  placeholder="commercial_brokerage_pro"
                  value={pkgCode}
                  onChange={e => setPkgCode(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Commercial Tier</label>
                <select
                  className="form-control"
                  value={pkgTier}
                  onChange={e => setPkgTier(e.target.value as any)}
                >
                  <option value="Starter">Starter Tier</option>
                  <option value="Growth">Growth / Professional</option>
                  <option value="Enterprise">Enterprise Flagship</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label required">Monthly Price (₹ INR)</label>
                <input
                  type="number"
                  className="form-control"
                  value={pkgPrice}
                  onChange={e => setPkgPrice(Number(e.target.value))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Maximum Users Cap</label>
                <input
                  type="number"
                  className="form-control"
                  value={pkgMaxUsers}
                  onChange={e => setPkgMaxUsers(Number(e.target.value))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Max Cloud Storage (GB)</label>
                <input
                  type="number"
                  className="form-control"
                  value={pkgMaxStorage}
                  onChange={e => setPkgMaxStorage(Number(e.target.value))}
                />
              </div>

              <div className="form-group span-2">
                <label className="form-label">Package Description</label>
                <textarea
                  className="form-control"
                  rows={2}
                  value={pkgDesc}
                  onChange={e => setPkgDesc(e.target.value)}
                />
              </div>
            </div>

            {/* Feature Checklist */}
            <div className="modal-feature-checklist-section">
              <label className="form-label required">Bundle Modules Included in this Package</label>
              <div className="modal-checklist-grid">
                {featureCatalog.map(f => {
                  const isChecked = pkgSelectedFeatures.includes(f.key);
                  return (
                    <label key={f.key} className="modal-check-item">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setPkgSelectedFeatures(pkgSelectedFeatures.filter(k => k !== f.key));
                          } else {
                            setPkgSelectedFeatures([...pkgSelectedFeatures, f.key]);
                          }
                        }}
                      />
                      <div>
                        <div className="check-item-name">{f.name}</div>
                        <div className="check-item-cat">{f.cat}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="modal-actions-footer">
              <button className="btn btn-ghost" onClick={() => setIsPackageModalOpen(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={!pkgName.trim() || pkgSelectedFeatures.length === 0}
                onClick={handleSavePackage}
              >
                {editingPkgId ? 'Save Package Tier' : 'Deploy Package Tier'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
