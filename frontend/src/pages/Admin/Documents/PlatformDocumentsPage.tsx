import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FolderArchive,
  Upload,
  Search,
  Filter,
  Plus,
  RefreshCw,
  FileText,
  FileImage,
  FileSpreadsheet,
  File,
  Download,
  Trash2,
  Share2,
  Building2,
  Globe,
  Lock,
  Users,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Copy,
  Info
} from 'lucide-react';
import { DocumentItem } from '../../../types';
import { superAdminService } from '../../../services/superAdminService';
import { Modal } from '../../../components/common/Modal';
import './PlatformDocumentsPage.css';

const CATEGORIES = [
  'Legal & Compliance',
  'Sales Collateral',
  'SOPs & Guides',
  'Carrier / Telecom',
  'Contracts & Agreements',
  'General Resources'
];

function getFileIcon(mimeType: string = '') {
  if (mimeType.startsWith('image/')) {
    return <FileImage size={22} className="doc-icon text-cyan" />;
  }
  if (
    mimeType.includes('spreadsheet') ||
    mimeType.includes('excel') ||
    mimeType.includes('csv') ||
    mimeType.includes('sheet')
  ) {
    return <FileSpreadsheet size={22} className="doc-icon text-emerald" />;
  }
  if (mimeType.includes('pdf') || mimeType.includes('word') || mimeType.includes('document')) {
    return <FileText size={22} className="doc-icon text-primary" />;
  }
  return <File size={22} className="doc-icon text-muted" />;
}

