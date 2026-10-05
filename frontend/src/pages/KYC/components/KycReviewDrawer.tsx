import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle,
  AlertTriangle,
  User,
  ShieldCheck,
  CreditCard,
  Building,
  FileText,
  FileCheck,
  Camera,
  Eye,
  Check,
  Clock,
  Send,
  UserCheck,
  AlertCircle,
  Info,
  Lock,
} from 'lucide-react';
import { Deal } from '../../../types';
import { normalizeLegacyKycStatus } from '../../../services/kycService';
import { saveDeal } from '../../../services/ghlApiService';
import { getAuthHeaders } from '../../../utils/authHeaders';
import './KycLinkComponents.css';

interface KycReviewDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  deal: Deal | null;
  onChangeKycStatus?: (
    deal: Deal,
    newStatus: 'Pending' | 'Wrong' | 'Verified',
    comment?: string,
    flaggedSections?: string[],
    checklist?: any
  ) => Promise<void>;
  onShowToast: (msg: string) => void;
}

function maskAadhaar(v?: string | null): string {
  if (!v) return 'Not provided';
  const clean = v.replace(/\s/g, '');
  if (clean.length < 4) return clean;
  return 'XXXX XXXX ' + clean.slice(-4);
}

function maskAccount(v?: string | null): string {
  if (!v) return 'Not provided';
  if (v.length <= 4) return v;
  return '\u2022'.repeat(Math.min(v.length - 4, 8)) + v.slice(-4);
}

