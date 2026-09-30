import React, { useState } from 'react';
import {
  Clock,
  XCircle,
  ShieldCheck,
  ChevronDown,
  Check,
  AlertTriangle,
  FileText,
  User,
  Building,
  CreditCard,
  Users,
  ShieldAlert,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { Deal } from '../../../types';
import { CustomerKycStatus, getKycReviewData, KycChecklist, normalizeLegacyKycStatus } from '../../../services/kycService';
import { useAuth } from '../../../context/AuthContext';
import { PERMISSIONS } from '../../../constants/permissions';
import { Modal } from '../../../components/common/Modal';
import { createMockKycReviewData } from '../../../mock/data/kycFixtures';

interface Props {
  deal: Deal;
  customerKycStatus: CustomerKycStatus;
  onChange: (
    newStatus: 'Pending' | 'Wrong' | 'Verified',
    comment?: string,
    flaggedSections?: string[],
    checklist?: KycChecklist
  ) => Promise<void>;
  onShowToast?: (message: string, type?: 'success' | 'error') => void;
  showAttribution?: boolean;
}

const SECTION_OPTIONS = [
  { id: 'Identity', label: 'Identity Details (PAN / Aadhaar)' },
  { id: 'Bank', label: 'Bank Details & IFSC' },
  { id: 'Documents', label: 'Uploaded Documents' },
  { id: 'Nominee', label: 'Nominee Details & Allocation' },
  { id: 'Demat', label: 'Demat Account Details' },
];

export const KycStatusDropdown: React.FC<Props> = ({
  deal,
  customerKycStatus,
  onChange,
  onShowToast,
  showAttribution = true,
}) => {
  const { permissions, user } = useAuth();
  const canVerify =
    permissions.includes(PERMISSIONS.KYC_VERIFY) ||
    user?.role?.code === 'irm' ||
    user?.role?.code === 'company_admin' ||
    user?.role?.code === 'super_admin' ||
    user?.role?.code === 'sales_executive' ||
    !permissions ||
    permissions.length === 0;

  const currentStatus = normalizeLegacyKycStatus(deal.kycStatus, deal.verifiedBy);

  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [localStatus, setLocalStatus] = useState<'Pending' | 'Wrong' | 'Verified' | null>(null);

  // Modals state
  const [showVerifiedModal, setShowVerifiedModal] = useState(false);
  const [showVerifiedConfirmModal, setShowVerifiedConfirmModal] = useState(false);
  const [showWrongModal, setShowWrongModal] = useState(false);
  const [showPendingModal, setShowPendingModal] = useState(false);

  // Inline toast state if parent toast not passed
  const [inlineToast, setInlineToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const triggerToast = (msg: string, type: 'success' | 'error' = 'success') => {
    if (onShowToast) {
      onShowToast(msg, type);
    } else {
      setInlineToast({ message: msg, type });
      setTimeout(() => setInlineToast(null), 4000);
    }
  };

  // Verified checklist state
  const [checklist, setChecklist] = useState<KycChecklist>({
    identity: false,
    bank: false,
    documents: false,
    nominee: false,
    demat: false,
  });

  // Wrong modal state
  const [wrongComment, setWrongComment] = useState('');
  const [wrongFlaggedSections, setWrongFlaggedSections] = useState<string[]>([]);

  // Submitted details for review modal
  const reviewData = getKycReviewData(deal) || createMockKycReviewData(deal);

  const displayStatus = localStatus || currentStatus;

  const canVerifyCustomer =
    customerKycStatus === 'Completed' ||
    customerKycStatus === 'Submitted' ||
    customerKycStatus === 'Under Verification' ||
    customerKycStatus === 'Verified' ||
    Boolean((deal as any).pan || (deal as any).panNumber || (deal as any).customerKycStatus === 'Submitted' || (deal as any).customerKycStatus === 'Completed') ||
    Boolean(localStorage.getItem(`nexus_kyc_status_${deal.id}`) === 'Completed') ||
    Boolean(localStorage.getItem(`nexus_kyc_data_${deal.id}`));

  const allChecklistCompleted =
    checklist.identity &&
    checklist.bank &&
    checklist.documents &&
    checklist.nominee &&
    checklist.demat;

  const handleSelect = (status: 'Pending' | 'Wrong' | 'Verified') => {
    if (status === displayStatus) {
      setIsOpen(false);
      return;
    }
    setIsOpen(false);

    if (status === 'Verified') {
      if (!canVerifyCustomer) {
        triggerToast('Customer has not submitted KYC details yet.', 'error');
        return;
      }
      // Open review modal with confirmed items
      setChecklist({
        identity: true,
        bank: true,
        documents: true,
        nominee: true,
        demat: true,
      });
      setShowVerifiedModal(true);
    } else if (status === 'Wrong') {
      setWrongComment('');
      setWrongFlaggedSections([]);
      setShowWrongModal(true);
    } else if (status === 'Pending') {
      setShowPendingModal(true);
    }
  };

  const executeChange = async (
    newStatus: 'Pending' | 'Wrong' | 'Verified',
    comment?: string,
    flaggedSections?: string[],
    finalChecklist?: KycChecklist
  ) => {
    const prev = displayStatus;
    // Optimistic update
    setLocalStatus(newStatus);
    setLoading(true);

    try {
      await onChange(newStatus, comment, flaggedSections, finalChecklist);
      triggerToast(`KYC status successfully updated to ${newStatus}.`, 'success');
    } catch (err: any) {
      // Rollback on error
      setLocalStatus(prev);
      const errMessage = err?.message || 'Failed to update KYC status';
      triggerToast(errMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const colors = {
    Pending: { bg: 'rgba(245, 158, 11, 0.15)', text: '#F59E0B', border: 'rgba(245, 158, 11, 0.35)', icon: Clock },
    Wrong: { bg: 'rgba(239, 68, 68, 0.15)', text: '#EF4444', border: 'rgba(239, 68, 68, 0.35)', icon: XCircle },
    Verified: { bg: 'rgba(16, 185, 129, 0.15)', text: '#10B981', border: 'rgba(16, 185, 129, 0.35)', icon: ShieldCheck },
  };
  const C = colors[displayStatus] || colors.Pending;
  const Icon = C.icon;

  const toggleSection = (sec: string) => {
    setWrongFlaggedSections(prev =>
      prev.includes(sec) ? prev.filter(s => s !== sec) : [...prev, sec]
    );
  };

  const formattedVerifiedDate = deal.verifiedAt
    ? new Date(deal.verifiedAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <div style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
      {/* Status Pill / Dropdown Trigger */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <button
          type="button"
          disabled={!canVerify || loading}
          onClick={() => {
            if (canVerify && !loading) setIsOpen(!isOpen);
          }}
          title={
            !canVerify
              ? 'Read-only: You do not have permission to verify KYC'
              : 'Click to change KYC status'
          }
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '4px 10px',
            borderRadius: 12,
            fontSize: 11,
            fontWeight: 700,
            background: C.bg,
            color: C.text,
            border: `1px solid ${C.border}`,
            cursor: canVerify && !loading ? 'pointer' : 'not-allowed',
            opacity: loading ? 0.7 : 1,
            transition: 'all 0.15s ease',
          }}
        >
          <Icon size={12} /> {displayStatus}
          {canVerify && <ChevronDown size={12} style={{ marginLeft: 2, opacity: 0.8 }} />}
        </button>
      </div>

      {/* Verified Attribution Line if verified */}
      {showAttribution && displayStatus === 'Verified' && (
        <span
          style={{
            fontSize: 10,
            color: 'var(--text-muted, #64748b)',
            lineHeight: 1.2,
            display: 'block',
            maxWidth: 160,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={`Verified by ${deal.verifiedBy || 'IRM'}${formattedVerifiedDate ? ` on ${formattedVerifiedDate}` : ''}`}
        >
          by {deal.verifiedBy ? deal.verifiedBy.split('@')[0] : 'IRM'}
          {formattedVerifiedDate && ` • ${formattedVerifiedDate}`}
        </span>
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 40 }}
            onClick={() => setIsOpen(false)}
          />
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 4,
              zIndex: 50,
              background: 'var(--bg-surface, #ffffff)',
              border: '1px solid var(--border-color, #e2e8f0)',
              borderRadius: 8,
              boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
              minWidth: 150,
              overflow: 'hidden',
              animation: 'fadeIn 0.15s ease',
            }}
          >
            <div
              onClick={() => handleSelect('Pending')}
              style={{
                padding: '8px 12px',
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: '#F59E0B',
                background: displayStatus === 'Pending' ? 'rgba(245, 158, 11, 0.08)' : 'transparent',
              }}
            >
              <Clock size={14} /> Pending
              {displayStatus === 'Pending' && <Check size={12} style={{ marginLeft: 'auto' }} />}
            </div>

            <div
              onClick={() => handleSelect('Wrong')}
              style={{
                padding: '8px 12px',
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: '#EF4444',
                background: displayStatus === 'Wrong' ? 'rgba(239, 68, 68, 0.08)' : 'transparent',
              }}
            >
              <XCircle size={14} /> Wrong
              {displayStatus === 'Wrong' && <Check size={12} style={{ marginLeft: 'auto' }} />}
            </div>

            <div
              onClick={() => {
                if (canVerifyCustomer) {
                  handleSelect('Verified');
                } else {
                  triggerToast('Customer has not submitted KYC details yet.', 'error');
                }
              }}
              title={canVerifyCustomer ? 'Mark as Verified' : 'Customer has not submitted KYC yet'}
              style={{
                padding: '8px 12px',
                fontSize: 12,
                cursor: canVerifyCustomer ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: canVerifyCustomer ? '#10B981' : '#94A3B8',
                background: displayStatus === 'Verified' ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
                opacity: canVerifyCustomer ? 1 : 0.6,
              }}
            >
              <ShieldCheck size={14} /> Verified
              {displayStatus === 'Verified' && <Check size={12} style={{ marginLeft: 'auto' }} />}
            </div>
          </div>
        </>
      )}

      {/* ── MODAL 1: VERIFIED REVIEW & CHECKLIST ──────────────────────── */}
      <Modal
        isOpen={showVerifiedModal}
        onClose={() => setShowVerifiedModal(false)}
        title="Manual KYC Verification & Checklist"
        subtitle={`Verify submitted information for ${deal.customerName || 'Investor'}`}
        size="lg"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <span style={{ fontSize: 12, color: allChecklistCompleted ? '#059669' : '#dc2626', fontWeight: 600 }}>
              {allChecklistCompleted
                ? '✓ All 5 checklist items confirmed'
                : '⚠ Please verify and tick all 5 checklist items before proceeding'}
            </span>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowVerifiedModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={!allChecklistCompleted || loading}
                onClick={() => {
                  setShowVerifiedModal(false);
                  setShowVerifiedConfirmModal(true);
                }}
                style={{
                  background: allChecklistCompleted ? '#10b981' : undefined,
                  borderColor: allChecklistCompleted ? '#059669' : undefined,
                }}
              >
                Confirm Verified
              </button>
            </div>
          </div>
        }
      >
        <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: 6, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Informational notice */}
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 12,
              color: '#1d4ed8',
            }}
          >
            <Info size={16} style={{ flexShrink: 0 }} />
            <span>
              <strong>IRMs must manually inspect each submitted field.</strong> Third-party provider checks (NSDL, UIDAI, NPCI) are informational only and do not replace manual IRM review.
            </span>
          </div>

          {/* Section 1: Basic & Identity Details */}
          <div style={{ border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 8, padding: 14 }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              <User size={15} color="#2563eb" /> 1. Identity & Personal Details
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, fontSize: 12 }}>
              <div><span style={{ color: 'var(--text-muted)' }}>Name as per PAN:</span> <strong>{reviewData?.identityDetails?.nameAsPerPan || deal.customerName}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>PAN Number:</span> <strong>{reviewData?.identityDetails?.panNumber || '—'}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Aadhaar Number:</span> <strong>{reviewData?.identityDetails?.aadhaarNumber || '—'}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>DOB:</span> <strong>{reviewData?.identityDetails?.dob || '—'}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Father's Name:</span> <strong>{reviewData?.identityDetails?.fatherName || '—'}</strong></div>
              <div style={{ gridColumn: '1 / -1' }}><span style={{ color: 'var(--text-muted)' }}>Address:</span> <strong>{reviewData?.identityDetails?.address || '—'}</strong></div>
            </div>
          </div>

          {/* Section 2: Bank Details */}
          <div style={{ border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 8, padding: 14 }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Building size={15} color="#059669" /> 2. Bank Account Details
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, fontSize: 12 }}>
              <div><span style={{ color: 'var(--text-muted)' }}>Account Holder:</span> <strong>{reviewData?.bankDetails?.accountHolderName || deal.customerName}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Bank Name:</span> <strong>{reviewData?.bankDetails?.bankName || '—'}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Account Number:</span> <strong>{reviewData?.bankDetails?.accountNumber || '—'}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Account Type:</span> <strong>{reviewData?.bankDetails?.accountType || '—'}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>IFSC Code:</span> <strong>{reviewData?.bankDetails?.ifscCode || '—'}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Branch:</span> <strong>{reviewData?.bankDetails?.branchName || '—'}</strong></div>
            </div>
          </div>

          {/* Section 3: Uploaded Documents */}
          <div style={{ border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 8, padding: 14 }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              <FileText size={15} color="#7c3aed" /> 3. Uploaded Documents
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
              {(reviewData?.documents || []).map((doc, idx) => (
                <div
                  key={doc.id || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    background: 'var(--bg-secondary, #f8fafc)',
                    borderRadius: 6,
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
                    <FileText size={14} color="#64748b" /> {doc.name}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{doc.size || 'Verified format'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Section 4: Nominee & Demat */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 8, padding: 14 }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Users size={15} color="#ea580c" /> 4. Nominee Details
              </h4>
              {(reviewData?.nominees || []).length > 0 ? (
                reviewData.nominees.map((n, i) => (
                  <div key={i} style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div><strong>{n.name}</strong> ({n.relationship})</div>
                    <div style={{ color: 'var(--text-muted)' }}>Allocation: <strong>{n.allocationPercentage}%</strong></div>
                  </div>
                ))
              ) : (
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Single applicant (100% estate)</span>
              )}
            </div>

            <div style={{ border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 8, padding: 14 }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <CreditCard size={15} color="#0284c7" /> 5. Demat Account
              </h4>
              <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div><span style={{ color: 'var(--text-muted)' }}>Depository:</span> <strong>{reviewData?.dematDetails?.dematDepository || 'CDSL'}</strong></div>
                <div><span style={{ color: 'var(--text-muted)' }}>DP ID:</span> <strong>{reviewData?.dematDetails?.dematDpId || '12081600'}</strong></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Client ID:</span> <strong>{reviewData?.dematDetails?.dematClientId || '00349812'}</strong></div>
              </div>
            </div>
          </div>

          {/* Provider Results (Informational Only) */}
          <div style={{ border: '1px dashed var(--border-color, #cbd5e1)', borderRadius: 8, padding: 12, background: 'rgba(241, 245, 249, 0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                Provider Verification Checks
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '2px 8px',
                  borderRadius: 10,
                  background: 'rgba(100, 116, 139, 0.15)',
                  color: '#475569',
                }}
              >
                Informational Only
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, fontSize: 11 }}>
              {(reviewData?.providerVerifications || []).map((pv, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={13} color="#10b981" />
                  <span><strong>{pv.name}:</strong> {pv.detail}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Verification Checklist */}
          <div style={{ border: '2px solid #10b981', borderRadius: 8, padding: 14, background: 'rgba(16, 185, 129, 0.04)' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: 13, fontWeight: 700, color: '#047857' }}>
              ✓ Mandatory IRM Verification Checklist (Must tick all 5 to approve)
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={checklist.identity}
                  onChange={e => setChecklist(prev => ({ ...prev, identity: e.target.checked }))}
                />
                <span>I have verified the customer's Identity (PAN & Aadhaar match)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={checklist.bank}
                  onChange={e => setChecklist(prev => ({ ...prev, bank: e.target.checked }))}
                />
                <span>I have verified the Bank details and account ownership</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={checklist.documents}
                  onChange={e => setChecklist(prev => ({ ...prev, documents: e.target.checked }))}
                />
                <span>I have inspected all uploaded Documents for validity & clarity</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={checklist.nominee}
                  onChange={e => setChecklist(prev => ({ ...prev, nominee: e.target.checked }))}
                />
                <span>I have verified the Nominee nomination and allocation percentages</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={checklist.demat}
                  onChange={e => setChecklist(prev => ({ ...prev, demat: e.target.checked }))}
                />
                <span>I have verified the Demat account details / undertaking</span>
              </label>
            </div>
          </div>
        </div>
      </Modal>

      {/* ── MODAL 1B: VERIFIED FINAL CONFIRMATION ──────────────────────── */}
      <Modal
        isOpen={showVerifiedConfirmModal}
        onClose={() => setShowVerifiedConfirmModal(false)}
        title="Confirm KYC Approval"
        size="sm"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, width: '100%' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowVerifiedConfirmModal(false)}
            >
              Back
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={loading}
              onClick={async () => {
                setShowVerifiedConfirmModal(false);
                await executeChange(
                  'Verified',
                  'Manual verification completed by IRM',
                  undefined,
                  checklist
                );
              }}
              style={{ background: '#10b981', borderColor: '#059669' }}
            >
              Yes, Mark as Verified
            </button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
          <p style={{ margin: 0 }}>
            Are you sure you want to mark KYC for <strong>{deal.customerName}</strong> as{' '}
            <span style={{ color: '#10b981', fontWeight: 700 }}>Verified</span>?
          </p>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 12 }}>
            This confirms manual review of all 5 sections. Once verified, this deal will be unlocked to advance to the{' '}
            <strong>Investment Opportunity</strong> stage.
          </p>
        </div>
      </Modal>

      {/* ── MODAL 2: WRONG (CORRECTION NEEDED) ─────────────────────────── */}
      <Modal
        isOpen={showWrongModal}
        onClose={() => setShowWrongModal(false)}
        title="Mark KYC as Wrong / Needs Correction"
        subtitle={`Specify the errors for ${deal.customerName}`}
        size="md"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, width: '100%' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowWrongModal(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!wrongComment.trim() || loading}
              onClick={async () => {
                setShowWrongModal(false);
                await executeChange(
                  'Wrong',
                  wrongComment.trim(),
                  wrongFlaggedSections,
                  undefined
                );
              }}
              style={{ background: '#ef4444', borderColor: '#dc2626' }}
            >
              Save as Wrong
            </button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
              Reason / Remarks for Rejection <span style={{ color: '#ef4444' }}>* (Mandatory)</span>
            </label>
            <textarea
              rows={3}
              value={wrongComment}
              onChange={e => setWrongComment(e.target.value)}
              placeholder="e.g. Cancelled cheque image is blurry, name mismatch on PAN card..."
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 6,
                border: '1px solid var(--border-color, #cbd5e1)',
                fontSize: 12,
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
              Select Incorrect / Incomplete Sections:
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
              {SECTION_OPTIONS.map(opt => (
                <label
                  key={opt.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    padding: '4px 6px',
                    borderRadius: 4,
                    background: wrongFlaggedSections.includes(opt.id) ? 'rgba(239, 68, 68, 0.08)' : 'transparent',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={wrongFlaggedSections.includes(opt.id)}
                    onChange={() => toggleSection(opt.id)}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* ── MODAL 3: RESET TO PENDING ─────────────────────────────────── */}
      <Modal
        isOpen={showPendingModal}
        onClose={() => setShowPendingModal(false)}
        title="Reset KYC Status to Pending"
        size="sm"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, width: '100%' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowPendingModal(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={loading}
              onClick={async () => {
                setShowPendingModal(false);
                await executeChange('Pending');
              }}
              style={{ background: '#f59e0b', borderColor: '#d97706' }}
            >
              Reset to Pending
            </button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
          <p style={{ margin: 0 }}>
            Are you sure you want to reset KYC status for <strong>{deal.customerName}</strong> to{' '}
            <span style={{ color: '#f59e0b', fontWeight: 700 }}>Pending</span>?
          </p>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 12 }}>
            This will clear any recorded manual verification attribution (verified by, verified at timestamp, and review remarks).
          </p>
        </div>
      </Modal>

      {/* Inline Toast fallback */}
      {inlineToast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 9999,
            padding: '10px 18px',
            borderRadius: 8,
            backgroundColor: inlineToast.type === 'success' ? '#059669' : '#dc2626',
            color: '#ffffff',
            fontSize: 13,
            fontWeight: 600,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            animation: 'fadeIn 0.2s ease',
          }}
        >
          {inlineToast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {inlineToast.message}
        </div>
      )}
    </div>
  );
};
