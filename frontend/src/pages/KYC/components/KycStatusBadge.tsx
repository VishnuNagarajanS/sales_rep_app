import React from 'react';
import {
  Clock,
  Send,
  Loader2,
  FileCheck2,
  ShieldAlert,
  ShieldCheck,
  XCircle,
  AlertTriangle,
  CheckCircle2,
  UserCheck,
} from 'lucide-react';
import './KycLinkComponents.css';

export type CustomerKycStatus =
  | 'Pending'
  | 'Link Sent'
  | 'In Progress'
  | 'Submitted'
  | 'Under Verification'
  | 'Verified'
  | 'Completed'
  | 'Rejected'
  | 'Needs Correction'
  | 'Wrong'
  | 'Assisted Draft'
  | 'Assisted KYC – Submitted for Verification';

interface KycStatusBadgeProps {
  status: CustomerKycStatus;
}

export const KycStatusBadge: React.FC<KycStatusBadgeProps> = ({ status }) => {
  switch (status) {
    case 'Assisted Draft':
      return (
        <span
          className="kyc-link-badge"
          style={{
            background: 'rgba(245, 158, 11, 0.12)',
            color: '#d97706',
            borderColor: 'rgba(245, 158, 11, 0.35)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontWeight: 600,
          }}
          title="Assisted KYC draft is saved and incomplete — can be resumed at any time"
        >
          <Clock size={11} />
          Assisted Draft
        </span>
      );
    case 'Assisted KYC – Submitted for Verification':
      return (
        <span
          className="kyc-link-badge"
          style={{
            background: 'rgba(124, 58, 237, 0.12)',
            color: '#7c3aed',
            borderColor: 'rgba(124, 58, 237, 0.3)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
          title="Assisted KYC – Submitted for Verification"
        >
          <UserCheck size={11} />
          Under Verification
        </span>
      );
    case 'Pending':
      return (
        <span className="kyc-link-badge kyc-link-badge-pending">
          <Clock size={11} />
          Pending
        </span>
      );
    case 'Link Sent':
      return (
        <span className="kyc-link-badge kyc-link-badge-link-sent">
          <Send size={11} />
          Link Sent
        </span>
      );
    case 'In Progress':
      return (
        <span className="kyc-link-badge kyc-link-badge-in-progress">
          <Loader2 size={11} />
          In Progress
        </span>
      );
    case 'Submitted':
      return (
        <span className="kyc-link-badge kyc-link-badge-submitted">
          <FileCheck2 size={11} />
          Submitted
        </span>
      );
    case 'Under Verification':
      return (
        <span className="kyc-link-badge kyc-link-badge-under-verification">
          <ShieldAlert size={11} />
          Under Verification
        </span>
      );
    case 'Completed':
      return (
        <span className="kyc-link-badge kyc-link-badge-verified">
          <CheckCircle2 size={11} />
          Completed
        </span>
      );
    case 'Verified':
      return (
        <span className="kyc-link-badge kyc-link-badge-verified">
          <ShieldCheck size={11} />
          Verified
        </span>
      );
    case 'Rejected':
    case 'Wrong':
      return (
        <span className="kyc-link-badge kyc-link-badge-rejected">
          <XCircle size={11} />
          {status}
        </span>
      );
    case 'Needs Correction':
      return (
        <span className="kyc-link-badge kyc-link-badge-needs-correction">
          <AlertTriangle size={11} />
          Needs Correction
        </span>
      );
    default:
      return (
        <span className="kyc-link-badge kyc-link-badge-pending">
          <Clock size={11} />
          {status}
        </span>
      );
  }
};

import { getCustomerKycStatus as getKycStatusFromService } from '../../../services/kycService';

export const getMockCustomerKycStatus = (dealId: string, currentStatus?: string): CustomerKycStatus => {
  return getKycStatusFromService(dealId, currentStatus);
};
