import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import './Modal.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string | React.ReactNode;
  subtitle?: string | React.ReactNode;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | string;
  maxWidth?: string | number;
  footer?: React.ReactNode;
  headerActions?: React.ReactNode;
  className?: string;
}

const MODAL_SIZE_MAP: Record<string, number> = {
  sm: 440,
  md: 560,
  lg: 820,
  xl: 1040,
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  size,
  maxWidth,
  footer,
  headerActions,
  className = '',
}) => {
  const resolvedMaxWidth = maxWidth ?? (size ? (MODAL_SIZE_MAP[size] ?? size) : 560);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={`card animate-slide-down modal-card ${className}`.trim()}
        style={{
          maxWidth: typeof resolvedMaxWidth === 'number' ? `${resolvedMaxWidth}px` : resolvedMaxWidth,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div style={{ minWidth: 0, flex: 1, marginRight: headerActions ? 16 : 0 }}>
            <h3 className="modal-title">{title}</h3>
            {subtitle && (
              <p className="modal-subtitle">
                {subtitle}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {headerActions}
            <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close modal">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="modal-body">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="modal-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
