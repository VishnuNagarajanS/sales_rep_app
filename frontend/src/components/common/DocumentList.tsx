import React, { useState, useEffect } from 'react';
import { FileText, FileImage, FileSpreadsheet, Trash2, File } from 'lucide-react';
import { DocumentItem } from '../../types';
import { storageService } from '../../services/storageService';
import { EmptyState } from './EmptyState';
import './DocumentList.css';

// ── Types ────────────────────────────────────────────────────────────────────

interface DocumentListProps {
  entityType: DocumentItem['entityType'];
  entityId: string;
  /** If true, a delete button is rendered per row. Default: false. */
  canDelete?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  const [docs, setDocs] = useState<DocumentItem[]>([]);

  const loadDocs = () => {
    setDocs(storageService.getDocuments(entityType, entityId));
  };

  useEffect(() => {
    loadDocs();
    window.addEventListener('nexus_storage_updated', loadDocs);
    return () => window.removeEventListener('nexus_storage_updated', loadDocs);
  }, [entityType, entityId]);

  const handleDelete = (id: string) => {
    if (confirm('Remove this document record?')) {
      storageService.deleteDocument(id);
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

          {/* Delete */}
          {canDelete && (
            <button
              className="btn btn-ghost btn-sm btn-icon document-item-delete-btn"
              title="Remove document record"
              onClick={() => handleDelete(doc.id)}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
};
