import React from 'react';
import { Send, RefreshCw, UserCheck, Clock } from 'lucide-react';
import { Deal } from '../../../types';
import './KycLinkComponents.css';

interface KycStageActionDropdownProps {
  deal: Deal;
  isResend: boolean;
  isIrmRole: boolean;
  isDraft?: boolean;
  onSendLink: () => void;
  onAssistedKyc: () => void;
}

export const KycStageActionDropdown: React.FC<KycStageActionDropdownProps> = ({
  isResend,
  isIrmRole,
  isDraft = false,
  onSendLink,
  onAssistedKyc,
}) => {
  const linkLabel = isResend ? 'Resend KYC Link' : 'Send KYC Link';
  const assistedLabel = isDraft ? 'Resume Draft' : 'Assisted KYC';

  return (
    <div
      className="kyc-stage-action-group"
      onClick={e => e.stopPropagation()}
    >
      {/* Action 1: Send / Resend KYC Link Standalone Icon Button */}
      <div className="kyc-stage-action-tooltip-wrapper">
        <button
          type="button"
          className="kyc-stage-action-btn kyc-stage-action-btn--link"
          aria-label={linkLabel}
          title={linkLabel}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onSendLink();
          }}
        >
          {isResend ? <RefreshCw size={13} /> : <Send size={13} />}
        </button>
        <span className="kyc-stage-action-tooltip" role="tooltip">
          {linkLabel}
        </span>
      </div>

      {/* Action 2: Assisted KYC / Resume Draft Standalone Icon Button (IRM only) */}
      {isIrmRole && (
        <div className="kyc-stage-action-tooltip-wrapper">
          <button
            type="button"
            className={`kyc-stage-action-btn ${isDraft ? 'kyc-stage-action-btn--draft' : 'kyc-stage-action-btn--assisted'}`}
            aria-label={assistedLabel}
            title={assistedLabel}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onAssistedKyc();
            }}
          >
            {isDraft ? <Clock size={13} /> : <UserCheck size={14} />}
          </button>
          <span className="kyc-stage-action-tooltip" role="tooltip">
            {assistedLabel}
          </span>
        </div>
      )}
    </div>
  );
};

export const KycStageActionButtons = KycStageActionDropdown;
