import React, { useState, useEffect } from 'react';
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
import { CustomerKycStatus, KycChecklist, normalizeLegacyKycStatus } from '../../../services/kycService';
import { useAuth } from '../../../context/AuthContext';
import { PERMISSIONS } from '../../../constants/permissions';
import { Modal } from '../../../components/common/Modal';
import { getAuthHeaders } from '../../../utils/authHeaders';

function maskAadhaar(v?: string | null): string {
  if (!v) return '—';
  const clean = v.replace(/\s/g, '');
  if (clean.length < 4) return clean;
  return 'XXXX XXXX ' + clean.slice(-4);
}

function maskAccount(v?: string | null): string {
  if (!v) return '—';
  if (v.length <= 4) return v;
  return '\u2022'.repeat(Math.min(v.length - 4, 8)) + v.slice(-4);
}

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
  /** Hide the small chevron on the badge (the badge stays clickable). */
  hideArrow?: boolean;
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
  hideArrow = false,
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

  // Real submitted details for review modal (no mock fixtures)
  const [liveKycData, setLiveKycData] = useState<any | null>(null);

  useEffect(() => {
    if (!showVerifiedModal || !deal) return;
    const fetchKyc = async () => {
      try {
        // 1. Stable direct KYC record ID or investor/customer ID
        const kycId = (deal as any).kycId || (deal as any).kycRecordId || (deal as any).customerId;
        if (kycId) {
          const res = await fetch(`/api/irm/kyc/${kycId}`, {
            headers: getAuthHeaders(),
          });
          if (res.ok) {
            const json = await res.json();
            if (json.success && json.data) {
              setLiveKycData(json.data);
              return;
            }
          }
        }

        // 2. Fallback to email match
        if (deal.email) {
          const res = await fetch(`/api/irm/kyc/by-email?email=${encodeURIComponent(deal.email)}`, {
            headers: getAuthHeaders(),
          });
          if (res.ok) {
            const json = await res.json();
            if (json.success && json.data) {
              setLiveKycData(json.data);
              return;
            }
          }
        }
      } catch (err) {
        console.warn('Could not fetch live KYC for dropdown:', err);
      }
    };
    fetchKyc();
  }, [showVerifiedModal, deal]);

  const displayStatus = localStatus || currentStatus;

  const isDraftOnly =
    customerKycStatus === 'Assisted Draft' ||
    Boolean(localStorage.getItem(`nexus_kyc_draft_${deal.id}`) && !localStorage.getItem(`nexus_kyc_assisted_${deal.id}`));

  const canVerifyCustomer =
    !isDraftOnly && (
      customerKycStatus === 'Completed' ||
      customerKycStatus === 'Submitted' ||
      customerKycStatus === 'Under Verification' ||
      customerKycStatus === 'Verified' ||
      customerKycStatus === 'Assisted KYC – Submitted for Verification' ||
      Boolean((deal as any).customerKycStatus === 'Submitted' || (deal as any).customerKycStatus === 'Completed' || (deal as any).customerKycStatus === 'Assisted KYC – Submitted for Verification') ||
      Boolean(localStorage.getItem(`nexus_kyc_status_${deal.id}`) === 'Completed') ||
      Boolean(localStorage.getItem(`nexus_kyc_status_${deal.id}`) === 'Submitted for Review') ||
      Boolean(localStorage.getItem(`nexus_kyc_assisted_${deal.id}`))
    );

  let parsedNomsForChecklist: any[] = [];
  if (liveKycData?.nomineesJson) {
    try { parsedNomsForChecklist = JSON.parse(liveKycData.nomineesJson); } catch {}
  }
  const hasNominees = Boolean(
    parsedNomsForChecklist && parsedNomsForChecklist.length > 0 && parsedNomsForChecklist[0]?.name
  );

  const allChecklistCompleted =
    checklist.identity &&
    checklist.bank &&
    checklist.documents &&
    (!hasNominees || checklist.nominee) &&
    checklist.demat;

  const handleSelect = (status: 'Pending' | 'Wrong' | 'Verified') => {
    if (status === displayStatus) {
      setIsOpen(false);
      return;
    }
    setIsOpen(false);

    if (status === 'Verified') {
      if (isDraftOnly) {
        triggerToast('Cannot verify: Assisted KYC is currently an incomplete draft and has not been submitted yet.', 'error');
        return;
      }
      if (!canVerifyCustomer) {
        triggerToast('Customer has not submitted KYC details yet.', 'error');
        return;
      }
      // Reset checklist to false — IRM must manually inspect and tick each item
      setChecklist({
        identity: false,
        bank: false,
        documents: false,
        nominee: false,
        demat: false,
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
          {canVerify && !hideArrow && <ChevronDown size={12} style={{ marginLeft: 2, opacity: 0.8 }} />}
        </button>
      </div>

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
                ? (hasNominees ? '✓ All 5 checklist items confirmed' : '✓ All required checklist items confirmed (Nominee waived)')
                : (hasNominees ? '⚠ Please verify and tick all 5 checklist items before proceeding' : '⚠ Please verify and tick all required checklist items before proceeding')}
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
              <div><span style={{ color: 'var(--text-muted)' }}>Name as per PAN:</span> <strong>{liveKycData?.nameAsPerPan || '—'}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>PAN Number:</span> <strong>{liveKycData?.panNumber || '—'}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Aadhaar Number:</span> <strong>{maskAadhaar(liveKycData?.aadhaarNumber)}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>DOB:</span> <strong>{liveKycData?.dateOfBirth || liveKycData?.dob || '—'}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Father's Name:</span> <strong>{liveKycData?.fatherName || '—'}</strong></div>
              <div style={{ gridColumn: '1 / -1' }}><span style={{ color: 'var(--text-muted)' }}>Address:</span> <strong>{[liveKycData?.addressLine1, liveKycData?.addressLine2, liveKycData?.city, liveKycData?.state, liveKycData?.pincode].filter(Boolean).join(', ') || '—'}</strong></div>
            </div>
          </div>

          {/* Section 2: Bank Details */}
          <div style={{ border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 8, padding: 14 }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Building size={15} color="#059669" /> 2. Bank Account Details
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, fontSize: 12 }}>
              <div><span style={{ color: 'var(--text-muted)' }}>Account Holder:</span> <strong>{liveKycData?.accountHolderName || '—'}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Bank Name:</span> <strong>{liveKycData?.bankName || '—'}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Account Number:</span> <strong>{maskAccount(liveKycData?.accountNumber)}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Account Type:</span> <strong>{liveKycData?.accountType || '—'}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>IFSC Code:</span> <strong>{liveKycData?.ifscCode || '—'}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Branch:</span> <strong>{liveKycData?.branchName || '—'}</strong></div>
            </div>
          </div>

          {/* Section 3: Uploaded Documents */}
          <div style={{ border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 8, padding: 14 }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              <FileText size={15} color="#7c3aed" /> 3. Uploaded Documents
            </h4>
            {(() => {
              const uploadedDocs: Array<{ id: string; name: string; size: string }> = [];
              if (liveKycData?.panDocumentUrl) uploadedDocs.push({ id: 'pan', name: 'PAN Card Copy', size: 'Uploaded Document (Pending Review)' });
              if (liveKycData?.aadhaarDocumentUrl) uploadedDocs.push({ id: 'aadhaar', name: 'Aadhaar Card Copy', size: 'Uploaded Document (Pending Review)' });
              if (liveKycData?.bankChequeUrl) uploadedDocs.push({ id: 'cheque', name: 'Bank Cheque / Statement', size: 'Uploaded Document (Pending Review)' });
              if (liveKycData?.dematDocumentUrl) uploadedDocs.push({ id: 'demat', name: 'Demat Statement Proof', size: 'Uploaded Document (Pending Review)' });
              if (liveKycData?.signatureUrl) uploadedDocs.push({ id: 'signature', name: 'Investor Signature Specimen', size: 'Uploaded Document (Pending Review)' });

              return uploadedDocs.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                  {uploadedDocs.map((doc) => (
                    <div
                      key={doc.id}
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
                      <span style={{ fontSize: 11, color: '#d97706', fontWeight: 600 }}>{doc.size}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No documents submitted</div>
              );
            })()}
          </div>

          {/* Section 4: Nominee & Demat */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 8, padding: 14 }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Users size={15} color="#ea580c" /> 4. Nominee Details
              </h4>
              {(() => {
                let parsedNoms: any[] = [];
                if (liveKycData?.nomineesJson) {
                  try { parsedNoms = JSON.parse(liveKycData.nomineesJson); } catch {}
                }
                return parsedNoms.length > 0 ? (
                  parsedNoms.map((n: any, i: number) => (
                    <div key={i} style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div><strong>{n.name}</strong> ({n.relationship || 'Nominee'})</div>
                      <div style={{ color: 'var(--text-muted)' }}>Allocation: <strong>{n.allocationPercentage}%</strong></div>
                    </div>
                  ))
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Single applicant (100% estate)</span>
                );
              })()}
            </div>

            <div style={{ border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 8, padding: 14 }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <CreditCard size={15} color="#0284c7" /> 5. Demat Account
              </h4>
              <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div><span style={{ color: 'var(--text-muted)' }}>Account Number:</span> <strong>{liveKycData?.dematAccountNumber || '—'}</strong></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Depository:</span> <strong>{liveKycData?.dematDepository || '—'}</strong></div>
                <div><span style={{ color: 'var(--text-muted)' }}>DP ID:</span> <strong>{liveKycData?.dpId || liveKycData?.dematDpId || '—'}</strong></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Client ID:</span> <strong>{liveKycData?.dematClientId || '—'}</strong></div>
              </div>
            </div>
          </div>

          {/* Provider Results */}
          <div style={{ border: '1px dashed var(--border-color, #cbd5e1)', borderRadius: 8, padding: 12, background: 'rgba(241, 245, 249, 0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                Automated Provider Checks
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
                Provider APIs Pending
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              External verification provider APIs are not connected. Manual verification using the checklist below is mandatory.
            </div>
          </div>

          {/* Verification Checklist */}
          <div style={{ border: '2px solid #10b981', borderRadius: 8, padding: 14, background: 'rgba(16, 185, 129, 0.04)' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: 13, fontWeight: 700, color: '#047857' }}>
              ✓ Mandatory IRM Verification Checklist (Must tick all 5 to approve)
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
              <label htmlFor={`kyc-checklist-identity-${deal.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  id={`kyc-checklist-identity-${deal.id}`}
                  name="checklistIdentity"
                  type="checkbox"
                  checked={checklist.identity}
                  onChange={e => setChecklist(prev => ({ ...prev, identity: e.target.checked }))}
                />
                <span>I have verified the customer's Identity (PAN & Aadhaar match)</span>
              </label>

              <label htmlFor={`kyc-checklist-bank-${deal.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  id={`kyc-checklist-bank-${deal.id}`}
                  name="checklistBank"
                  type="checkbox"
                  checked={checklist.bank}
                  onChange={e => setChecklist(prev => ({ ...prev, bank: e.target.checked }))}
                />
                <span>I have verified the Bank details and account ownership</span>
              </label>

              <label htmlFor={`kyc-checklist-documents-${deal.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  id={`kyc-checklist-documents-${deal.id}`}
                  name="checklistDocuments"
                  type="checkbox"
                  checked={checklist.documents}
                  onChange={e => setChecklist(prev => ({ ...prev, documents: e.target.checked }))}
                />
                <span>I have inspected all uploaded Documents for validity & clarity</span>
              </label>

              {hasNominees ? (
                <label htmlFor={`kyc-checklist-nominee-${deal.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    id={`kyc-checklist-nominee-${deal.id}`}
                    name="checklistNominee"
                    type="checkbox"
                    checked={checklist.nominee}
                    onChange={e => setChecklist(prev => ({ ...prev, nominee: e.target.checked }))}
                  />
                  <span>I have verified the Nominee nomination and allocation percentages</span>
                </label>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#059669', background: 'rgba(16, 185, 129, 0.08)', padding: '6px 10px', borderRadius: 6, fontSize: 12 }}>
                  <ShieldCheck size={14} style={{ flexShrink: 0 }} />
                  <span>No Nominee Submitted (Opted out / Single applicant — Verified &amp; Waived)</span>
                </div>
              )}

              <label htmlFor={`kyc-checklist-demat-${deal.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  id={`kyc-checklist-demat-${deal.id}`}
                  name="checklistDemat"
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
                const effectiveChecklist = {
                  ...checklist,
                  nominee: !hasNominees ? true : checklist.nominee,
                };
                await executeChange(
                  'Verified',
                  'Manual verification completed by IRM',
                  undefined,
                  effectiveChecklist
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
            <label htmlFor={`kyc-wrong-comment-${deal.id}`} style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
              Reason / Remarks for Rejection <span style={{ color: '#ef4444' }}>* (Mandatory)</span>
            </label>
            <textarea
              id={`kyc-wrong-comment-${deal.id}`}
              name="wrongComment"
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
            <div style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
              Select Incorrect / Incomplete Sections:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
              {SECTION_OPTIONS.map(opt => (
                <label
                  key={opt.id}
                  htmlFor={`kyc-wrong-section-${deal.id}-${opt.id}`}
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
                    id={`kyc-wrong-section-${deal.id}-${opt.id}`}
                    name={`wrongSection_${opt.id}`}
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
