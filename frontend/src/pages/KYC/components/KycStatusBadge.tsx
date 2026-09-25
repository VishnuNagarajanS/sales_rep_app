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
} from 'lucide-react';
import './KycLinkComponents.css';

export type CustomerKycStatus =
  | 'Pending'
  | 'Link Sent'
  | 'In Progress'
  | 'Submitted'
  | 'Under Verification'
  | 'Verified'
  | 'Rejected'
  | 'Needs Correction';

interface KycStatusBadgeProps {
  status: CustomerKycStatus;
}

export const KycStatusBadge: React.FC<KycStatusBadgeProps> = ({ status }) => {
  switch (status) {
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
    case 'Verified':
      return (
        <span className="kyc-link-badge kyc-link-badge-verified">
          <ShieldCheck size={11} />
          Verified
        </span>
      );
    case 'Rejected':
      return (
        <span className="kyc-link-badge kyc-link-badge-rejected">
          <XCircle size={11} />
          Rejected
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

// TODO(logic): In production, fetch this live customer KYC status from the backend/webhook.
export const getMockCustomerKycStatus = (dealId: string, currentStatus?: string): CustomerKycStatus => {
  if (currentStatus === 'completed') return 'Verified';
  
  // Deterministic mock status generation based on dealId so each row shows a realistic variation
  const charCode = (dealId || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const statuses: CustomerKycStatus[] = [
    'Link Sent',
    'In Progress',
    'Submitted',
    'Under Verification',
    'Needs Correction',
    'Pending',
  ];
  return statuses[charCode % statuses.length];
};
