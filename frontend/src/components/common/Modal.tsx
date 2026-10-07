import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import './Modal.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | string;
  maxWidth?: string | number;
  footer?: React.ReactNode;
  className?: string;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  hideCloseButton?: boolean;
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
  className = '',
  closeOnBackdrop = true,
  closeOnEscape = true,
  hideCloseButton = false,
}) => {
  const resolvedMaxWidth = maxWidth ?? (size ? (MODAL_SIZE_MAP[size] ?? size) : 560);
  const [shake, setShake] = React.useState(false);

  useEffect(() => {
    if (!closeOnEscape) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, closeOnEscape]);

  if (!isOpen) return null;

  const handleBackdropClick = () => {
    if (closeOnBackdrop) {
      onClose();
    } else {
      setShake(true);
      setTimeout(() => setShake(false), 450);
    }
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div
        className={`card animate-slide-down modal-card ${shake ? 'modal-card-shake' : ''} ${className}`.trim()}
        style={{
          maxWidth: typeof resolvedMaxWidth === 'number' ? `${resolvedMaxWidth}px` : resolvedMaxWidth,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div>
            <h3 className="modal-title">{title}</h3>
            {subtitle && (
              <p className="modal-subtitle">
                {subtitle}
              </p>
            )}
          </div>
          {!hideCloseButton && (
            <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close modal">
              <X size={18} />
            </button>
          )}
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
