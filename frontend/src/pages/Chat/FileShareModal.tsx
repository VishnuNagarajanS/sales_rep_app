import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../../components/common/Modal';
import { FileCategory, FilePermission, ChatAttachment } from '../../types';
import { FileText, Image as ImageIcon, FileSpreadsheet, File, Shield, Eye, Download, Edit3, UploadCloud, RefreshCw } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (attachment: ChatAttachment) => void;
  initialFile?: {
    file: globalThis.File;
    dataUrl: string;
  } | null;
}

export function detectCategory(name: string, mime: string): FileCategory {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf' || mime === 'application/pdf') return 'PDF';
  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) return 'Image';
  if (['xls', 'xlsx', 'csv', 'tsv'].includes(ext) || mime.includes('sheet') || mime.includes('excel')) return 'Spreadsheet';
  if (['doc', 'docx', 'txt', 'rtf', 'md'].includes(ext) || mime.includes('word') || mime.includes('text')) return 'Document';
  return 'Other';
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export const FileShareModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onConfirm,
  initialFile,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<{ file: globalThis.File; dataUrl: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [permission, setPermission] = useState<FilePermission>('view_download');

  useEffect(() => {
    if (isOpen) {
      setSelectedFile(initialFile || null);
      setPermission('view_download');
      setIsDragging(false);
    } else {
      setSelectedFile(null);
    }
  }, [isOpen, initialFile]);

  const processFile = (file: globalThis.File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setSelectedFile({
        file,
        dataUrl: reader.result as string,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleConfirm = () => {
    if (!selectedFile) return;
    const attachment: ChatAttachment = {
      id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: selectedFile.file.name,
      size: selectedFile.file.size,
      type: selectedFile.file.type || 'application/octet-stream',
      category: detectCategory(selectedFile.file.name, selectedFile.file.type),
      permission,
      dataUrl: selectedFile.dataUrl,
    };
    onConfirm(attachment);
    onClose();
  };

  const permissions: { id: FilePermission; label: string; desc: string; badge: string; icon: React.ReactNode }[] = [
    {
      id: 'read_only',
      label: 'Read-only',
      desc: 'In-app view only; download is blocked for recipients.',
      badge: 'View only',
      icon: <Eye size={15} />,
    },
    {
      id: 'view_download',
      label: 'View & Download',
      desc: 'Recipients can preview and download to device.',
      badge: 'Default',
      icon: <Download size={15} />,
    },
    {
      id: 'view_edit',
      label: 'View & Edit',
      desc: 'Recipients can view, download, and submit revisions.',
      badge: 'Full Access',
      icon: <Edit3 size={15} />,
    },
  ];

  const renderFileIcon = () => {
    if (!selectedFile) return null;
    const cat = detectCategory(selectedFile.file.name, selectedFile.file.type);
    if (cat === 'Image' && selectedFile.dataUrl.startsWith('data:image/')) {
      return <img src={selectedFile.dataUrl} alt="Preview" className="file-share-thumb-sm" />;
    }
    if (cat === 'PDF') return <FileText size={22} className="file-share-cat-icon pdf" />;
    if (cat === 'Spreadsheet') return <FileSpreadsheet size={22} className="file-share-cat-icon sheet" />;
    return <FileText size={22} className="file-share-cat-icon doc" />;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Share File to Chat"
      subtitle="Select a file and configure recipient permission level before sending."
      maxWidth={580}
      footer={
        <div className="file-share-footer-bar">
          <span className="file-share-summary-hint">
            {selectedFile ? (
              <>Permission: <strong>{permission === 'read_only' ? 'Read-only' : permission === 'view_download' ? 'View & Download' : 'View & Edit'}</strong></>
            ) : (
              <>Choose a file to attach to your message</>
            )}
          </span>
          <div className="file-share-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!selectedFile}
              onClick={handleConfirm}
            >
              Attach to Message
            </button>
          </div>
        </div>
      }
    >
      <div className="file-share-dialog-content">
        {/* Hidden native file input inside the modal */}
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileInputChange}
        />

        {/* 1. File Selection / Dropzone OR Compact Preview */}
        {!selectedFile ? (
          <div
            className={`file-share-dropzone ${isDragging ? 'dragging' : ''}`}
            onDragOver={handleDragOver}
            onDragEnter={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="file-share-dropzone-icon">
              <UploadCloud size={32} />
            </div>
            <div className="file-share-dropzone-text">
              <span className="file-share-dropzone-primary">
                Drag and drop your file here, or <span className="file-share-browse-link">Browse files</span>
              </span>
              <span className="file-share-dropzone-sub">
                Supports documents, PDFs, images, and spreadsheets
              </span>
            </div>
          </div>
        ) : (
          <div className="file-share-preview-compact">
            <div className="file-share-icon-wrap-sm">
              {renderFileIcon()}
            </div>
            <div className="file-share-meta-compact">
              <div className="file-share-name-compact" title={selectedFile.file.name}>
                {selectedFile.file.name}
              </div>
              <div className="file-share-sub-compact">
                <span>{formatBytes(selectedFile.file.size)}</span>
              </div>
            </div>
            <button
              type="button"
              className="file-share-change-btn"
              onClick={() => fileInputRef.current?.click()}
              title="Select a different file"
            >
              <RefreshCw size={12} />
              <span>Change file</span>
            </button>
          </div>
        )}

        {/* 2. Recipient Permission Level (Always visible) */}
        <div className="file-share-section">
          <div className="file-share-section-hdr">
            <span className="file-share-section-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Shield size={14} style={{ color: 'var(--primary-600)' }} />
              Recipient Permission Level
            </span>
            <span className="file-share-section-sub">Enforced server-side per recipient</span>
          </div>
          <div className="file-share-permissions-grid">
            {permissions.map(p => (
              <div
                key={p.id}
                className={`file-perm-card-col ${permission === p.id ? 'active' : ''}`}
                onClick={() => setPermission(p.id)}
              >
                <div className="file-perm-col-header">
                  <span className="file-perm-icon">{p.icon}</span>
                  <span className={`file-perm-badge badge-${p.id}`}>{p.badge}</span>
                  <input
                    type="radio"
                    name="file_permission"
                    checked={permission === p.id}
                    onChange={() => setPermission(p.id)}
                    className="file-perm-radio"
                  />
                </div>
                <div className="file-perm-col-title">{p.label}</div>
                <div className="file-perm-col-desc">{p.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
};
