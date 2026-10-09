import React, { useState, useCallback, useEffect } from 'react';
import {
  ShieldCheck,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  User,
  Building,
  CreditCard,
  Users,
  Camera,
  Clock,
  Eye,
  EyeOff,
  FileText,
  CheckCircle2,
} from 'lucide-react';
import { Modal } from '../../../components/common/Modal';
import { Deal } from '../../../types';
import { KycChecklist } from '../../../services/kycService';
import { useAuth } from '../../../context/AuthContext';
import { PERMISSIONS } from '../../../constants/permissions';
import { isMockMode } from '../../../config/environment';
import { getAuthHeaders } from '../../../utils/authHeaders';
import './KycVerifyModal.css';

// ── Types ──────────────────────────────────────────────────────────────────────

type SectionStatus = 'unchecked' | 'verified' | 'wrong';

interface SectionState {
  status: SectionStatus;
  reason: string;
  expanded: boolean;
  viewedOnce: boolean;
  reviewedBy?: string;
  reviewedAt?: string;
}

export type KycSectionKey = 'pan' | 'aadhaar' | 'bank' | 'demat' | 'nominee' | 'liveness';

interface KycVerifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  deal: Deal;
  profileKycData: Record<string, any>;
  onSaveVerification: (
    status: 'Pending' | 'Wrong' | 'Verified',
    comment?: string,
    flaggedSections?: string[],
    checklist?: KycChecklist,
  ) => Promise<void>;
  onShowToast: (msg: string) => void;
}

// ── Field helpers ──────────────────────────────────────────────────────────────

function maskAadhaar(v?: string | null) {
  if (!v) return null;
  const clean = v.replace(/\s/g, '');
  if (clean.length < 4) return clean;
  return 'XXXX XXXX ' + clean.slice(-4);
}

function maskAccount(v?: string | null) {
  if (!v) return null;
  if (v.length <= 4) return v;
  return '\u2022'.repeat(Math.min(v.length - 4, 8)) + v.slice(-4);
}

function NotProvided() {
  return <span className="kvm-not-provided">Not provided</span>;
}

function DetailField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="kvm-detail-row">
      <span className="kvm-detail-label">{label}</span>
      {value ? <span className="kvm-detail-val">{value}</span> : <NotProvided />}
    </div>
  );
}

function formatAadhaar(v?: string | null) {
  if (!v) return null;
  const clean = v.replace(/\s/g, '');
  return clean.replace(/(.{4})/g, '$1 ').trim();
}

/**
 * Masked by default for privacy, but verifier can click Show/Hide to compare against documents.
 */
