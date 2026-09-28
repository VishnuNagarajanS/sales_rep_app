import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  MoreVertical,
  RotateCw,
  Ban,
  Copy,
  FileSearch,
  Eye,
  FileCheck,
  Phone,
  ArrowRight,
} from 'lucide-react';
import { Deal } from '../../../types';
import './KycLinkComponents.css';

interface KycRowActionsMenuProps {
  deal: Deal;
  onOpenReview: (deal: Deal) => void;
  onShowToast: (msg: string) => void;
  onViewProfile?: (deal: Deal) => void;
  onEditKyc?: (deal: Deal) => void;
  onCallInvestor?: (deal: Deal) => void;
  onAdvanceStage?: (deal: Deal) => void;
}

export const KycRowActionsMenu: React.FC<KycRowActionsMenuProps> = ({
  deal,
  onOpenReview,
  onShowToast,
  onViewProfile,
  onEditKyc,
  onCallInvestor,
  onAdvanceStage,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top?: number; bottom?: number; right: number } | null>(null);
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
      if (spaceBelow < 280) {
        setMenuPos({ bottom: window.innerHeight - rect.top + 4, right: window.innerWidth - rect.right });
      } else {
        setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
      }
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  const handleReview = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    onOpenReview(deal);
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    // TODO(logic): Generate real dynamic customer token
    const mockToken = `tok_${(deal.id || 'demo').replace(/[^a-zA-Z0-9]/g, '').slice(-8)}`;
    const link = `${window.location.origin}/kyc/${mockToken}`;
    navigator.clipboard?.writeText(link);
    onShowToast(`KYC Link copied for ${deal.customerName} (demo)`);
  };

  const handleResend = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    // TODO(logic): Connect to IRM notification / SMS / WhatsApp dispatch
    onShowToast(`KYC Link resent to ${deal.customerName} (demo)`);
  };

  const handleRevoke = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    // TODO(logic): Invalidate link token in backend database
    onShowToast(`KYC Link revoked for ${deal.customerName} (demo)`);
  };

  const handleProfile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    if (onViewProfile) onViewProfile(deal);
  };

  const handleEditKyc = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    if (onEditKyc) onEditKyc(deal);
  };

  const handleCall = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    if (onCallInvestor) onCallInvestor(deal);
  };

  const handleAdvance = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    if (onAdvanceStage) onAdvanceStage(deal);
  };

  return (
    <div className="kyc-link-menu-wrapper" onClick={e => e.stopPropagation()}>
      <button
        ref={triggerRef}
        type="button"
        className="kyc-link-menu-trigger btn btn-ghost btn-icon btn-sm"
        title="Actions"
        aria-label="Actions"
        style={{ width: 30, height: 30 }}
        onClick={toggleMenu}
      >
        <MoreVertical size={16} />
      </button>

      {isOpen && menuPos && createPortal(
        <div
          ref={dropdownRef}
          className="kyc-link-menu-dropdown"
          style={{
            position: 'fixed',
            top: menuPos.top,
            bottom: menuPos.bottom,
            right: menuPos.right,
            zIndex: 99999,
          }}
          onClick={e => e.stopPropagation()}
          role="menu"
        >
          <button
            type="button"
            className="kyc-link-menu-item"
            role="menuitem"
            onClick={handleReview}
          >
            <FileSearch size={14} color="#06b6d4" />
            <span>Review Submission</span>
          </button>

          <button
            type="button"
            className="kyc-link-menu-item"
            role="menuitem"
            onClick={handleCopy}
          >
            <Copy size={14} color="#64748b" />
            <span>Copy Link</span>
          </button>

          <button
            type="button"
            className="kyc-link-menu-item"
            role="menuitem"
            onClick={handleResend}
          >
            <RotateCw size={14} color="#3b82f6" />
            <span>Resend Link</span>
          </button>

          <button
            type="button"
            className="kyc-link-menu-item kyc-link-menu-item-danger"
            role="menuitem"
            onClick={handleRevoke}
          >
            <Ban size={14} />
            <span>Revoke Link</span>
          </button>

          {(onViewProfile || onEditKyc || onCallInvestor || onAdvanceStage) && (
            <div className="kyc-link-menu-divider" />
          )}

          {onViewProfile && (
            <button
              type="button"
              className="kyc-link-menu-item"
              role="menuitem"
              onClick={handleProfile}
            >
              <Eye size={14} color="#06b6d4" />
              <span>View Full Profile</span>
            </button>
          )}

          {onEditKyc && (
            <button
              type="button"
              className="kyc-link-menu-item"
              role="menuitem"
              onClick={handleEditKyc}
            >
              <FileCheck size={14} color="#10b981" />
              <span>Complete / Edit KYC Flow</span>
            </button>
          )}

          {onCallInvestor && (
            <button
              type="button"
              className="kyc-link-menu-item"
              role="menuitem"
              onClick={handleCall}
            >
              <Phone size={14} color="#059669" />
              <span>Call Investor</span>
            </button>
          )}

          {onAdvanceStage && (
            <button
              type="button"
              className="kyc-link-menu-item"
              role="menuitem"
              onClick={handleAdvance}
            >
              <ArrowRight size={14} color="var(--primary-600)" />
              <span>Advance to Opportunity</span>
            </button>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};