export const KycReviewDrawer: React.FC<KycReviewDrawerProps> = ({
  isOpen,
  onClose,
  deal,
  onShowToast,
  onChangeKycStatus,
}) => {
  const [showCorrectionModal, setShowCorrectionModal] = useState<boolean>(false);
  const [correctionNote, setCorrectionNote] = useState<string>(
    'Please re-upload a clearer image of your PAN card and ensure the name matches your Aadhaar.'
  );
  const [liveKyc, setLiveKyc] = useState<any | null>(null);
  const [loadingKyc, setLoadingKyc] = useState<boolean>(false);
  const [approving, setApproving] = useState<boolean>(false);

  // Mandatory IRM verification checklist (Strictly initialized to false; no fabricated defaults)
  const [reviewChecklist, setReviewChecklist] = useState({
    identity: false,
    bank: false,
    documents: false,
    nominee: false,
    demat: false,
  });

  useEffect(() => {
    if (!isOpen || !deal) {
      setLiveKyc(null);
      setReviewChecklist({
        identity: false,
        bank: false,
        documents: false,
        nominee: false,
        demat: false,
      });
      return;
    }

    const fetchLiveKyc = async () => {
      setLoadingKyc(true);
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
              setLiveKyc(json.data);
              return;
            }
          }
        }

        // 2. Fallback to email match
        const email = deal.email;
        if (email) {
          const res = await fetch(`/api/irm/kyc/by-email?email=${encodeURIComponent(email)}`, {
            headers: getAuthHeaders(),
          });
          if (res.ok) {
            const json = await res.json();
            if (json.success && json.data) {
              setLiveKyc(json.data);
              return;
            }
          }
        }
      } catch (err) {
        console.warn('Could not fetch live KYC from backend:', err);
      } finally {
        setLoadingKyc(false);
      }
    };

    fetchLiveKyc();
  }, [isOpen, deal]);

  if (!isOpen || !deal) return null;

  // Real submission check: A KYC record has a genuine submission only if submittedAt exists,
  // or it is in PendingReview status, or it is an Assisted KYC with verified consent.
  const hasRealSubmission = Boolean(
    liveKyc?.submittedAt ||
    liveKyc?.status === 'PendingReview' ||
    (liveKyc?.isAssisted && liveKyc?.customerConsentObtained) ||
    deal.customerKycStatus === 'Submitted' ||
    deal.customerKycStatus === 'Assisted KYC – Submitted for Verification'
  );

  // Safe parse nominees from live submitted data
  let parsedNominees: any[] = [];
  if (liveKyc?.nomineesJson) {
    try {
      parsedNominees = JSON.parse(liveKyc.nomineesJson);
    } catch {
      parsedNominees = [];
    }
  }

  let assistedMeta: any = null;
  try {
    const raw = localStorage.getItem(`nexus_kyc_data_${deal.id}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      assistedMeta = parsed?.assistedMetadata;
    }
    if (!assistedMeta) {
      const aRaw = localStorage.getItem(`nexus_kyc_assisted_${deal.id}`);
      if (aRaw) assistedMeta = JSON.parse(aRaw);
    }
  } catch {}

  // Real uploaded documents only. An uploaded document is NOT automatically verified!
  const liveDocs: Array<{ id: string; name: string; size: string; verified: boolean; url?: string }> = [];
  if (liveKyc) {
    if (liveKyc.panDocumentUrl) {
      liveDocs.push({
        id: 'pan-doc',
        name: 'PAN Card Copy',
        size: 'Uploaded Document',
        verified: false,
        url: liveKyc.panDocumentUrl,
      });
    }
    if (liveKyc.aadhaarDocumentUrl) {
      liveDocs.push({
        id: 'aadhaar-doc',
        name: 'Aadhaar Card Copy',
        size: 'Uploaded Document',
        verified: false,
        url: liveKyc.aadhaarDocumentUrl,
      });
    }
    if (liveKyc.bankChequeUrl) {
      liveDocs.push({
        id: 'cheque-doc',
        name: 'Bank Cheque / Statement Proof',
        size: 'Uploaded Document',
        verified: false,
        url: liveKyc.bankChequeUrl,
      });
    }
    if (liveKyc.dematDocumentUrl) {
      liveDocs.push({
        id: 'demat-doc',
        name: 'Demat Statement Proof',
        size: 'Uploaded Document',
        verified: false,
        url: liveKyc.dematDocumentUrl,
      });
    }
    if (liveKyc.signatureUrl) {
      liveDocs.push({
        id: 'signature-doc',
        name: 'Investor Signature Specimen',
        size: 'Uploaded Document',
        verified: false,
        url: liveKyc.signatureUrl,
      });
    }
  }

  // Real review data mapping: only genuine inputs from customer or backend.
  // Fabricated defaults (Verified DOB, sample documents, 98.5% match, default bank details) removed.
  const reviewData = {
    refId: liveKyc?.id ? `KYC-${liveKyc.id.toString().padStart(6, '0')}` : 'KYC-PENDING',
    submissionDate: liveKyc?.submittedAt
      ? new Date(liveKyc.submittedAt).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : liveKyc?.customerConsentTimestamp
      ? new Date(liveKyc.customerConsentTimestamp).toLocaleDateString('en-IN')
      : 'Not submitted',
    basicDetails: {
      investorName: liveKyc?.investorName || deal.customerName || 'Not provided',
      phone: liveKyc?.phone || deal.phone || 'Not provided',
      email: liveKyc?.email || deal.email || 'Not provided',
      gender: liveKyc?.gender || 'Not provided',
      investorType: liveKyc?.investorType || deal.investorType || 'Not provided',
      residentType: liveKyc?.residentType || 'Not provided',
      occupation: liveKyc?.occupation || 'Not provided',
    },
    identityDetails: {
      panNumber: liveKyc?.panNumber || 'Not provided',
      nameAsPerPan: liveKyc?.nameAsPerPan || 'Not provided',
      aadhaarNumber: liveKyc?.aadhaarNumber ? maskAadhaar(liveKyc.aadhaarNumber) : 'Not provided',
      fatherName: liveKyc?.fatherName || 'Not provided',
      dob: liveKyc?.dateOfBirth || liveKyc?.dob || 'Not provided',
      address:
        [liveKyc?.addressLine1, liveKyc?.addressLine2, liveKyc?.city, liveKyc?.state, liveKyc?.pincode]
          .filter(Boolean)
          .join(', ') || 'Not provided',
      courierAddress: liveKyc?.addressLine2
        ? [liveKyc.addressLine2, liveKyc.city, liveKyc.pincode].filter(Boolean).join(', ')
        : 'Not provided',
    },
    bankDetails: {
      accountHolderName: liveKyc?.accountHolderName || 'Not provided',
      bankName: liveKyc?.bankName || 'Not provided',
      accountNumber: liveKyc?.accountNumber ? maskAccount(liveKyc.accountNumber) : 'Not provided',
      accountType: liveKyc?.accountType || 'Not provided',
      ifscCode: liveKyc?.ifscCode || 'Not provided',
      branchName: liveKyc?.branchName || 'Not provided',
    },
    dematDetails: {
      hasNoDemat: !liveKyc?.dematAccountNumber,
      dematAccountNumber: liveKyc?.dematAccountNumber || 'Not provided',
      dematDepository: liveKyc?.dematDepository || 'Not provided',
      dematDpId: liveKyc?.dpId || liveKyc?.dematDpId || 'Not provided',
      dematClientId: liveKyc?.dematClientId || 'Not provided',
    },
    nominees: parsedNominees,
    documents: liveDocs,
    consent: {
      acceptedAt: liveKyc?.submittedAt
        ? new Date(liveKyc.submittedAt).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : liveKyc?.customerConsentTimestamp
        ? new Date(liveKyc.customerConsentTimestamp).toLocaleDateString('en-IN')
        : 'Not submitted',
      termsVersion: liveKyc?.customerConsentDetails || (liveKyc?.submittedAt ? 'SEBI Digital Undertaking' : 'Not submitted'),
      ipHash: liveKyc?.submittedAt ? 'Recorded at submission' : 'Not recorded',
    },
    liveness: {
      capturedAt: liveKyc?.photoUrl && liveKyc?.submittedAt
        ? new Date(liveKyc.submittedAt).toLocaleTimeString('en-IN')
        : 'Not submitted',
      matchScore: liveKyc?.photoUrl ? 'Manual photo review required' : 'Not submitted',
      livenessStatus: liveKyc?.photoUrl ? 'Selfie Uploaded (Awaiting IRM Verification)' : 'Not submitted',
    },
  };

  const hasNominees = Boolean(
    parsedNominees && parsedNominees.length > 0 && parsedNominees[0]?.name
  );

  const allChecklistCompleted =
    reviewChecklist.identity &&
    reviewChecklist.bank &&
    reviewChecklist.documents &&
    (!hasNominees || reviewChecklist.nominee) &&
    reviewChecklist.demat;

  const handleApprove = async () => {
    if (!hasRealSubmission) {
      onShowToast('Cannot confirm KYC: No genuine submission exists for this customer.');
      return;
    }
    if (!allChecklistCompleted) {
      onShowToast(hasNominees ? 'Please complete all 5 checklist verification items before confirming approval.' : 'Please complete all required checklist verification items before confirming approval.');
      return;
    }

    setApproving(true);
    try {
      const effectiveChecklist = {
        ...reviewChecklist,
        nominee: !hasNominees ? true : reviewChecklist.nominee,
      };

      if (onChangeKycStatus) {
        await onChangeKycStatus(deal, 'Verified', 'KYC verified and approved by IRM', undefined, effectiveChecklist);
      } else {
        const kycId = liveKyc?.id || (deal as any).kycId || (deal as any).kycRecordId;
        if (kycId) {
          const res = await fetch(`/api/irm/kyc/${kycId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({
              status: 'Verified',
              comment: 'KYC verified and approved by IRM',
              checklist: effectiveChecklist,
            }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || `KYC verification failed (HTTP ${res.status})`);
          }
        }
        if (deal?.id) {
          await saveDeal({
            ...deal,
            kycStatus: 'Completed',
            verifiedBy: 'IRM Officer',
            verifiedAt: new Date().toISOString(),
          });
          localStorage.setItem(`nexus_kyc_status_${deal.id}`, 'Completed');
        }
        onShowToast(`KYC Approved for ${deal?.customerName || 'Investor'}! Verified in Database.`);
        window.dispatchEvent(new CustomEvent('nexus_storage_updated'));
      }
      onClose();
    } catch (err: any) {
      console.error('Approval API error:', err);
      onShowToast(err?.message || 'Error confirming KYC verification.');
    } finally {
      setApproving(false);
    }
  };

  const handleSendCorrection = async () => {
    if (liveKyc?.id) {
      try {
        const res = await fetch(`/api/irm/kyc/${liveKyc.id}/review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({ action: 'ReuploadRequested', remarks: correctionNote }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          console.error('Correction API error:', res.status, err);
        }
      } catch (err) {
        console.error('Correction API error:', err);
      }
    }

    if (deal?.id) {
      try {
        await saveDeal({ ...deal, kycStatus: 'Partially Completed' });
      } catch (err) {
        console.warn('Could not update deal kycStatus in DB:', err);
      }
      localStorage.setItem(`nexus_kyc_status_${deal.id}`, 'Partially Completed');
    }

    onShowToast(`Correction request sent to ${deal?.customerName || 'Investor'}`);
    setShowCorrectionModal(false);
    window.dispatchEvent(new CustomEvent('nexus_storage_updated'));
    onClose();
  };

  const handleViewDoc = (doc: { name: string; url?: string }) => {
    if (doc.url) {
      const w = window.open('');
      if (w) {
        if (doc.url.startsWith('data:application/pdf')) {
          w.document.write(`<iframe src="${doc.url}" style="width:100%;height:100%;border:none;"></iframe>`);
        } else {
          w.document.write(
            `<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0f172a;margin:0;"><img src="${doc.url}" style="max-width:90%;max-height:90vh;border-radius:8px;" alt="${doc.name}" /></div>`
          );
        }
      }
    } else {
      onShowToast(`Viewing ${doc.name}`);
    }
  };

  return (
    <div className="kyc-link-drawer-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="kyc-link-drawer" onClick={e => e.stopPropagation()} style={{ position: 'relative' }}>
        {/* Header */}
        <div className="kyc-link-drawer-header">
          <div className="kyc-link-drawer-title-area">
            <h2 className="kyc-link-drawer-title">
              <User size={20} color="var(--primary-600, #2563eb)" />
              {deal.customerName}
            </h2>
            <div className="kyc-link-drawer-ref">
              <span>{reviewData.refId}</span>
              <span>•</span>
              <span>Submitted: {reviewData.submissionDate}</span>
            </div>
          </div>
          <button type="button" className="kyc-link-modal-close-btn" onClick={onClose} aria-label="Close drawer">
            <X size={20} />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="kyc-link-drawer-body">
          {/* Submission status banner */}
          {!hasRealSubmission ? (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 8,
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                fontSize: 12,
                color: '#b91c1c',
                marginBottom: 16,
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong>Customer Has Not Submitted KYC:</strong>
                <div style={{ marginTop: 2, color: 'var(--text-secondary)' }}>
                  This customer record does not have a genuine submitted KYC form. KYC approval cannot be confirmed
                  until a real submission is completed by the customer or entered through Assisted KYC with verified consent.
                </div>
              </div>
            </div>
          ) : (
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
                marginBottom: 16,
              }}
            >
              <Info size={16} style={{ flexShrink: 0 }} />
              <span>
                <strong>Genuine Customer Submission Received:</strong> Inspect all submitted details and uploaded documents
                below. IRM manual verification is required before confirming approval.
              </span>
            </div>
          )}

          {assistedMeta && (
            <div
              style={{
                background: 'rgba(124, 58, 237, 0.08)',
                border: '1px solid rgba(124, 58, 237, 0.25)',
                borderRadius: 8,
                padding: '12px 14px',
                marginBottom: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#7c3aed', fontSize: 13 }}>
                <UserCheck size={16} /> Assisted KYC – Submitted on Behalf by IRM
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                Entered by IRM: <strong style={{ color: 'var(--text-primary)' }}>{assistedMeta.assistedByIrmName || 'IRM'}</strong>{' '}
                (ID: {assistedMeta.assistedByIrmId || '—'}) • Submitted:{' '}
                <strong>{new Date(assistedMeta.submittedAt).toLocaleString()}</strong>
              </div>
              <div style={{ fontSize: 11, color: '#059669', marginTop: 4, fontWeight: 600 }}>
                ✓ Customer consent and authorization recorded at submission
              </div>
            </div>
          )}

          {normalizeLegacyKycStatus(deal.kycStatus, deal.verifiedBy) === 'Verified' && (
            <div
              style={{
                padding: '10px 16px',
                borderRadius: 8,
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 12,
                color: '#047857',
                marginBottom: 16,
              }}
            >
              <ShieldCheck size={18} color="#10b981" />
              <span>
                <strong>Verified by {deal.verifiedBy || 'IRM'}</strong>
                {deal.verifiedAt &&
                  ` on ${new Date(deal.verifiedAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}`}
              </span>
            </div>
          )}

          {/* Section 1: Basic Details */}
          <div className="kyc-link-section-card">
            <div className="kyc-link-section-header">
              <h4 className="kyc-link-section-title">
                <User size={15} /> 1. Basic Details
              </h4>
            </div>
            <div className="kyc-link-field-grid">
              <div>
                <div className="kyc-link-field-label">Full Name</div>
                <div className="kyc-link-field-val">{reviewData.basicDetails.investorName}</div>
              </div>
              <div>
                <div className="kyc-link-field-label">Mobile Number</div>
                <div className="kyc-link-field-val">{reviewData.basicDetails.phone}</div>
              </div>
              <div>
                <div className="kyc-link-field-label">Email Address</div>
                <div className="kyc-link-field-val">{reviewData.basicDetails.email}</div>
              </div>
              <div>
                <div className="kyc-link-field-label">Gender</div>
                <div className="kyc-link-field-val">{reviewData.basicDetails.gender}</div>
              </div>
              <div>
                <div className="kyc-link-field-label">Investor Category</div>
                <div className="kyc-link-field-val">{reviewData.basicDetails.investorType}</div>
              </div>
              <div>
                <div className="kyc-link-field-label">Residential Status</div>
                <div className="kyc-link-field-val">{reviewData.basicDetails.residentType}</div>
              </div>
              <div className="kyc-link-field-full">
                <div className="kyc-link-field-label">Occupation / Source of Wealth</div>
                <div className="kyc-link-field-val">{reviewData.basicDetails.occupation}</div>
              </div>
            </div>
          </div>

          {/* Section 2: Identity Details */}
          <div className="kyc-link-section-card">
            <div className="kyc-link-section-header">
              <h4 className="kyc-link-section-title">
                <FileCheck size={15} /> 2. Identity &amp; Address
              </h4>
            </div>
            <div className="kyc-link-field-grid">
              <div>
                <div className="kyc-link-field-label">Permanent Account Number (PAN)</div>
                <div className="kyc-link-field-val kyc-link-field-val-masked" style={{ color: '#0284c7' }}>
                  {reviewData.identityDetails.panNumber}
                </div>
              </div>
              <div>
                <div className="kyc-link-field-label">Name as per PAN</div>
                <div className="kyc-link-field-val">{reviewData.identityDetails.nameAsPerPan}</div>
              </div>
              <div>
                <div className="kyc-link-field-label">Aadhaar (Masked UID)</div>
                <div className="kyc-link-field-val kyc-link-field-val-masked" style={{ color: '#0284c7' }}>
                  {reviewData.identityDetails.aadhaarNumber}
                </div>
              </div>
              <div>
                <div className="kyc-link-field-label">Father's Name</div>
                <div className="kyc-link-field-val">{reviewData.identityDetails.fatherName}</div>
              </div>
              <div>
                <div className="kyc-link-field-label">Date of Birth</div>
                <div className="kyc-link-field-val">{reviewData.identityDetails.dob}</div>
              </div>
              <div>
                <div className="kyc-link-field-label">Courier Address</div>
                <div className="kyc-link-field-val">{reviewData.identityDetails.courierAddress}</div>
              </div>
              <div className="kyc-link-field-full">
                <div className="kyc-link-field-label">Permanent Address</div>
                <div className="kyc-link-field-val">{reviewData.identityDetails.address}</div>
              </div>
            </div>
          </div>

          {/* Section 3: Bank Details */}
          <div className="kyc-link-section-card">
            <div className="kyc-link-section-header">
              <h4 className="kyc-link-section-title">
                <CreditCard size={15} /> 3. Bank Account
              </h4>
            </div>
            <div className="kyc-link-field-grid">
              <div>
                <div className="kyc-link-field-label">Account Holder Name</div>
                <div className="kyc-link-field-val">{reviewData.bankDetails.accountHolderName}</div>
              </div>
              <div>
                <div className="kyc-link-field-label">Bank Name</div>
                <div className="kyc-link-field-val">{reviewData.bankDetails.bankName}</div>
              </div>
              <div>
                <div className="kyc-link-field-label">Account Number</div>
                <div className="kyc-link-field-val kyc-link-field-val-masked" style={{ color: '#059669' }}>
                  {reviewData.bankDetails.accountNumber}
                </div>
              </div>
              <div>
                <div className="kyc-link-field-label">Account Type</div>
                <div className="kyc-link-field-val">{reviewData.bankDetails.accountType}</div>
              </div>
              <div>
                <div className="kyc-link-field-label">IFSC Code</div>
                <div className="kyc-link-field-val">{reviewData.bankDetails.ifscCode}</div>
              </div>
              <div className="kyc-link-field-full">
                <div className="kyc-link-field-label">Branch</div>
                <div className="kyc-link-field-val">{reviewData.bankDetails.branchName}</div>
              </div>
            </div>
          </div>

          {/* Section 4: Demat Details */}
          <div className="kyc-link-section-card">
            <div className="kyc-link-section-header">
              <h4 className="kyc-link-section-title">
                <Building size={15} /> 4. Demat Account
              </h4>
            </div>
            <div className="kyc-link-field-grid">
              <div>
                <div className="kyc-link-field-label">Depository</div>
                <div className="kyc-link-field-val">{reviewData.dematDetails.dematDepository}</div>
              </div>
              <div>
                <div className="kyc-link-field-label">Demat Account Number</div>
                <div className="kyc-link-field-val kyc-link-field-val-masked">
                  {reviewData.dematDetails.dematAccountNumber}
                </div>
              </div>
              <div>
                <div className="kyc-link-field-label">DP ID</div>
                <div className="kyc-link-field-val">{reviewData.dematDetails.dematDpId}</div>
              </div>
              <div>
                <div className="kyc-link-field-label">Client ID</div>
                <div className="kyc-link-field-val">{reviewData.dematDetails.dematClientId}</div>
              </div>
            </div>
          </div>

          {/* Section 5: Nominees */}
          <div className="kyc-link-section-card">
            <div className="kyc-link-section-header">
              <h4 className="kyc-link-section-title">
                <User size={15} /> 5. Nominees
              </h4>
            </div>
            {reviewData.nominees.length > 0 ? (
              reviewData.nominees.map((nom: any, idx: number) => (
                <div key={idx} className="kyc-link-field-grid" style={{ marginBottom: 8 }}>
                  <div>
                    <div className="kyc-link-field-label">Nominee Name</div>
                    <div className="kyc-link-field-val">{nom.name || 'Not provided'}</div>
                  </div>
                  <div>
                    <div className="kyc-link-field-label">Relationship</div>
                    <div className="kyc-link-field-val">{nom.relationship || 'Not provided'}</div>
                  </div>
                  <div>
                    <div className="kyc-link-field-label">Date of Birth</div>
                    <div className="kyc-link-field-val">{nom.dob || 'Not provided'}</div>
                  </div>
                  <div>
                    <div className="kyc-link-field-label">Allocation Share</div>
                    <div className="kyc-link-field-val" style={{ color: '#059669' }}>
                      {nom.allocationPercentage ? `${nom.allocationPercentage}%` : 'Not provided'}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                No nominees submitted (Single applicant estate).
              </div>
            )}
          </div>

          {/* Section 6: Uploaded Documents */}
          <div className="kyc-link-section-card">
            <div className="kyc-link-section-header">
              <h4 className="kyc-link-section-title">
                <FileText size={15} /> 6. Uploaded Documents
              </h4>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {reviewData.documents.length} document{reviewData.documents.length === 1 ? '' : 's'} submitted
              </span>
            </div>
            {reviewData.documents.length > 0 ? (
              <div className="kyc-link-doc-list">
                {reviewData.documents.map(doc => (
                  <div key={doc.id} className="kyc-link-doc-row">
                    <div className="kyc-link-doc-info">
                      <FileText size={16} color="var(--primary-600)" />
                      <div>
                        <div className="kyc-link-doc-name">{doc.name}</div>
                        <div className="kyc-link-doc-size" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>{doc.size}</span>
                          <span>•</span>
                          <span style={{ color: '#d97706', fontWeight: 600 }}>Uploaded (Pending IRM Review)</span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: 11, padding: '4px 10px', height: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                      onClick={() => handleViewDoc(doc)}
                    >
                      <Eye size={12} /> View
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                No documents submitted by the customer.
              </div>
            )}
          </div>

          {/* Section 7: Liveness Check */}
          <div className="kyc-link-section-card">
            <div className="kyc-link-section-header">
              <h4 className="kyc-link-section-title">
                <Camera size={15} /> 7. Liveness &amp; Photo Verification
              </h4>
              <span
                className="kyc-link-badge"
                style={{
                  background: liveKyc?.photoUrl ? 'rgba(59, 130, 246, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                  color: liveKyc?.photoUrl ? '#2563eb' : '#64748b',
                }}
              >
                {liveKyc?.photoUrl ? 'Selfie Uploaded' : 'Not submitted'}
              </span>
            </div>
            <div className="kyc-link-liveness-container">
              <div className="kyc-link-liveness-thumb" style={{ overflow: 'hidden' }}>
                {liveKyc?.photoUrl ? (
                  <img src={liveKyc.photoUrl} alt="Liveness Selfie" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <Camera size={26} color="#94a3b8" />
                )}
                {liveKyc?.photoUrl && (
                  <span
                    style={{
                      position: 'absolute',
                      bottom: 2,
                      fontSize: 8,
                      fontWeight: 800,
                      background: '#2563eb',
                      color: '#fff',
                      padding: '1px 4px',
                      borderRadius: 3,
                    }}
                  >
                    SELFIE
                  </span>
                )}
              </div>
              <div className="kyc-link-liveness-info">
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {reviewData.liveness.livenessStatus}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Verification Status: <strong>{reviewData.liveness.matchScore}</strong>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Captured on: {reviewData.liveness.capturedAt}
                </div>
              </div>
            </div>
          </div>

          {/* Section 8: Digital Consent & Timestamp */}
          <div className="kyc-link-section-card">
            <div className="kyc-link-section-header">
              <h4 className="kyc-link-section-title">
                <ShieldCheck size={15} /> 8. Electronic Consent &amp; Audit Trail
              </h4>
            </div>
            <div className="kyc-link-field-grid">
              <div>
                <div className="kyc-link-field-label">Consent Timestamp</div>
                <div className="kyc-link-field-val">{reviewData.consent.acceptedAt}</div>
              </div>
              <div>
                <div className="kyc-link-field-label">Agreement Policy Terms</div>
                <div className="kyc-link-field-val">{reviewData.consent.termsVersion}</div>
              </div>
              <div className="kyc-link-field-full">
                <div className="kyc-link-field-label">Audit Log Signature</div>
                <div className="kyc-link-field-val" style={{ fontFamily: 'monospace', fontSize: 12 }}>
                  {reviewData.consent.ipHash}
                </div>
              </div>
            </div>
          </div>

          {/* Section 9: Provider Verification Check Status */}
          <div className="kyc-link-section-card" style={{ borderColor: 'rgba(100, 116, 139, 0.3)' }}>
            <div className="kyc-link-section-header">
              <h4 className="kyc-link-section-title" style={{ color: '#475569' }}>
                <ShieldCheck size={16} /> Automated Provider Verifications
              </h4>
              <span className="kyc-link-badge" style={{ background: 'rgba(100, 116, 139, 0.1)', color: '#475569' }}>
                Provider APIs Pending
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '4px 0' }}>
              External verification provider integrations (NSDL PAN, UIDAI Aadhaar, NPCI Penny-Drop) are not connected.
              All fields and documents must be verified manually by the IRM below.
            </div>
          </div>

          {/* Section 10: Mandatory IRM Verification Checklist */}
          <div
            className="kyc-link-section-card"
            style={{
              border: '2px solid #2563eb',
              background: 'rgba(37, 99, 235, 0.03)',
            }}
          >
            <div className="kyc-link-section-header">
              <h4 className="kyc-link-section-title" style={{ color: '#1d4ed8' }}>
                <CheckCircle size={16} /> Mandatory IRM Verification Checklist
              </h4>
              <span
                className="kyc-link-badge"
                style={{
                  background: allChecklistCompleted ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.1)',
                  color: allChecklistCompleted ? '#059669' : '#dc2626',
                  fontWeight: 700,
                }}
              >
                {allChecklistCompleted
                  ? 'All Required Items Completed'
                  : `${(reviewChecklist.identity ? 1 : 0) + (reviewChecklist.bank ? 1 : 0) + (reviewChecklist.documents ? 1 : 0) + (hasNominees ? (reviewChecklist.nominee ? 1 : 0) : 1) + (reviewChecklist.demat ? 1 : 0)}/5 Completed`}
              </span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 12px 0' }}>
              IRMs must genuinely verify each submitted section against documents before confirming approval.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={reviewChecklist.identity}
                  onChange={e => setReviewChecklist(prev => ({ ...prev, identity: e.target.checked }))}
                />
                <span>
                  1. <strong>Identity & Personal Details:</strong> I have verified the PAN and Identity against submitted documents.
                </span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={reviewChecklist.bank}
                  onChange={e => setReviewChecklist(prev => ({ ...prev, bank: e.target.checked }))}
                />
                <span>
                  2. <strong>Bank Account Details:</strong> I have verified the bank account, IFSC code, and account holder name.
                </span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={reviewChecklist.documents}
                  onChange={e => setReviewChecklist(prev => ({ ...prev, documents: e.target.checked }))}
                />
                <span>
                  3. <strong>Uploaded Documents:</strong> I have manually inspected all uploaded document copies (uploads are not automatically verified).
                </span>
              </label>
              {hasNominees ? (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={reviewChecklist.nominee}
                    onChange={e => setReviewChecklist(prev => ({ ...prev, nominee: e.target.checked }))}
                  />
                  <span>
                    4. <strong>Nominee Information:</strong> I have inspected nominee allocations ({parsedNominees.length} nominee(s) totaling 100%).
                  </span>
                </label>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#059669', background: 'rgba(16, 185, 129, 0.08)', padding: '6px 10px', borderRadius: 6, fontSize: 12 }}>
                  <CheckCircle size={15} style={{ flexShrink: 0 }} />
                  <span>
                    4. <strong>Nominee Information:</strong> No nominee submitted (Opted out / Single applicant — Verified &amp; Waived)
                  </span>
                </div>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={reviewChecklist.demat}
                  onChange={e => setReviewChecklist(prev => ({ ...prev, demat: e.target.checked }))}
                />
                <span>
                  5. <strong>Demat Details:</strong> I have inspected demat account information or verified no demat is required.
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer Buttons */}
        <div
          className="kyc-link-drawer-footer"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 20px',
            borderTop: '1px solid var(--border-color, #e2e8f0)',
            background: 'var(--bg-surface, #ffffff)',
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowCorrectionModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <AlertTriangle size={14} color="#f59e0b" /> Request Correction
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!hasRealSubmission || !allChecklistCompleted || approving}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              backgroundColor: hasRealSubmission && allChecklistCompleted ? '#10b981' : '#94a3b8',
              borderColor: hasRealSubmission && allChecklistCompleted ? '#10b981' : '#94a3b8',
              cursor: hasRealSubmission && allChecklistCompleted ? 'pointer' : 'not-allowed',
            }}
            onClick={handleApprove}
            title={
              !hasRealSubmission
                ? 'Cannot approve: Customer has not submitted KYC details yet'
                : !allChecklistCompleted
                ? 'Please complete all 5 checklist verification items'
                : 'Confirm KYC Verification'
            }
          >
            <CheckCircle size={15} /> {approving ? 'Verifying...' : 'Approve & Confirm KYC'}
          </button>
        </div>

        {/* Sub-modal for Request Correction */}
        {showCorrectionModal && (
          <div className="kyc-link-correction-modal" onClick={() => setShowCorrectionModal(false)}>
            <div className="kyc-link-correction-box" onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={16} color="#ea580c" /> Request Correction
                </h4>
                <button type="button" className="kyc-link-modal-close-btn" onClick={() => setShowCorrectionModal(false)}>
                  <X size={16} />
                </button>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
                Explain to <strong>{deal.customerName}</strong> what needs to be updated or re-uploaded. An SMS &amp; WhatsApp link will be dispatched automatically.
              </p>
              <textarea
                className="kyc-link-textarea"
                value={correctionNote}
                onChange={e => setCorrectionNote(e.target.value)}
                rows={4}
                placeholder="Enter specific correction instructions..."
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowCorrectionModal(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  onClick={handleSendCorrection}
                >
                  <Send size={13} /> Send Correction Request
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
