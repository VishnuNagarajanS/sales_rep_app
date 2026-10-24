import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FolderArchive,
  Upload,
  Search,
  Filter,
  FileText,
  FileImage,
  FileSpreadsheet,
  File,
  Download,
  Trash2,
  Share2,
  Mail,
  MessageSquare,
  Copy,
  Globe,
  Building2,
  Lock,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { DocumentItem } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../services/apiClient';
import { isMockMode } from '../../config/environment';
import { Modal } from '../../components/common/Modal';
import { superAdminService } from '../../services/superAdminService';
import './CompanyDocumentsPage.css';

const COMPANY_CATEGORIES = [
  'All',
  'Legal & Compliance',
  'Sales Collateral',
  'Brochure',
  'Price List',
  'Terms & Conditions',
  'SOPs & Guides',
  'Carrier / Telecom',
  'Other'
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

export const CompanyDocumentsPage: React.FC = () => {
  const { user, tenant, isSuperAdmin } = useAuth();
  const isAdmin = user?.role?.code === 'company_admin' || user?.role?.code === 'super_admin' || isSuperAdmin;
  const companyId = tenant?.id || user?.companyId || '1';

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<'all' | 'platform' | 'company'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Modal State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [formFile, setFormFile] = useState<File | null>(null);
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('Sales Collateral');
  const [formDescription, setFormDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Notifications
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  const loadDocuments = async (manual = false) => {
    if (manual) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      if (isMockMode()) {
        // In mock mode, combine local platform documents for this tenant + company documents
        const platformDocs = await superAdminService.getPlatformDocuments({
          tenantId: String(companyId),
          audience: isAdmin ? 'all' : 'all_users',
        });

        const raw = localStorage.getItem('nexus_documents');
        const companyDocs: DocumentItem[] = raw ? JSON.parse(raw) : [];
        const filteredCompanyDocs = companyDocs.filter(d => d.entityType === 'company');

        // Merge without duplicate IDs
        const map = new Map<string, DocumentItem>();
        platformDocs.forEach(d => map.set(d.id, d));
        filteredCompanyDocs.forEach(d => map.set(d.id, d));

        setDocuments(Array.from(map.values()));
      } else {
        const res = await apiClient.get<any>(`/documents?entityType=company&entityId=${companyId}`);
        if (res.success && Array.isArray(res.data)) {
          setDocuments(res.data);
        } else {
          setDocuments([]);
        }
      }
    } catch (err: any) {
      console.error('Failed to load company documents:', err);
      showToast('error', 'Failed to retrieve documents. Please refresh.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadDocuments();
    const handleUpdate = () => loadDocuments(false);
    window.addEventListener('nexus_storage_updated', handleUpdate);
    return () => window.removeEventListener('nexus_storage_updated', handleUpdate);
  }, [companyId]);

  // Tab & search filtering
  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => {
      // Tab filter
      if (activeTab === 'platform' && !doc.isPlatformShared && doc.entityType !== 'platform') return false;
      if (activeTab === 'company' && (doc.isPlatformShared || doc.entityType === 'platform')) return false;

      // Category filter
      if (selectedCategory !== 'All' && doc.category.toLowerCase() !== selectedCategory.toLowerCase()) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = doc.name.toLowerCase().includes(q);
        const matchesCategory = doc.category.toLowerCase().includes(q);
        const matchesDesc = doc.description ? doc.description.toLowerCase().includes(q) : false;
        if (!matchesName && !matchesCategory && !matchesDesc) return false;
      }

      return true;
    });
  }, [documents, activeTab, selectedCategory, searchQuery]);

  // Counts
  const platformCount = useMemo(() => {
    return documents.filter(d => d.isPlatformShared || d.entityType === 'platform').length;
  }, [documents]);

  const companyCount = useMemo(() => {
    return documents.filter(d => !d.isPlatformShared && d.entityType !== 'platform').length;
  }, [documents]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFormFile(file);
      if (!formName) setFormName(file.name);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setFormFile(file);
      if (!formName) setFormName(file.name);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formFile) {
      showToast('error', 'Please choose a file to upload.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isMockMode()) {
        const newDoc: DocumentItem = {
          id: `doc-comp-${Date.now()}`,
          name: formName.trim() || formFile.name,
          size: `${(formFile.size / 1024).toFixed(1)} KB`,
          type: formFile.type || 'application/pdf',
          uploadedBy: user?.name || 'Company Admin',
          uploadedAt: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
          category: formCategory,
          entityType: 'company',
          entityId: String(companyId),
          isPlatformShared: false,
          description: formDescription.trim(),
          fileUrl: '#'
        };

        const raw = localStorage.getItem('nexus_documents');
        const docs: DocumentItem[] = raw ? JSON.parse(raw) : [];
        docs.unshift(newDoc);
        localStorage.setItem('nexus_documents', JSON.stringify(docs));
        window.dispatchEvent(new Event('nexus_storage_updated'));

        showToast('success', `"${newDoc.name}" uploaded to company resources.`);
        setIsUploadModalOpen(false);
        setFormFile(null);
        setFormName('');
        setFormDescription('');
      } else {
        const formData = new FormData();
        formData.append('file', formFile);
        formData.append('name', formName.trim() || formFile.name);
        formData.append('category', formCategory);
        formData.append('entityType', 'company');
        formData.append('entityId', String(companyId));
        formData.append('description', formDescription.trim());

        const res = await apiClient.postFormData<any>('/documents', formData);
        if (res.success && res.data) {
          showToast('success', `"${res.data.name}" uploaded successfully.`);
          setIsUploadModalOpen(false);
          setFormFile(null);
          setFormName('');
          setFormDescription('');
          loadDocuments(true);
        } else {
          showToast('error', res.message || 'Failed to upload document.');
        }
      }
    } catch (err: any) {
      console.error('Failed to upload company document:', err);
      showToast('error', err?.message || 'Failed to upload document.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (doc: DocumentItem) => {
    if (!window.confirm(`Are you sure you want to remove "${doc.name}"?`)) return;

    try {
      if (isMockMode()) {
        const raw = localStorage.getItem('nexus_documents');
        if (raw) {
          const docs: DocumentItem[] = JSON.parse(raw);
          const filtered = docs.filter(d => d.id !== doc.id);
          localStorage.setItem('nexus_documents', JSON.stringify(filtered));
          window.dispatchEvent(new Event('nexus_storage_updated'));
        }
        showToast('success', 'Document removed.');
      } else {
        await apiClient.delete(`/documents/${doc.id}`);
        showToast('success', 'Document removed successfully.');
        setDocuments(prev => prev.filter(d => d.id !== doc.id));
      }
    } catch (err: any) {
      console.error('Failed to delete document:', err);
      showToast('error', 'Failed to remove document.');
    }
  };

  const handleShareWhatsApp = (doc: DocumentItem) => {
    const text = encodeURIComponent(
      `Hello, here is the official ${doc.category} from ${tenant?.name || 'our company'}: "${doc.name}"\n${doc.fileUrl || ''}\n\nPlease let us know if you have any questions.`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  const handleShareEmail = (doc: DocumentItem) => {
    const subject = encodeURIComponent(`${tenant?.name || 'Company'} Document: ${doc.name}`);
    const body = encodeURIComponent(
      `Hi,\n\nPlease find the requested ${doc.category} attached / linked below:\n\nDocument: ${doc.name}\nLink: ${doc.fileUrl || ''}\n\nBest regards,\n${user?.name || 'Sales Team'}\n${tenant?.name || ''}`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  const handleCopyLink = (url?: string) => {
    if (!url || url === '#') {
      showToast('error', 'Direct URL is not available for this sample document.');
      return;
    }
    navigator.clipboard.writeText(url);
    showToast('success', 'Document link copied to clipboard!');
  };

  return (
    <div className="company-documents-page">
      {/* Toast */}
      {toast && (
        <div className={`company-docs-toast ${toast.type}`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="company-docs-header">
        <div className="company-docs-header-left">
          <div className="company-docs-badge">
            <Building2 size={14} />
            <span>{tenant?.name || 'Company'} Resources Hub</span>
          </div>
          <h1 className="company-docs-title">Documents & Collaterals</h1>
          <p className="company-docs-subtitle">
            Access master documents shared from Super Admin and your internal sales collaterals. Share instantly with customers via WhatsApp, Email, or direct download.
          </p>
        </div>

        <div className="company-docs-header-actions">
          <button
            type="button"
            className="btn btn-secondary btn-icon"
            onClick={() => loadDocuments(true)}
            disabled={isRefreshing}
            title="Refresh documents"
          >
            <RefreshCw size={16} className={isRefreshing ? 'spin-anim' : ''} />
          </button>

          {isAdmin && (
            <button
              type="button"
              className="btn btn-primary btn-upload-doc"
              onClick={() => setIsUploadModalOpen(true)}
            >
              <Plus size={18} />
              <span>Upload Collateral</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="company-docs-tabs-row">
        <div className="company-tabs-group">
          <button
            type="button"
            className={`company-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            <span>All Resources</span>
            <span className="tab-pill">{documents.length}</span>
          </button>

          <button
            type="button"
            className={`company-tab-btn ${activeTab === 'platform' ? 'active' : ''}`}
            onClick={() => setActiveTab('platform')}
          >
            <div className="tab-label-with-icon">
              <Globe size={14} className="text-emerald" />
              <span>Shared from Super Admin</span>
            </div>
            <span className="tab-pill platform-pill">{platformCount}</span>
          </button>

          <button
            type="button"
            className={`company-tab-btn ${activeTab === 'company' ? 'active' : ''}`}
            onClick={() => setActiveTab('company')}
          >
            <div className="tab-label-with-icon">
              <Building2 size={14} className="text-purple" />
              <span>Company Uploads</span>
            </div>
            <span className="tab-pill">{companyCount}</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="company-docs-filter-bar card">
        <div className="company-search-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="form-input company-search-input"
            placeholder="Search documents by name, category, or notes..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-search-btn" onClick={() => setSearchQuery('')}>
              ×
            </button>
          )}
        </div>

        <div className="company-category-chips">
          {COMPANY_CATEGORIES.map(cat => (
            <button
              key={cat}
              type="button"
              className={`category-chip ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Content Grid */}
      <div className="company-docs-content">
        {isLoading ? (
          <div className="company-loading-box card">
            <RefreshCw size={32} className="spin-anim text-primary" />
            <p>Loading document resources...</p>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="company-empty-box card">
            <div className="empty-circle">
              <FolderArchive size={36} />
            </div>
            <h3>No Documents Found</h3>
            <p>
              {searchQuery || selectedCategory !== 'All'
                ? 'No documents matched your filters. Try clearing the search or category filter.'
                : activeTab === 'platform'
                  ? 'No documents have been distributed from the Super Admin platform yet.'
                  : 'No company-specific collateral uploaded yet.'}
            </p>
            {isAdmin && activeTab !== 'platform' && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setIsUploadModalOpen(true)}
              >
                <Plus size={16} />
                <span>Upload First Document</span>
              </button>
            )}
          </div>
        ) : (
          <div className="docs-cards-grid">
            {filteredDocuments.map(doc => {
              const isPlatform = doc.isPlatformShared || doc.entityType === 'platform';
              return (
                <div key={doc.id} className={`doc-resource-card card ${isPlatform ? 'platform-card' : ''}`}>
                  {/* Card Header & Badges */}
                  <div className="doc-card-top">
                    <div className="doc-type-icon-box">
                      {getFileIcon(doc.type)}
                    </div>
                    <div className="doc-badges-col">
                      {isPlatform ? (
                        <span className="badge-platform-shared" title="Distributed by Super Admin">
                          <Globe size={12} />
                          <span>Platform Shared</span>
                        </span>
                      ) : (
                        <span className="badge-company-upload">
                          <Building2 size={12} />
                          <span>Internal Upload</span>
                        </span>
                      )}
                      <span className="badge-category">{doc.category}</span>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="doc-card-body">
                    <h3 className="doc-card-title" title={doc.name}>
                      {doc.name}
                    </h3>
                    {doc.description && (
                      <p className="doc-card-desc" title={doc.description}>
                        {doc.description}
                      </p>
                    )}
                    <div className="doc-card-meta">
                      <span>{doc.size}</span>
                      <span>•</span>
                      <span>By {doc.uploadedBy}</span>
                      <span>•</span>
                      <span>{doc.uploadedAt}</span>
                    </div>
                  </div>

                  {/* Share and Action Toolbar */}
                  <div className="doc-card-footer">
                    <div className="share-buttons-group">
                      <button
                        type="button"
                        className="share-btn whatsapp-share"
                        title="Share with customer via WhatsApp"
                        onClick={() => handleShareWhatsApp(doc)}
                      >
                        <MessageSquare size={15} />
                        <span>WhatsApp</span>
                      </button>

                      <button
                        type="button"
                        className="share-btn email-share"
                        title="Share with customer via Email"
                        onClick={() => handleShareEmail(doc)}
                      >
                        <Mail size={15} />
                        <span>Email</span>
                      </button>
                    </div>

                    <div className="utility-buttons-group">
                      <button
                        type="button"
                        className="util-icon-btn"
                        title="Copy direct file link"
                        onClick={() => handleCopyLink(doc.fileUrl)}
                      >
                        <Copy size={15} />
                      </button>

                      <button
                        type="button"
                        className="util-icon-btn"
                        title="Download file"
                        onClick={() => {
                          if (doc.fileUrl && doc.fileUrl !== '#') {
                            const url = doc.fileUrl.trim();
                            if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/')) {
                              window.open(url, '_blank', 'noopener,noreferrer');
                            } else {
                              showToast('error', 'Invalid document file URL.');
                            }
                          } else {
                            showToast('error', 'Sample document does not have a downloadable file.');
                          }
                        }}
                      >
                        <Download size={15} />
                      </button>

                      {isAdmin && !isPlatform && (
                        <button
                          type="button"
                          className="util-icon-btn delete-btn"
                          title="Delete company document"
                          onClick={() => handleDelete(doc)}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Upload Company Resource Modal */}
      {isAdmin && (
        <Modal
          isOpen={isUploadModalOpen}
          onClose={() => !isSubmitting && setIsUploadModalOpen(false)}
          title="Upload Company Collateral"
          subtitle={`Add price sheets, brochures, or guidelines for ${tenant?.name || 'your team'}.`}
        >
          <form onSubmit={handleUploadSubmit} className="company-upload-form">
            {/* File Dropzone */}
            <div className="form-group">
              <label className="form-label required">Select File:</label>
              <div
                className={`company-dropzone ${isDragging ? 'dragging' : ''} ${formFile ? 'has-file' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
              >
                <Upload size={30} className="dropzone-icon" />
                {formFile ? (
                  <div className="dropzone-selected">
                    <span className="selected-filename">{formFile.name}</span>
                    <span className="selected-filesize">({(formFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                    <span className="change-file">Click or drag another file to replace</span>
                  </div>
                ) : (
                  <div className="dropzone-prompt">
                    <strong>Click to choose file or drag & drop here</strong>
                    <span>PDF, DOCX, XLSX, Images up to 25 MB</span>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                style={{ display: 'none' }}
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
              />
            </div>

            {/* Document Title */}
            <div className="form-group">
              <label className="form-label">Display Title / Name:</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Master Pricing Sheet Q4 2026.pdf"
                value={formName}
                onChange={e => setFormName(e.target.value)}
              />
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
                {COMPANY_CATEGORIES.filter(c => c !== 'All').map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div className="form-group">
              <label className="form-label">Notes for Sales Executives:</label>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="Provide instructions or selling points for the sales team..."
                value={formDescription}
                onChange={e => setFormDescription(e.target.value)}
              />
            </div>

            {/* Footer */}
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
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload size={16} />
                    <span>Upload to Resources</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