export const PlatformDocumentsPage: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [tenants, setTenants] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTenantFilter, setSelectedTenantFilter] = useState('all_tenants');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [selectedAudienceFilter, setSelectedAudienceFilter] = useState('all');

  // Modals & Feedback
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Form State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formFile, setFormFile] = useState<File | null>(null);
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState(CATEGORIES[0]);
  const [formTargetType, setFormTargetType] = useState<'global' | 'specific'>('global');
  const [formTenantId, setFormTenantId] = useState('');
  const [formAudience, setFormAudience] = useState<'all_users' | 'admin_only'>('all_users');
  const [formDescription, setFormDescription] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const showToast = (type: 'success' | 'error', msg: string) => {
    if (type === 'success') {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(''), 4000);
    } else {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(''), 4500);
    }
  };

  const loadData = async (manual = false) => {
    if (manual) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const [docs, tenantList] = await Promise.all([
        superAdminService.getPlatformDocuments({
          tenantId: selectedTenantFilter !== 'all_tenants' ? selectedTenantFilter : undefined,
          category: selectedCategoryFilter !== 'all' ? selectedCategoryFilter : undefined,
          audience: selectedAudienceFilter !== 'all' ? selectedAudienceFilter : undefined,
          search: searchQuery.trim() || undefined,
        }),
        superAdminService.getPlatformDocumentTenants(),
      ]);

      setDocuments(docs || []);
      setTenants(tenantList || []);
      if (!formTenantId && tenantList && tenantList.length > 0) {
        setFormTenantId(tenantList[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load platform documents:', err);
      showToast('error', 'Failed to fetch platform documents. Please try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData(false);
    window.addEventListener('nexus_storage_updated', handleUpdate);
    return () => window.removeEventListener('nexus_storage_updated', handleUpdate);
  }, [selectedTenantFilter, selectedCategoryFilter, selectedAudienceFilter]);

  // Handle client-side search debounce / filtering
  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = doc.name.toLowerCase().includes(query);
        const matchesCat = doc.category.toLowerCase().includes(query);
        const matchesDesc = doc.description ? doc.description.toLowerCase().includes(query) : false;
        const matchesTenant = doc.targetTenantName ? doc.targetTenantName.toLowerCase().includes(query) : false;
        if (!matchesName && !matchesCat && !matchesDesc && !matchesTenant) return false;
      }
      return true;
    });
  }, [documents, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = documents.length;
    const globalCount = documents.filter(d => !d.entityId || d.entityId === 'all').length;
    const targetedCount = documents.filter(d => d.entityId && d.entityId !== 'all').length;
    const adminOnlyCount = documents.filter(d => d.targetAudience === 'admin_only').length;
    return { total, globalCount, targetedCount, adminOnlyCount };
  }, [documents]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFormFile(file);
      if (!formName) {
        setFormName(file.name);
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setFormFile(file);
      if (!formName) {
        setFormName(file.name);
      }
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formFile) {
      showToast('error', 'Please choose a document file to upload.');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('file', formFile);
      formData.append('name', formName.trim() || formFile.name);
      formData.append('category', formCategory);
      formData.append('entityId', formTargetType === 'global' ? 'all' : formTenantId);
      formData.append('targetAudience', formAudience);
      formData.append('description', formDescription.trim());

      await superAdminService.uploadPlatformDocument(formData);
      showToast('success', `"${formName || formFile.name}" published successfully.`);
      setIsUploadModalOpen(false);

      // Reset form
      setFormFile(null);
      setFormName('');
      setFormDescription('');
      setFormCategory(CATEGORIES[0]);
      setFormTargetType('global');
      setFormAudience('all_users');
      loadData(true);
    } catch (err: any) {
      console.error('Failed to publish platform document:', err);
      showToast('error', err?.message || 'Failed to upload document.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (doc: DocumentItem) => {
    if (!window.confirm(`Are you sure you want to remove "${doc.name}" from the platform? This will immediately revoke access across all tenant portals.`)) {
      return;
    }

    try {
      await superAdminService.deletePlatformDocument(doc.id);
      showToast('success', `"${doc.name}" removed successfully.`);
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
    } catch (err: any) {
      console.error('Failed to delete document:', err);
      showToast('error', err?.message || 'Failed to remove document.');
    }
  };

  const handleCopyLink = (url?: string) => {
    if (!url || url === '#') {
      showToast('error', 'Direct link is not available for this preview document.');
      return;
    }
    navigator.clipboard.writeText(url);
    showToast('success', 'Document download link copied to clipboard!');
  };

  return (
    <div className="platform-documents-page">
      {/* Toast notifications */}
      {successMsg && (
        <div className="platform-toast success">
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="platform-toast error">
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="platform-docs-header">
        <div className="platform-docs-header-left">
          <div className="platform-docs-badge">
            <FolderArchive size={14} />
            <span>Platform Resource Hub</span>
          </div>
          <h1 className="platform-docs-title">Platform Document Distribution</h1>
          <p className="platform-docs-subtitle">
            Publish standard guidelines, company collaterals, and contracts. Distributed documents automatically flow to Company Admins and their frontline sales teams.
          </p>
        </div>

        <div className="platform-docs-header-actions">
          <button
            type="button"
            className="btn btn-secondary btn-icon"
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            title="Refresh documents list"
          >
            <RefreshCw size={16} className={isRefreshing ? 'spin-anim' : ''} />
          </button>

          <button
            type="button"
            className="btn btn-primary btn-publish-doc"
            onClick={() => setIsUploadModalOpen(true)}
          >
            <Plus size={18} />
            <span>Publish Document</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="platform-docs-metrics-grid">
        <div className="platform-stat-card">
          <div className="platform-stat-icon-wrapper bg-blue-subtle">
            <FolderArchive size={20} className="text-primary" />
          </div>
          <div className="platform-stat-details">
            <div className="platform-stat-number">{stats.total}</div>
            <div className="platform-stat-label">Total Published Documents</div>
          </div>
        </div>

        <div className="platform-stat-card">
          <div className="platform-stat-icon-wrapper bg-emerald-subtle">
            <Globe size={20} className="text-emerald" />
          </div>
          <div className="platform-stat-details">
            <div className="platform-stat-number">{stats.globalCount}</div>
            <div className="platform-stat-label">Global Broadcasts (All Companies)</div>
          </div>
        </div>

        <div className="platform-stat-card">
          <div className="platform-stat-icon-wrapper bg-purple-subtle">
            <Building2 size={20} className="text-purple" />
          </div>
          <div className="platform-stat-details">
            <div className="platform-stat-number">{stats.targetedCount}</div>
            <div className="platform-stat-label">Company-Specific Materials</div>
          </div>
        </div>

        <div className="platform-stat-card">
          <div className="platform-stat-icon-wrapper bg-amber-subtle">
            <Lock size={20} className="text-amber" />
          </div>
          <div className="platform-stat-details">
            <div className="platform-stat-number">{stats.adminOnlyCount}</div>
            <div className="platform-stat-label">Admin-Only Restricted</div>
          </div>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="platform-docs-filter-bar card">
        <div className="platform-search-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="form-input platform-search-input"
            placeholder="Search documents by name, category, or target..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="clear-search-btn"
              onClick={() => setSearchQuery('')}
            >
              ×
            </button>
          )}
        </div>

        <div className="platform-filter-dropdowns">
          <div className="filter-group">
            <label className="filter-label">Target Company:</label>
            <select
              className="form-select filter-select"
              value={selectedTenantFilter}
              onChange={e => setSelectedTenantFilter(e.target.value)}
            >
              <option value="all_tenants">All Tenants (Global & Specific)</option>
              <option value="global">🌐 Global (All Companies Only)</option>
              {tenants.map(t => (
                <option key={t.id} value={t.id}>
                  🏢 {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">Category:</label>
            <select
              className="form-select filter-select"
              value={selectedCategoryFilter}
              onChange={e => setSelectedCategoryFilter(e.target.value)}
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">Audience:</label>
            <select
              className="form-select filter-select"
              value={selectedAudienceFilter}
              onChange={e => setSelectedAudienceFilter(e.target.value)}
            >
              <option value="all">All Audiences</option>
              <option value="all_users">👥 All Users & Sales Reps</option>
              <option value="admin_only">🔒 Company Admins Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table Content */}
      <div className="card platform-docs-table-card">
        {isLoading ? (
          <div className="platform-loading-state">
            <RefreshCw size={32} className="spin-anim text-primary" />
            <p>Loading distributed documents...</p>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="platform-empty-state">
            <div className="empty-state-icon-circle">
              <FolderArchive size={36} />
            </div>
            <h3>No Platform Documents Found</h3>
            <p>
              {searchQuery || selectedTenantFilter !== 'all_tenants' || selectedCategoryFilter !== 'all' || selectedAudienceFilter !== 'all'
                ? 'No documents matched your active filters. Try resetting the search or category filters.'
                : 'No documents have been published from the platform yet. Click "Publish Document" to distribute your first resource.'}
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setIsUploadModalOpen(true)}
            >
              <Plus size={16} />
              <span>Publish First Document</span>
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="platform-docs-table">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Category</th>
                  <th>Target Company</th>
                  <th>Audience Scope</th>
                  <th>Uploaded Info</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocuments.map(doc => (
                  <tr key={doc.id} className="platform-doc-row">
                    {/* Document details */}
                    <td className="doc-main-cell">
                      <div className="doc-item-wrapper">
                        <div className="doc-avatar-box">
                          {getFileIcon(doc.type)}
                        </div>
                        <div className="doc-info-block">
                          <div className="doc-title-row">
                            <span className="doc-name" title={doc.name}>
                              {doc.name}
                            </span>
                          </div>
                          {doc.description && (
                            <div className="doc-description" title={doc.description}>
                              {doc.description}
                            </div>
                          )}
                          <div className="doc-submeta">
                            <span className="doc-size-badge">{doc.size}</span>
                            <span className="doc-type-text">{doc.type.split('/')[1]?.toUpperCase() || 'FILE'}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td>
                      <span className="category-tag">
                        {doc.category}
                      </span>
                    </td>

                    {/* Target Company */}
                    <td>
                      {!doc.entityId || doc.entityId === 'all' ? (
                        <div className="target-badge target-global">
                          <Globe size={13} />
                          <span>All Companies (Global)</span>
                        </div>
                      ) : (
                        <div className="target-badge target-specific">
                          <Building2 size={13} />
                          <span>{doc.targetTenantName || `Company #${doc.entityId}`}</span>
                        </div>
                      )}
                    </td>

                    {/* Audience Scope */}
                    <td>
                      {doc.targetAudience === 'admin_only' ? (
                        <div className="audience-badge audience-admin">
                          <Lock size={12} />
                          <span>Admins Only</span>
                        </div>
                      ) : (
                        <div className="audience-badge audience-all">
                          <Users size={12} />
                          <span>All Users & Reps</span>
                        </div>
                      )}
                    </td>

                    {/* Upload info */}
                    <td>
                      <div className="upload-meta">
                        <span className="uploader-name">{doc.uploadedBy}</span>
                        <span className="upload-date">{doc.uploadedAt}</span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="text-right doc-actions-cell">
                      <div className="doc-actions-group">
                        <button
                          type="button"
                          className="action-icon-btn download"
                          title="Open or Download file"
                          onClick={() => {
                            if (doc.fileUrl && doc.fileUrl !== '#') {
                              window.open(doc.fileUrl, '_blank');
                            } else {
                              showToast('error', 'This document does not have a valid file URL attached.');
                            }
                          }}
                        >
                          <Download size={16} />
                        </button>

                        <button
                          type="button"
                          className="action-icon-btn copy"
                          title="Copy file URL"
                          onClick={() => handleCopyLink(doc.fileUrl)}
                        >
                          <Copy size={16} />
                        </button>

                        <button
                          type="button"
                          className="action-icon-btn delete"
                          title="Delete document"
                          onClick={() => handleDelete(doc)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Publish Document Modal */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => !isSubmitting && setIsUploadModalOpen(false)}
        title="Publish Platform Document"
        subtitle="Distribute essential documents to company administrators and frontline sales executives."
      >
        <form onSubmit={handleUploadSubmit} className="publish-doc-form">
          {/* File Dropzone */}
          <div className="form-group">
            <label className="form-label required">Select Document File:</label>
            <div
              className={`doc-upload-dropzone ${isDragging ? 'dragging' : ''} ${formFile ? 'has-file' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <Upload size={32} className="dropzone-icon" />
              {formFile ? (
                <div className="dropzone-file-selected">
                  <span className="file-name">{formFile.name}</span>
                  <span className="file-size">({(formFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                  <span className="click-change">Click or drag another file to replace</span>
                </div>
              ) : (
                <div className="dropzone-prompt">
                  <strong>Click to browse or drag & drop file here</strong>
                  <span>Supports PDF, DOCX, XLSX, PNG, JPG (up to 30 MB)</span>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: 'none' }}
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.zip"
            />
          </div>

          {/* Document Title */}
          <div className="form-group">
            <label className="form-label">Display Title / Name:</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. RBI Compliance Guidelines 2026.pdf"
              value={formName}
              onChange={e => setFormName(e.target.value)}
            />
            <span className="form-hint">Leave blank to use the original file name.</span>
          </div>

          {/* Category */}
          <div className="form-group">
            <label className="form-label required">Category:</label>
            <select
              className="form-select"
              value={formCategory}
              onChange={e => setFormCategory(e.target.value)}
              required
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Distribution Target */}
          <div className="form-group">
            <label className="form-label required">Distribution Target:</label>
            <div className="target-radio-grid">
              <label className={`target-radio-card ${formTargetType === 'global' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="targetType"
                  checked={formTargetType === 'global'}
                  onChange={() => setFormTargetType('global')}
                />
                <div className="target-radio-content">
                  <div className="target-radio-title">
                    <Globe size={16} />
                    <span>Global (All Companies)</span>
                  </div>
                  <p className="target-radio-desc">
                    Every active company admin and sales representative across the platform receives this document.
                  </p>
                </div>
              </label>

              <label className={`target-radio-card ${formTargetType === 'specific' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="targetType"
                  checked={formTargetType === 'specific'}
                  onChange={() => setFormTargetType('specific')}
                />
                <div className="target-radio-content">
                  <div className="target-radio-title">
                    <Building2 size={16} />
                    <span>Target Specific Company</span>
                  </div>
                  <p className="target-radio-desc">
                    Only members of the selected tenant will have access to this document.
                  </p>
                </div>
              </label>
            </div>

            {formTargetType === 'specific' && (
              <div className="specific-tenant-picker">
                <label className="form-label">Select Target Company:</label>
                <select
                  className="form-select"
                  value={formTenantId}
                  onChange={e => setFormTenantId(e.target.value)}
                  required
                >
                  {tenants.map(t => (
                    <option key={t.id} value={t.id}>
                      🏢 {t.name} ({t.slug})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Audience Scope */}
          <div className="form-group">
            <label className="form-label required">Target Audience & Visibility:</label>
            <div className="audience-radio-grid">
              <label className={`audience-radio-card ${formAudience === 'all_users' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="audienceScope"
                  checked={formAudience === 'all_users'}
                  onChange={() => setFormAudience('all_users')}
                />
                <div className="audience-radio-content">
                  <div className="audience-radio-title">
                    <Users size={16} />
                    <span>All Users & Sales Reps</span>
                  </div>
                  <p className="audience-radio-desc">
                    Company Admins & Sales Executives can view, download, and share this directly with customers via WhatsApp/Email.
                  </p>
                </div>
              </label>

              <label className={`audience-radio-card ${formAudience === 'admin_only' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="audienceScope"
                  checked={formAudience === 'admin_only'}
                  onChange={() => setFormAudience('admin_only')}
                />
                <div className="audience-radio-content">
                  <div className="audience-radio-title">
                    <Lock size={16} />
                    <span>Company Admins Only</span>
                  </div>
                  <p className="audience-radio-desc">
                    Confidential contract, SLA, or billing file visible exclusively to Tenant Administrators.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Description */}
          <div className="form-group">
            <label className="form-label">Summary / Instructions:</label>
            <textarea
              className="form-textarea"
              rows={3}
              placeholder="Provide context or instructions for company administrators and sales agents..."
              value={formDescription}
              onChange={e => setFormDescription(e.target.value)}
            />
          </div>

          {/* Submit footer */}
          <div className="modal-footer-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsUploadModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || !formFile}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={16} className="spin-anim" />
                  <span>Publishing...</span>
                </>
              ) : (
                <>
                  <Upload size={16} />
                  <span>Publish Document</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
