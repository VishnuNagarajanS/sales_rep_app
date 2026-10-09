import React, { useState, useEffect } from 'react';
import { apiClient } from '../../services/apiClient';
import { isMockMode } from '../../config/environment';
import { FileText, FileImage, FileSpreadsheet, Trash2, File, Share2, Mail, MessageSquare, Download } from 'lucide-react';
import { DocumentItem } from '../../types';
import { EmptyState } from './EmptyState';
import { useAuth } from '../../context/AuthContext';
import './DocumentList.css';

// ── Types ────────────────────────────────────────────────────────────────────

interface DocumentListProps {
  entityType: DocumentItem['entityType'];
  entityId: string;
  /** If true, a delete button is rendered per row. Default: false. */
  canDelete?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const saveStoredDocument = (doc: DocumentItem, silent = false): void => {
  try {
    const raw = localStorage.getItem('nexus_documents');
    const docs: DocumentItem[] = raw ? JSON.parse(raw) : [];
    const index = docs.findIndex(d => d.id === doc.id);
    if (index >= 0) {
      docs[index] = doc;
    } else {
      docs.unshift(doc);
    }
    localStorage.setItem('nexus_documents', JSON.stringify(docs));
    if (!silent) window.dispatchEvent(new Event('nexus_storage_updated'));
  } catch { }
};

const isCompanyMatch = (id1?: string, id2?: string) => {
  if (!id1 || !id2) return true;
  if (id1 === id2) return true;
  const ghlAliases = ['1', 'ghl', 't-ghl-01', 't-ghl-1'];
  if (ghlAliases.includes(id1.toLowerCase()) && ghlAliases.includes(id2.toLowerCase())) return true;
  const jaminAliases = ['2', 'jamin', 't-jamin-02', 't-jamin-2'];
  if (jaminAliases.includes(id1.toLowerCase()) && jaminAliases.includes(id2.toLowerCase())) return true;
  return false;
};

const getStoredDocuments = (entityType?: DocumentItem['entityType'], entityId?: string): DocumentItem[] => {
  try {
    const raw = localStorage.getItem('nexus_documents');
    const docs: DocumentItem[] = raw ? JSON.parse(raw) : [];
    if (entityType) {
      if (entityType === 'company') {
        return docs.filter(d => d.entityType === 'company' && isCompanyMatch(d.entityId, entityId));
      }
      if (entityId) {
        return docs.filter(d => d.entityType === entityType && d.entityId === entityId);
      }
    }
    return docs;
  } catch {
    return [];
  }
};

const deleteStoredDocument = (id: string): void => {
  try {
    const raw = localStorage.getItem('nexus_documents');
    const docs: DocumentItem[] = raw ? JSON.parse(raw) : [];
    const filtered = docs.filter(d => d.id !== id);
    localStorage.setItem('nexus_documents', JSON.stringify(filtered));
    window.dispatchEvent(new Event('nexus_storage_updated'));
  } catch { }
};

function getFileIcon(mimeType: string): React.ReactNode {
  if (mimeType.startsWith('image/')) {
    return <FileImage size={20} color="#0284c7" />;
  }
  if (
    mimeType.includes('spreadsheet') ||
    mimeType.includes('excel') ||
    mimeType.includes('csv')
  ) {
    return <FileSpreadsheet size={20} color="#059669" />;
  }
  if (mimeType.includes('pdf') || mimeType.includes('word') || mimeType.includes('text')) {
    return <FileText size={20} color="var(--primary-600)" />;
  }
  return <File size={20} color="var(--text-secondary)" />;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const DocumentList: React.FC<DocumentListProps> = ({
  entityType,
  entityId,
  canDelete = false,
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role?.code === 'company_admin' || user?.role?.code === 'super_admin';
  const showDelete = canDelete || isAdmin;
  const [docs, setDocs] = useState<DocumentItem[]>([]);

  const loadDocs = async () => {
    if (isMockMode()) {
      setDocs(getStoredDocuments(entityType, entityId));
    } else {
      try {
        const res = await apiClient.get<any>(`/documents?entityType=${entityType}&entityId=${entityId}`);
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          setDocs(res.data);
          // Sync to local cache so all components have access
          res.data.forEach((d: DocumentItem) => saveStoredDocument(d, true));
        } else {
          // Fallback to local storage if API returned empty
          const cached = getStoredDocuments(entityType, entityId);
          if (cached.length > 0) {
            setDocs(cached);
          } else if (res.success && res.data) {
            setDocs(res.data);
          }
        }
      } catch (err) {
        console.error('Failed to load documents from API, falling back to cache:', err);
        setDocs(getStoredDocuments(entityType, entityId));
      }
    }
  };

  useEffect(() => {
    loadDocs();
    window.addEventListener('nexus_storage_updated', loadDocs);
    return () => window.removeEventListener('nexus_storage_updated', loadDocs);
  }, [entityType, entityId]);

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to remove this document?')) {
      if (!isMockMode()) {
        try {
          await apiClient.delete(`/documents/${id}`);
        } catch (err) {
          console.error('Failed to delete document from server', err);
          alert('Failed to delete document from server.');
          return;
        }
      }

      // Do local cleanup only after API succeeds
      deleteStoredDocument(id);
      setDocs(prev => prev.filter(d => d.id !== id));
    }
  };

  if (docs.length === 0) {
    return (
      <EmptyState
        title="No documents logged"
        description="Upload a file above to start tracking documents for this record."
      />
    );
  }

  return (
    <div className="document-list-container">
      <div className="document-list-count">
        {docs.length} Document{docs.length !== 1 ? 's' : ''} Logged
      </div>

      {docs.map(doc => (
        <div key={doc.id} className="document-item-row">
          {/* Type icon */}
          <div className="document-item-icon">{getFileIcon(doc.type)}</div>

          {/* File info */}
          <div className="document-item-details">
            <div className="document-item-name">
              {doc.name}
            </div>
            <div className="document-item-meta">
              <span>{doc.size}</span>
              <span className="document-item-category">
                {doc.category}
              </span>
              <span>by {doc.uploadedBy}</span>
              <span>{doc.uploadedAt}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="document-item-actions">
            <button
              className="document-action-btn whatsapp-btn"
              title="Share via WhatsApp"
              onClick={() => {
                const text = encodeURIComponent(`Hi, here is the document you requested: ${doc.name}\n${doc.fileUrl || ''}`);
                window.open(`https://wa.me/?text=${text}`, '_blank');
              }}
            >
              <MessageSquare size={16} color="#25D366" />
            </button>
            <button
              className="document-action-btn email-btn"
              title="Share via Email"
              onClick={() => {
                const subject = encodeURIComponent(`Document: ${doc.name}`);
                const body = encodeURIComponent(`Hi,\n\nHere is the document we discussed:\n${doc.fileUrl || ''}\n\nThank you.`);
                window.open(`mailto:?subject=${subject}&body=${body}`);
              }}
            >
              <Mail size={16} color="currentColor" />
            </button>
            <button
              className="document-action-btn download-btn"
              title="Download / Copy Link"
              onClick={() => {
                navigator.clipboard.writeText(doc.fileUrl || '');
                if (doc.fileUrl) {
                  window.open(doc.fileUrl, '_blank');
                } else {
                  alert('This is a mock document metadata log. No actual file was uploaded yet.');
                }
              }}
            >
              <Download size={16} color="currentColor" />
            </button>

            {showDelete && (
              <button
                className="document-action-btn delete-btn"
                title="Remove document"
                onClick={() => handleDelete(doc.id)}
              >
                <Trash2 size={16} color="#f87171" />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