function SensitiveField({
  label,
  full,
  masked,
}: {
  label: string;
  full?: string | null;
  masked?: string | null;
}) {
  const [revealed, setRevealed] = useState(false);
  if (!full) {
    return <DetailField label={label} value={null} />;
  }
  return (
    <div className="kvm-detail-row">
      <span className="kvm-detail-label">{label}</span>
      <span className="kvm-detail-val" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        {revealed ? full : masked}
        <button
          type="button"
          onClick={() => setRevealed(r => !r)}
          title={revealed ? 'Hide full value' : 'Show full value to verify'}
          aria-label={revealed ? `Hide ${label}` : `Show ${label}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            border: '1px solid var(--border-color, #e2e8f0)',
            background: 'var(--bg-surface, #ffffff)',
            borderRadius: 6,
            padding: '2px 8px',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            color: 'var(--text-secondary, #475569)',
          }}
        >
          {revealed ? <EyeOff size={12} /> : <Eye size={12} />}
          {revealed ? 'Hide' : 'Show'}
        </button>
      </span>
    </div>
  );
}

// ── Document Preview Component ────────────────────────────────────────────────

interface DocPreviewProps {
  label: string;
  doc?: { name?: string; url?: string } | null;
  onView: (doc: { name: string; url?: string }) => void;
}

function DocumentPreviewBar({ label, doc, onView }: DocPreviewProps) {
  if (!doc?.url) {
    return (
      <div className="kvm-doc-missing-bar">
        <AlertCircle size={13} />
        <span>No {label} document uploaded</span>
      </div>
    );
  }

  return (
    <div className="kvm-doc-preview-bar">
      <div className="kvm-doc-preview-info">
        <FileText size={16} color="var(--primary-600, #2563eb)" />
        <div className="kvm-doc-text-group">
          <span className="kvm-doc-filename">{doc.name || `${label} (Uploaded)`}</span>
          <span className="kvm-doc-badge">Attached</span>
        </div>
      </div>
      <button
        type="button"
        className="kvm-view-doc-btn"
        onClick={() => onView({ name: doc.name || label, url: doc.url })}
        title={`Inspect ${label} proof`}
      >
        <Eye size={13} /> View Document
      </button>
    </div>
  );
}

// ── Section Detail Renderers ──────────────────────────────────────────────────

function PanDetails({
  data,
  onViewDoc,
}: {
  data: Record<string, any>;
  onViewDoc: (doc: { name: string; url?: string }) => void;
}) {
  const doc = data.panDoc?.url ? data.panDoc : data.panDocumentUrl ? { name: 'PAN Card Proof', url: data.panDocumentUrl } : null;

  return (
    <div className="kvm-detail-block">
      <DetailField label="PAN Number" value={data.panNumber} />
      <DetailField label="Name as per PAN" value={data.nameAsPerPan || data.investorName} />
      <DetailField label="Father's Name" value={data.fatherName} />
      <DocumentPreviewBar label="PAN Card" doc={doc} onView={onViewDoc} />
    </div>
  );
}

function AadhaarDetails({
  data,
  onViewDoc,
}: {
  data: Record<string, any>;
  onViewDoc: (doc: { name: string; url?: string }) => void;
}) {
  const doc = data.aadhaarDoc?.url ? data.aadhaarDoc : data.aadhaarDocumentUrl ? { name: 'Aadhaar Card Proof', url: data.aadhaarDocumentUrl } : null;

  return (
    <div className="kvm-detail-block">
      <SensitiveField
        label="Aadhaar Number"
        full={formatAadhaar(data.aadhaarNumber)}
        masked={maskAadhaar(data.aadhaarNumber)}
      />
      <DetailField label="Name on Document" value={data.nameAsPerPan || data.investorName} />
      <DetailField label="Date of Birth" value={data.dob || data.dateOfBirth} />
      <DetailField
        label="Permanent Address"
        value={
          data.address ||
          [data.addressLine1, data.addressLine2, data.city, data.state, data.pincode].filter(Boolean).join(', ')
        }
      />
      <DetailField label="Pincode" value={data.pincode} />
      <DocumentPreviewBar label="Aadhaar Card" doc={doc} onView={onViewDoc} />
    </div>
  );
}

function BankDetails({
  data,
  onViewDoc,
}: {
  data: Record<string, any>;
  onViewDoc: (doc: { name: string; url?: string }) => void;
}) {
  const doc = data.bankProofDoc?.url ? data.bankProofDoc : data.bankChequeUrl ? { name: 'Cancelled Cheque / Bank Statement', url: data.bankChequeUrl } : null;

  return (
    <div className="kvm-detail-block">
      <DetailField label="Account Holder" value={data.accountHolderName || data.nameAsPerPan || data.investorName} />
      <DetailField label="Bank Name" value={data.bankName} />
      <SensitiveField
        label="Account Number"
        full={data.accountNumber}
        masked={maskAccount(data.accountNumber)}
      />
      <DetailField label="Account Type" value={data.accountType} />
      <DetailField label="IFSC Code" value={data.ifscCode} />
      <DetailField label="Branch" value={data.branchName} />
      <DocumentPreviewBar label="Bank Proof / Cheque" doc={doc} onView={onViewDoc} />
    </div>
  );
}

function DematDetails({
  data,
  onViewDoc,
}: {
  data: Record<string, any>;
  onViewDoc: (doc: { name: string; url?: string }) => void;
}) {
  const doc = data.dematDoc?.url ? data.dematDoc : data.dematDocumentUrl ? { name: 'Client Master Report (CMR)', url: data.dematDocumentUrl } : null;
  const isWaived = Boolean(data.hasNoDemat);

  if (isWaived) {
    return (
      <div className="kvm-detail-block">
        <div style={{ color: 'var(--text-secondary)', fontSize: 13, padding: '4px 0' }}>
          Investor declared: <strong>No Demat Account (Opted Out / Mutual Funds &amp; Direct Only)</strong>.
        </div>
      </div>
    );
  }

  return (
    <div className="kvm-detail-block">
      <DetailField label="Depository" value={data.dematDepository || (data.dpId ? 'NSDL/CDSL' : null)} />
      <DetailField label="DP ID" value={data.dpId || data.dematDpId} />
      <DetailField label="Client ID" value={data.dematClientId} />
      <SensitiveField
        label="Demat A/C No."
        full={data.dematAccountNumber}
        masked={data.dematAccountNumber ? maskAccount(data.dematAccountNumber) : null}
      />
      <DocumentPreviewBar label="Demat Statement / CMR" doc={doc} onView={onViewDoc} />
    </div>
  );
}

function NomineeDetails({ data }: { data: Record<string, any> }) {
  let nomineesList: any[] = [];
  if (Array.isArray(data.nominees) && data.nominees.length > 0) {
    nomineesList = data.nominees;
  } else if (data.nomineesJson) {
    try {
      const parsed = typeof data.nomineesJson === 'string' ? JSON.parse(data.nomineesJson) : data.nomineesJson;
      if (Array.isArray(parsed)) nomineesList = parsed;
    } catch {}
  }

  if (nomineesList.length === 0 || !nomineesList[0]?.name) {
    return (
      <div className="kvm-detail-block">
        <div style={{ color: 'var(--text-secondary)', fontSize: 13, padding: '4px 0' }}>
          No nominees declared. Investor opted out of nominee registration.
        </div>
      </div>
    );
  }

  return (
    <div className="kvm-detail-block">
      <div className="kvm-nominee-list">
        {nomineesList.map((nom, idx) => (
          <div key={idx} className="kvm-nominee-card">
            <div className="kvm-nominee-card-header">
              <span className="kvm-nominee-name">{nom.name || nom.nomineeName || `Nominee ${idx + 1}`}</span>
              <span className="kvm-nominee-share">{nom.allocationPercentage ?? nom.nomineeAllocation ?? 100}% Share</span>
            </div>
            <DetailField label="Relationship" value={nom.relationship || nom.nomineeRelationship} />
            <DetailField label="Date of Birth" value={nom.dob || nom.nomineeDob} />
            {nom.guardianName && <DetailField label="Guardian Name" value={nom.guardianName} />}
            {nom.address && <DetailField label="Address" value={nom.address || nom.nomineeAddress} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function LivenessDetails({
  data,
  onViewDoc,
}: {
  data: Record<string, any>;
  onViewDoc: (doc: { name: string; url?: string }) => void;
}) {
  const photoUrl = data.photoUrl;

  return (
    <div className="kvm-detail-block">
      <div className="kvm-liveness-container">
        {photoUrl ? (
          <div
            className="kvm-selfie-thumbnail-box"
            onClick={() => onViewDoc({ name: 'Biometric Selfie Photo', url: photoUrl })}
            title="Click to view full photo"
          >
            <img src={photoUrl} alt="Investor Selfie" />
            <span className="kvm-selfie-zoom-hint">View Photo</span>
          </div>
        ) : (
          <div
            className="kvm-selfie-thumbnail-box"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}
          >
            <Camera size={24} />
          </div>
        )}

        <div className="kvm-liveness-info">
          <DetailField
            label="Capture Status"
            value={photoUrl ? 'Selfie Uploaded (Awaiting IRM Verification)' : 'Not submitted'}
          />
          <DetailField
            label="Consent Undertaking"
            value={data.customerConsentTimestamp || data.submittedAt ? 'SEBI Digital Undertaking Confirmed' : 'Pending submission'}
          />
          <DetailField
            label="Submission Time"
            value={
              data.submittedAt
                ? new Date(data.submittedAt).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Recorded at submission'
            }
          />
        </div>
      </div>
    </div>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SECTION_LABELS: Record<KycSectionKey, string> = {
  pan: 'PAN Details & Document',
  aadhaar: 'Aadhaar & Address Verification',
  bank: 'Bank Account & Proof',
  demat: 'Demat Account & Depository',
  nominee: 'Nominee Details & Allocation',
  liveness: 'Biometric Selfie & Liveness',
};

const SECTION_KEYS: KycSectionKey[] = ['pan', 'aadhaar', 'bank', 'demat', 'nominee', 'liveness'];

function SectionIcon({ k }: { k: KycSectionKey }) {
  switch (k) {
    case 'pan':
      return <ShieldCheck size={15} color="#2563eb" />;
    case 'aadhaar':
      return <User size={15} color="#059669" />;
    case 'bank':
      return <Building size={15} color="#7c3aed" />;
    case 'demat':
      return <CreditCard size={15} color="#0891b2" />;
    case 'nominee':
      return <Users size={15} color="#d97706" />;
    case 'liveness':
      return <Camera size={15} color="#e11d48" />;
  }
}

// ── Local Storage Draft helper ────────────────────────────────────────────────

function loadDraft(dealId: string): Record<KycSectionKey, Partial<SectionState>> | null {
  try {
    const raw = localStorage.getItem('nexus_kyc_verify_draft_' + dealId);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persistDraftLocally(dealId: string, sections: Record<KycSectionKey, SectionState>) {
  const payload: Record<string, any> = {};
  for (const [k, v] of Object.entries(sections)) {
    payload[k] = { status: v.status, reason: v.reason, reviewedBy: v.reviewedBy, reviewedAt: v.reviewedAt };
  }
  localStorage.setItem('nexus_kyc_verify_draft_' + dealId, JSON.stringify(payload));
}

// ── Main Component ────────────────────────────────────────────────────────────

export const KycVerifyModal: React.FC<KycVerifyModalProps> = ({
  isOpen,
  onClose,
  deal,
  profileKycData,
  onSaveVerification,
  onShowToast,
}) => {
  const { user, permissions } = useAuth();
  const canVerify =
    permissions.includes(PERMISSIONS.KYC_VERIFY) ||
    user?.role?.code === 'irm' ||
    user?.role?.code === 'company_admin' ||
    user?.role?.code === 'super_admin' ||
    user?.role?.code === 'sales_executive' ||
    !permissions ||
    permissions.length === 0;

  // Real submitted record fetched live from backend
  const [liveKycData, setLiveKycData] = useState<any | null>(null);

  useEffect(() => {
    if (!isOpen || !deal) {
      setLiveKycData(null);
      return;
    }
    const fetchLiveKyc = async () => {
      try {
        const kycId = (deal as any).kycId || (deal as any).kycRecordId || (deal as any).customerId;
        if (kycId) {
          const res = await fetch(`/api/irm/kyc/${kycId}`, { headers: getAuthHeaders() });
          if (res.ok) {
            const json = await res.json();
            if (json.success && json.data) {
              setLiveKycData(json.data);
              return;
            }
          }
        }
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
        console.warn('[KycVerifyModal] Could not fetch live kyc record:', err);
      }
    };
    fetchLiveKyc();
  }, [isOpen, deal]);

  // Combined data prioritizing live backend data with fallback to profile data
  const mergedData: Record<string, any> = {
    ...profileKycData,
    ...(liveKycData || {}),
    panNumber: liveKycData?.panNumber || profileKycData?.panNumber,
    nameAsPerPan: liveKycData?.nameAsPerPan || profileKycData?.nameAsPerPan || deal.customerName,
    fatherName: liveKycData?.fatherName || profileKycData?.fatherName,
    aadhaarNumber: liveKycData?.aadhaarNumber || profileKycData?.aadhaarNumber,
    dob: liveKycData?.dateOfBirth || liveKycData?.dob || profileKycData?.dob,
    address: liveKycData?.addressLine1 || liveKycData?.address || profileKycData?.address,
    pincode: liveKycData?.pincode || profileKycData?.pincode,
    bankName: liveKycData?.bankName || profileKycData?.bankName,
    accountHolderName: liveKycData?.accountHolderName || profileKycData?.accountHolderName || deal.customerName,
    accountNumber: liveKycData?.accountNumber || profileKycData?.accountNumber,
    ifscCode: liveKycData?.ifscCode || profileKycData?.ifscCode,
    accountType: liveKycData?.accountType || profileKycData?.accountType,
    branchName: liveKycData?.branchName || profileKycData?.branchName,
    hasNoDemat: liveKycData?.hasNoDemat !== undefined ? liveKycData.hasNoDemat : profileKycData?.hasNoDemat,
    dematDepository: liveKycData?.dematDepository || profileKycData?.dematDepository,
    dpId: liveKycData?.dpId || liveKycData?.dematDpId || profileKycData?.dpId,
    dematClientId: liveKycData?.dematClientId || profileKycData?.dematClientId,
    dematAccountNumber: liveKycData?.dematAccountNumber || profileKycData?.dematAccountNumber,
    photoUrl: liveKycData?.photoUrl || profileKycData?.photoUrl,
    submittedAt: liveKycData?.submittedAt || profileKycData?.submittedAt,
    panDoc: profileKycData?.panDoc || (liveKycData?.panDocumentUrl ? { name: 'PAN Card Proof', url: liveKycData.panDocumentUrl } : null),
    aadhaarDoc: profileKycData?.aadhaarDoc || (liveKycData?.aadhaarDocumentUrl ? { name: 'Aadhaar Card Proof', url: liveKycData.aadhaarDocumentUrl } : null),
    bankProofDoc: profileKycData?.bankProofDoc || (liveKycData?.bankChequeUrl ? { name: 'Bank Cheque / Proof', url: liveKycData.bankChequeUrl } : null),
    dematDoc: profileKycData?.dematDoc || (liveKycData?.dematDocumentUrl ? { name: 'Demat Proof Statement', url: liveKycData.dematDocumentUrl } : null),
    nominees: liveKycData?.nomineesJson || profileKycData?.nominees,
  };

  const initSections = (): Record<KycSectionKey, SectionState> => {
    const draft = loadDraft(deal.id);
    const makeOne = (k: KycSectionKey): SectionState => {
      const saved = draft?.[k];
      return {
        status: (saved?.status as SectionStatus) || 'unchecked',
        reason: saved?.reason || '',
        expanded: false,
        viewedOnce: !!(saved?.status && saved.status !== 'unchecked'),
        reviewedBy: saved?.reviewedBy,
        reviewedAt: saved?.reviewedAt,
      };
    };
    return {
      pan: makeOne('pan'),
      aadhaar: makeOne('aadhaar'),
      bank: makeOne('bank'),
      demat: makeOne('demat'),
      nominee: makeOne('nominee'),
      liveness: makeOne('liveness'),
    };
  };

  const [sections, setSections] = useState<Record<KycSectionKey, SectionState>>(initSections);
  const [saving, setSaving] = useState(false);
  const [confirmVerify, setConfirmVerify] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSections(initSections());
      setConfirmVerify(false);
    }
  }, [isOpen, deal.id]);

  const updateSection = (key: KycSectionKey, patch: Partial<SectionState>) =>
    setSections(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }));

  const handleExpand = (key: KycSectionKey) => {
    updateSection(key, { expanded: !sections[key].expanded, viewedOnce: true });
  };

  const handleMark = (key: KycSectionKey, mark: 'verified' | 'wrong') => {
    if (!sections[key].viewedOnce) return;
    const newStatus: SectionStatus = sections[key].status === mark ? 'unchecked' : mark;
    updateSection(key, {
      status: newStatus,
      reason: newStatus !== 'wrong' ? '' : sections[key].reason,
      reviewedBy: user?.email || 'IRM Officer',
      reviewedAt: new Date().toISOString(),
    });
  };

  const handleQuickVerifyAll = () => {
    const now = new Date().toISOString();
    const updated = { ...sections };
    SECTION_KEYS.forEach(k => {
      updated[k] = {
        ...updated[k],
        status: 'verified',
        reason: '',
        viewedOnce: true,
        reviewedBy: user?.email || 'IRM Officer',
        reviewedAt: now,
      };
    });
    setSections(updated);
    onShowToast('Marked all 6 sections as Verified.');
  };

  const handleViewDoc = (doc: { name: string; url?: string }) => {
    if (!doc?.url) {
      onShowToast(`No preview file available for ${doc.name}.`);
      return;
    }
    const isPdf = doc.url.startsWith('data:application/pdf') || doc.url.toLowerCase().includes('.pdf');
    const w = window.open('');
    if (w) {
      if (isPdf) {
        w.document.write(
          `<title>${doc.name}</title><iframe src="${doc.url}" style="width:100%;height:100%;border:none;margin:0;position:fixed;top:0;left:0;right:0;bottom:0;"></iframe>`
        );
      } else {
        w.document.write(
          `<title>${doc.name}</title><div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#090d16;margin:0;"><img src="${doc.url}" style="max-width:92%;max-height:92vh;border-radius:10px;box-shadow:0 12px 36px rgba(0,0,0,0.6);" alt="${doc.name}" /></div>`
        );
      }
    }
  };

  // Section status counters
  const verifiedCount = SECTION_KEYS.filter(k => sections[k].status === 'verified').length;
  const wrongCount = SECTION_KEYS.filter(k => sections[k].status === 'wrong').length;
  const allMarked = SECTION_KEYS.every(k => sections[k].status !== 'unchecked');
  const allVerified = SECTION_KEYS.every(k => sections[k].status === 'verified');
  const anyWrong = SECTION_KEYS.some(k => sections[k].status === 'wrong');
  const wrongReasonMissing = SECTION_KEYS.some(
    k => sections[k].status === 'wrong' && !sections[k].reason.trim(),
  );
  const canSave = allMarked && (!anyWrong || !wrongReasonMissing);

  const resolvedKycId = (deal as any).kycId || (deal as any).kycRecordId || liveKycData?.id || deal.id;

  const patchDraft = useCallback(async () => {
    persistDraftLocally(deal.id, sections);

    if (isMockMode()) return;
    if (typeof resolvedKycId !== 'number' && !/^\d+$/.test(String(resolvedKycId))) return;

    try {
      const res = await fetch('/api/irm/kyc/' + resolvedKycId + '/verification', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          pan: { status: sections.pan.status, reason: sections.pan.reason || null },
          aadhaar: { status: sections.aadhaar.status, reason: sections.aadhaar.reason || null },
          bank: { status: sections.bank.status, reason: sections.bank.reason || null },
          demat: { status: sections.demat.status, reason: sections.demat.reason || null },
          nominee: { status: sections.nominee.status, reason: sections.nominee.reason || null },
          liveness: { status: sections.liveness.status, reason: sections.liveness.reason || null },
        }),
      });
      if (!res.ok) {
        console.warn('[KycVerifyModal] draft patch returned status', res.status);
      }
    } catch (err) {
      console.warn('[KycVerifyModal] draft patch network error:', err);
    }
  }, [sections, deal.id, resolvedKycId]);

  const handleSaveDraft = async () => {
    setDraftSaving(true);
    try {
      await patchDraft();
      onShowToast('Draft saved — verification marks preserved.');
    } catch (e: any) {
      onShowToast('Error saving draft: ' + (e?.message || 'Unknown error'));
    } finally {
      setDraftSaving(false);
    }
  };

  const handleSaveVerification = async () => {
    if (!canSave) return;
    if (allVerified && !confirmVerify) {
      setConfirmVerify(true);
      return;
    }
    setSaving(true);
    try {
      await patchDraft();
      if (anyWrong) {
        const wrongKeys = SECTION_KEYS.filter(k => sections[k].status === 'wrong');
        const comment = wrongKeys
          .map(k => SECTION_LABELS[k] + ': ' + sections[k].reason)
          .join(' | ');
        await onSaveVerification('Wrong', comment, wrongKeys.map(k => SECTION_LABELS[k]));
      } else {
        await onSaveVerification('Verified', undefined, undefined, {
          identity: true,
          bank: true,
          documents: true,
          nominee: true,
          demat: true,
        });
      }
      localStorage.removeItem('nexus_kyc_verify_draft_' + deal.id);
      onClose();
    } catch (e: any) {
      onShowToast('Error: ' + (e?.message || 'Unknown error'));
    } finally {
      setSaving(false);
      setConfirmVerify(false);
    }
  };

  const renderSection = (key: KycSectionKey) => {
    const s = sections[key];
    const tickActive = s.status === 'verified';
    const crossActive = s.status === 'wrong';

    return (
      <div
        key={key}
        className={
          'kvm-row' +
          (crossActive ? ' kvm-row--wrong' : tickActive ? ' kvm-row--verified' : '')
        }
      >
        {/* Col 1: info */}
        <div className="kvm-col-info">
          <div className="kvm-section-header">
            <SectionIcon k={key} />
            <span className="kvm-section-label">{SECTION_LABELS[key]}</span>
            {tickActive && <span className="kvm-status-chip kvm-status-chip--ok">Correct</span>}
            {crossActive && <span className="kvm-status-chip kvm-status-chip--wrong">Wrong</span>}
          </div>

          {!s.expanded && (
            <div className="kvm-preview">
              {key === 'pan' && (mergedData.panNumber || '—')}
              {key === 'aadhaar' && (maskAadhaar(mergedData.aadhaarNumber) || '—')}
              {key === 'bank' &&
                ((mergedData.bankName || '—') +
                  ' · ' +
                  (maskAccount(mergedData.accountNumber) || '—'))}
              {key === 'demat' &&
                (mergedData.hasNoDemat ? 'Waived (No Demat Account)' : (mergedData.dpId || 'CDSL/NSDL') + ' · ' + (mergedData.dematClientId || '—'))}
              {key === 'nominee' &&
                (Array.isArray(mergedData.nominees) && mergedData.nominees.length > 0
                  ? `${mergedData.nominees[0]?.name || 'Nominee declared'} (${mergedData.nominees.length} nominee)`
                  : 'No Nominee Declared (Opted Out)')}
              {key === 'liveness' &&
                (mergedData.photoUrl ? 'Biometric Selfie Uploaded' : 'Selfie Pending')}
            </div>
          )}

          {s.expanded && (
            <>
              {key === 'pan' && <PanDetails data={mergedData} onViewDoc={handleViewDoc} />}
              {key === 'aadhaar' && <AadhaarDetails data={mergedData} onViewDoc={handleViewDoc} />}
              {key === 'bank' && <BankDetails data={mergedData} onViewDoc={handleViewDoc} />}
              {key === 'demat' && <DematDetails data={mergedData} onViewDoc={handleViewDoc} />}
              {key === 'nominee' && <NomineeDetails data={mergedData} />}
              {key === 'liveness' && <LivenessDetails data={mergedData} onViewDoc={handleViewDoc} />}
            </>
          )}

          {crossActive && canVerify && (
            <div className="kvm-reason-row">
              <label htmlFor={`kvm-reason-${deal.id}-${key}`} className="kvm-reason-label">
                Correction Instructions / What is Wrong *
              </label>
              <textarea
                id={`kvm-reason-${deal.id}-${key}`}
                name={`reason_${key}`}
                className={'kvm-reason-input' + (!s.reason.trim() ? ' kvm-reason-input--error' : '')}
                placeholder="Specify what is incorrect (e.g. document blurry, name mismatch with Aadhaar)..."
                value={s.reason}
                onChange={e => updateSection(key, { reason: e.target.value })}
                rows={2}
              />
              {!s.reason.trim() && (
                <span className="kvm-reason-error">
                  <AlertCircle size={11} /> Required: specify what needs correction before saving
                </span>
              )}
            </div>
          )}

          {s.reviewedBy && s.status !== 'unchecked' && (
            <div className="kvm-attribution">
              <Clock size={11} />
              <span>
                {s.reviewedBy} ·{' '}
                {s.reviewedAt
                  ? new Date(s.reviewedAt).toLocaleString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : ''}
              </span>
            </div>
          )}
        </div>

        {/* Col 2: Inspect / expand */}
        <div className="kvm-col-verify">
          <button
            type="button"
            className={'kvm-expand-btn' + (s.expanded ? ' kvm-expand-btn--active' : '')}
            onClick={() => handleExpand(key)}
            aria-expanded={s.expanded}
            aria-label={(s.expanded ? 'Collapse ' : 'Expand ') + SECTION_LABELS[key] + ' details'}
            title={s.expanded ? 'Collapse details' : 'Inspect documents and data'}
          >
            {s.expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            <span>{s.expanded ? 'Collapse' : 'Inspect'}</span>
          </button>
        </div>

        {/* Col 3: ✗ Wrong */}
        <div className="kvm-col-mark">
          <button
            type="button"
            className={'kvm-mark-btn kvm-mark-wrong' + (crossActive ? ' kvm-mark-active-wrong' : '')}
            disabled={!s.viewedOnce || !canVerify}
            onClick={() => handleMark(key, 'wrong')}
            aria-label={'Mark ' + SECTION_LABELS[key] + ' wrong'}
            aria-pressed={crossActive}
            title={
              !canVerify
                ? 'You lack permission to verify'
                : !s.viewedOnce
                  ? 'Click Inspect first to review details and documents'
                  : 'Mark as Wrong (Request Correction)'
            }
          >
            <X size={20} />
          </button>
        </div>

        {/* Col 4: ✓ Correct */}
        <div className="kvm-col-mark">
          <button
            type="button"
            className={'kvm-mark-btn kvm-mark-ok' + (tickActive ? ' kvm-mark-active-ok' : '')}
            disabled={!s.viewedOnce || !canVerify}
            onClick={() => handleMark(key, 'verified')}
            aria-label={'Mark ' + SECTION_LABELS[key] + ' correct'}
            aria-pressed={tickActive}
            title={
              !canVerify
                ? 'You lack permission to verify'
                : !s.viewedOnce
                  ? 'Click Inspect first to review details and documents'
                  : 'Mark as Correct'
            }
          >
            <Check size={20} />
          </button>
        </div>
      </div>
    );
  };

  const footer = (
    <div className="kvm-footer">
      <div className="kvm-footer-left">
        <span>{verifiedCount} Verified • {wrongCount} Flagged • {6 - (verifiedCount + wrongCount)} Remaining</span>
      </div>

      <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={saving}>
        Close
      </button>

      {canVerify && (
        <>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleSaveDraft}
            disabled={saving || draftSaving}
          >
            {draftSaving ? 'Saving…' : 'Save Draft'}
          </button>

          {anyWrong && (
            <button
              type="button"
              className="btn btn-sm kvm-btn-reject"
              onClick={handleSaveVerification}
              disabled={!canSave || saving}
              title={wrongReasonMissing ? 'Enter reasons for flagged sections' : 'Flag for correction and reject'}
            >
              {saving ? 'Updating…' : 'Flag for Correction & Reject'}
            </button>
          )}

          <button
            type="button"
            className={
              'btn btn-sm kvm-save-btn' +
              (confirmVerify ? ' kvm-save-btn--confirm' : ' btn-primary')
            }
            onClick={handleSaveVerification}
            disabled={!canSave || saving}
            title={
              !canSave
                ? wrongReasonMissing
                  ? 'Enter reasons for flagged sections'
                  : 'Inspect and mark all 6 sections before approving'
                : ''
            }
          >
            {saving
              ? 'Saving…'
              : confirmVerify
                ? '✓ Confirm — Approve & Mark Verified'
                : anyWrong
                  ? 'Save Verification'
                  : 'Approve & Mark Verified'}
          </button>
        </>
      )}
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="KYC Verification & Document Review"
      subtitle={`${deal.customerName} • ${deal.email || 'No email'} • Ref: ${(deal as any).ghlId || deal.id}`}
      size="xl"
      footer={footer}
    >
      <div className="kvm-body">
        {!canVerify && (
          <div className="kvm-readonly-banner">
            <AlertCircle size={14} />
            Read-only access — only authorized IRM personnel can approve KYC submissions.
          </div>
        )}

        {/* Top Header Summary & Quick Actions Toolbar */}
        <div className="kvm-top-toolbar">
          <div className="kvm-progress-summary">
            <span>Verification Progress:</span>
            <span
              className={
                'kvm-badge-counter ' +
                (allVerified
                  ? 'kvm-badge-counter--all-ok'
                  : anyWrong
                    ? 'kvm-badge-counter--wrong'
                    : 'kvm-badge-counter--pending')
              }
            >
              {verifiedCount} of 6 Sections Verified
            </span>
          </div>

          {canVerify && (
            <div className="kvm-quick-actions">
              <button
                type="button"
                className="kvm-btn-quick-verify"
                onClick={handleQuickVerifyAll}
                title="Mark all 6 sections as correct at once"
              >
                <CheckCircle2 size={13} /> Verify All Sections
              </button>
            </div>
          )}
        </div>

        {/* Master Table Header */}
        <div className="kvm-table-header">
          <div className="kvm-col-info">Section &amp; Submitted Information</div>
          <div className="kvm-col-verify">Inspect</div>
          <div className="kvm-col-mark kvm-col-mark--header" aria-label="Mark wrong">✗</div>
          <div className="kvm-col-mark kvm-col-mark--header" aria-label="Mark correct">✓</div>
        </div>

        {/* Master Rows */}
        <div className="kvm-rows">{SECTION_KEYS.map(renderSection)}</div>

        {confirmVerify && (
          <div className="kvm-confirm-banner">
            <ShieldCheck size={16} />
            All 6 sections verified with attached proof documents. Clicking <strong>Confirm — Approve &amp; Mark Verified</strong> will officially approve this investor's KYC in the system.
          </div>
        )}

        {anyWrong && wrongReasonMissing && (
          <div className="kvm-warn-banner">
            <AlertCircle size={14} />
            Please enter a specific reason for each section marked as wrong so the customer can be notified accurately.
          </div>
        )}
      </div>
    </Modal>
  );
};
