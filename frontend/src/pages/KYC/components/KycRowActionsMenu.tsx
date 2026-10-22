import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  MoreVertical,
  Ban,
  Copy,
  Phone,
  ArrowRight,
  UserCheck,
} from 'lucide-react';
import { Deal } from '../../../types';
import { getAuthHeaders } from '../../../utils/authHeaders';
import './KycLinkComponents.css';

interface KycRowActionsMenuProps {
  deal: Deal;
  onShowToast: (msg: string) => void;
  onOpenReview?: (deal: Deal) => void;
  onViewProfile?: (deal: Deal) => void;
  onEditKyc?: (deal: Deal) => void;
  onAssistedKyc?: (deal: Deal) => void;
  onCallInvestor?: (deal: Deal) => void;
  onAdvanceStage?: (deal: Deal) => void;
  isGhlAdmin?: boolean;
}

export const KycRowActionsMenu: React.FC<KycRowActionsMenuProps> = ({
  deal,
  onShowToast,
  onAssistedKyc,
  onCallInvestor,
  onAdvanceStage,
  isGhlAdmin = false,
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

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsOpen(false);
    try {
      const kycId = (deal as any).kycId || (deal as any).kycRecordId;
      if (kycId) {
        const res = await fetch(`/api/irm/kyc/${kycId}`, { headers: getAuthHeaders() });
        if (res.ok) {
          const json = await res.json();
          if (json?.success && json?.data?.kycLinkToken) {
            const link = `${window.location.origin}/kyc/${json.data.kycLinkToken}`;
            await navigator.clipboard?.writeText(link);
            onShowToast(`KYC Link copied for ${deal.customerName}`);
            return;
          }
        }
      }

      // If no token on KYC yet, fetch/create real link from backend
      const sendRes = await fetch('/api/irm/kyc/send-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          dealId: deal.id,
          investorId: deal.customerId || deal.id,
          customerName: deal.customerName,
          email: deal.email || '',
          phone: deal.phone || '',
          baseUrl: window.location.origin,
        }),
      });
      const sendJson = await sendRes.json();
      if (sendRes.ok && sendJson?.success && sendJson?.data?.link) {
        await navigator.clipboard?.writeText(sendJson.data.link);
        onShowToast(`KYC Link copied for ${deal.customerName}`);
      } else {
        throw new Error(sendJson?.message || 'Could not copy link');
      }
    } catch (err: any) {
      onShowToast(err.message || `Failed to copy KYC link for ${deal.customerName}`);
    }
  };

  const handleRevoke = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsOpen(false);
    try {
      const kycId = (deal as any).kycId || (deal as any).kycRecordId;
      if (!kycId) {
        onShowToast(`No active KYC link to revoke for ${deal.customerName}`);
        return;
      }
      const res = await fetch(`/api/irm/kyc/${kycId}/revoke-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
      });
      const json = await res.json();
      if (res.ok && json?.success) {
        onShowToast(`KYC Link revoked for ${deal.customerName}`);
        window.dispatchEvent(new CustomEvent('nexus_storage_updated'));
      } else {
        throw new Error(json?.message || 'Failed to revoke link');
      }
    } catch (err: any) {
      onShowToast(err.message || `Failed to revoke KYC link for ${deal.customerName}`);
    }
  };

  const handleCall = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsOpen(false);
    if (onCallInvestor) onCallInvestor(deal);
  };

  const handleAdvance = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
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
          {!isGhlAdmin && (
            <>
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
                className="kyc-link-menu-item kyc-link-menu-item-danger"
                role="menuitem"
                onClick={handleRevoke}
              >
                <Ban size={14} />
                <span>Revoke Link</span>
              </button>
            </>
          )}

          {(onAssistedKyc || onCallInvestor || onAdvanceStage) && !isGhlAdmin && (
            <div className="kyc-link-menu-divider" />
          )}

          {!isGhlAdmin && onAssistedKyc && (() => {
            const draftRaw = localStorage.getItem(`nexus_kyc_draft_${deal.id}`);
            let hasDraft = (deal as any).customerKycStatus === 'Assisted Draft';
            let draftStep = 1;
            if (draftRaw) {
              try {
                const parsed = JSON.parse(draftRaw);
                if (parsed.isAssisted || parsed.step) {
                  hasDraft = true;
                  draftStep = parsed.step || 1;
                }
              } catch {}
            }
            return (
              <button
                type="button"
                className="kyc-link-menu-item"
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setIsOpen(false);
                  onAssistedKyc(deal);
                }}
                style={{ color: hasDraft ? '#d97706' : '#7c3aed', fontWeight: 600 }}
              >
                <UserCheck size={14} color={hasDraft ? '#d97706' : '#7c3aed'} />
                <span>{hasDraft ? `Resume Assisted KYC (Draft Step ${draftStep})` : 'Fill KYC on Behalf (Assisted)'}</span>
              </button>
            );
          })()}

          {!isGhlAdmin && onCallInvestor && (
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

          {!isGhlAdmin && onAdvanceStage && (
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
