import React, { useRef, useState } from 'react';
import { Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { DocumentItem } from '../../types';
import { documentStore } from '../../services/documentStore';
import { useAuth } from '../../context/AuthContext';
import './DocumentUploader.css';

// ── Types ────────────────────────────────────────────────────────────────────

interface DocumentUploaderProps {
  entityType: DocumentItem['entityType'];
  entityId: string;
  /** Optional category labels the user can pick from. Defaults to ['KYC', 'Agreement', 'Other']. */
  allowedCategories?: string[];
  /** Called after the document metadata has been saved to localStorage. */
  onUploaded?: (doc: DocumentItem) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const DocumentUploader: React.FC<DocumentUploaderProps> = ({
  entityType,
  entityId,
  allowedCategories = ['KYC', 'Agreement', 'Payment Receipt', 'Other'],
  onUploaded,
}) => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(allowedCategories[0]);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  const handleFile = (file: File) => {
    try {
      const doc: DocumentItem = {
        id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        size: formatFileSize(file.size),
        type: file.type || 'application/octet-stream',
        uploadedBy: user?.name || 'Unknown User',
        uploadedAt: new Date().toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
        category: selectedCategory,
        entityType,
        entityId,
      };

      documentStore.saveDocument(doc);
      onUploaded?.(doc);
      showToast('success', `"${file.name}" logged successfully.`);
    } catch {
      showToast('error', 'Failed to log document. Please try again.');
    }

    // Reset the file input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="document-uploader-container">
      {/* Category selector */}
      <div className="document-uploader-category-row">
        <label className="document-uploader-label">
          Category:
        </label>
        <select
          className="form-select document-uploader-select"
          value={selectedCategory}
          onChange={e => setSelectedCategory(e.target.value)}
        >
          {allowedCategories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Drop zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`document-dropzone ${isDragging ? 'dragging' : ''}`}
      >
        <Upload
          size={28}
          color={isDragging ? 'var(--primary-500)' : 'var(--primary-600)'}
          className="document-dropzone-icon"
        />
        <div className="document-dropzone-title">
          {isDragging ? 'Drop file here' : 'Choose File or Drag & Drop'}
        </div>
        <div className="document-dropzone-subtitle">
          PDF, JPG, PNG, DOCX up to 25 MB
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm document-dropzone-btn"
        >
          Browse Files
        </button>
      </div>

      {/* Metadata-only disclaimer */}
      <p className="document-disclaimer">
        ℹ️ <em>This logs document metadata (name, size, date) — file contents are not uploaded to a server yet. The log persists in your browser and will be ready to link to real storage once a backend is connected.</em>
      </p>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={handleInputChange}
        accept="*/*"
      />

      {/* Inline toast */}
      {toast && (
        <div className={`document-toast ${toast.type}`}>
          {toast.type === 'success'
            ? <CheckCircle2 size={15} />
            : <AlertCircle size={15} />}
          {toast.message}
        </div>
      )}
    </div>
  );
};
