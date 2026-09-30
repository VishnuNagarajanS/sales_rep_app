import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Send, RefreshCw, UserCheck, ChevronDown } from 'lucide-react';
import { Deal } from '../../../types';
import './KycLinkComponents.css';

interface KycStageActionDropdownProps {
  deal: Deal;
  isResend: boolean;
  isIrmRole: boolean;
  onSendLink: () => void;
  onAssistedKyc: () => void;
}

export const KycStageActionDropdown: React.FC<KycStageActionDropdownProps> = ({
  deal,
  isResend,
  isIrmRole,
  onSendLink,
  onAssistedKyc,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
  } | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClose = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        dropdownRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      setIsOpen(false);
    };

    const handleScroll = () => {
      if (isOpen) setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClose);
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleScroll);
    }
    return () => {
      document.removeEventListener('mousedown', handleClose);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [isOpen]);

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const menuWidth = 260;

      const pos: { top?: number; bottom?: number; left?: number; right?: number } = {};

      if (spaceBelow < 170) {
        pos.bottom = window.innerHeight - rect.top + 4;
      } else {
        pos.top = rect.bottom + 4;
      }

      // Check if aligning to left edge overflows the screen
      if (rect.left + menuWidth > window.innerWidth - 12) {
        pos.right = Math.max(12, window.innerWidth - rect.right);
      } else {
        pos.left = Math.max(12, rect.left);
      }

      setMenuPos(pos);
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  return (
    <div style={{ display: 'inline-block', position: 'relative' }} onClick={e => e.stopPropagation()}>
      <button
        ref={triggerRef}
        type="button"
        className="btn btn-sm btn-secondary"
        title={isResend ? 'Resend Customer KYC Link' : 'Send Customer KYC Link'}
        style={{
          fontSize: 11,
          padding: '5px 9px',
          fontWeight: 600,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          borderRadius: 6,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          borderColor: 'var(--primary-500, #3b82f6)',
          color: 'var(--primary-600, #2563eb)',
          background: isOpen ? 'rgba(37, 99, 235, 0.12)' : 'rgba(37, 99, 235, 0.06)',
          transition: 'all 0.15s ease',
        }}
        onClick={toggleMenu}
      >
        {isResend ? <RefreshCw size={12} /> : <Send size={12} />}
        <span>{isResend ? 'Resend Link' : 'Send KYC Link'}</span>
        <ChevronDown
          size={12}
          style={{
            transition: 'transform 0.2s ease',
            transform: isOpen ? 'rotate(180deg)' : 'none',
            opacity: 0.8,
          }}
        />
      </button>

      {isOpen && menuPos && createPortal(
        <div
          ref={dropdownRef}
          className="kyc-link-menu-dropdown card shadow-lg"
          style={{
            position: 'fixed',
            top: menuPos.top,
            bottom: menuPos.bottom,
            left: menuPos.left,
            right: menuPos.right,
            minWidth: 250,
            maxWidth: 280,
            zIndex: 99999,
            padding: '6px 0',
            borderRadius: 8,
            backgroundColor: 'var(--bg-surface, #ffffff)',
            border: '1px solid var(--border-base, #e2e8f0)',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          }}
          onClick={e => e.stopPropagation()}
          role="menu"
        >
          {/* Action 1: Send / Resend Link */}
          <button
            type="button"
            className="kyc-link-menu-item"
            role="menuitem"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '8px 14px',
              textAlign: 'left',
              width: '100%',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
              onSendLink();
            }}
          >
            <div style={{ marginTop: 2, flexShrink: 0 }}>
              {isResend ? <RefreshCw size={14} color="#2563eb" /> : <Send size={14} color="#2563eb" />}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary, #1e293b)' }}>
                {isResend ? 'Resend KYC Link' : 'Send KYC Link'}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted, #64748b)', lineHeight: 1.3 }}>
                Send digital KYC link to customer
              </span>
            </div>
          </button>

          {/* Action 2: Fill KYC on Behalf (Assisted KYC) */}
          {isIrmRole && (
            <button
              type="button"
              className="kyc-link-menu-item"
              role="menuitem"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '8px 14px',
                textAlign: 'left',
                width: '100%',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                borderTop: '1px solid var(--border-base, #f1f5f9)',
              }}
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
                onAssistedKyc();
              }}
            >
              <div style={{ marginTop: 2, flexShrink: 0 }}>
                <UserCheck size={14} color="#7c3aed" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#7c3aed' }}>
                    Fill KYC on Behalf
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '1px 5px',
                      borderRadius: 4,
                      background: 'rgba(124, 58, 237, 0.12)',
                      color: '#7c3aed',
                    }}
                  >
                    Assisted
                  </span>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted, #64748b)', lineHeight: 1.3 }}>
                  Complete and submit KYC for customer
                </span>
              </div>
            </button>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};
