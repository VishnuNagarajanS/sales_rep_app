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
  Clock,
} from 'lucide-react';
import { Modal } from '../../../components/common/Modal';
import { Deal } from '../../../types';
import { KycChecklist } from '../../../services/kycService';
import { useAuth } from '../../../context/AuthContext';
import { PERMISSIONS } from '../../../constants/permissions';
import { isMockMode } from '../../../config/environment';
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

export type KycSectionKey = 'aadhaar' | 'pan' | 'bank';

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

function maskAadhaar(v?: string) {
  if (!v) return null;
  const clean = v.replace(/\s/g, '');
  if (clean.length < 4) return v;
  return 'XXXX XXXX ' + clean.slice(-4);
}

function maskAccount(v?: string) {
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

function AadhaarDetails({ data }: { data: Record<string, any> }) {
  return (
    <div className="kvm-detail-block">
      <DetailField label="Aadhaar Number" value={maskAadhaar(data.aadhaarNumber)} />
      <DetailField label="Name on Document" value={data.nameAsPerPan || data.investorName} />
      <DetailField label="Date of Birth" value={data.dob} />
      <DetailField label="Permanent Address" value={data.address} />
      <DetailField label="Pincode" value={data.pincode} />
      <DetailField label="Aadhaar Document" value={data.aadhaarDoc?.name} />
    </div>
  );
}

function PanDetails({ data }: { data: Record<string, any> }) {
  return (
    <div className="kvm-detail-block">
      <DetailField label="PAN Number" value={data.panNumber} />
      <DetailField label="Name as per PAN" value={data.nameAsPerPan} />
      <DetailField label="Father's Name" value={data.fatherName} />
      <DetailField label="PAN Document" value={data.panDoc?.name} />
    </div>
  );
}

function BankDetails({ data }: { data: Record<string, any> }) {
  return (
    <div className="kvm-detail-block">
      <DetailField label="Account Holder" value={data.accountHolderName || data.investorName} />
      <DetailField label="Bank Name" value={data.bankName} />
      <DetailField label="Account Number" value={maskAccount(data.accountNumber)} />
      <DetailField label="Account Type" value={data.accountType} />
      <DetailField label="IFSC Code" value={data.ifscCode} />
      <DetailField label="Branch" value={data.branchName} />
      <DetailField label="Bank Proof Document" value={data.bankProofDoc?.name} />
    </div>
  );
}

function hasSectionData(key: KycSectionKey, data: Record<string, any>): boolean {
  if (key === 'aadhaar') return !!(data.aadhaarNumber || data.aadhaarDoc);
  if (key === 'pan') return !!(data.panNumber || data.panDoc);
  if (key === 'bank') return !!(data.bankName || data.accountNumber || data.bankProofDoc);
  return false;
}

// ── Draft persistence ─────────────────────────────────────────────────────────

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

// ── Constants ─────────────────────────────────────────────────────────────────

const SECTION_LABELS: Record<KycSectionKey, string> = {
  aadhaar: 'Aadhaar Details',
  pan: 'PAN Details',
  bank: 'Bank Details',
};

const SECTION_KEYS: KycSectionKey[] = ['aadhaar', 'pan', 'bank'];

function SectionIcon({ k }: { k: KycSectionKey }) {
  if (k === 'aadhaar') return <User size={14} />;
  if (k === 'pan') return <ShieldCheck size={14} />;
  return <Building size={14} />;
}

// ── Main component ─────────────────────────────────────────────────────────────

export const KycVerifyModal: React.FC<KycVerifyModalProps> = ({
  isOpen,
  onClose,
  deal,
  profileKycData,
  onSaveVerification,
  onShowToast,
}) => {
  const { user, permissions } = useAuth();
  const canVerify = permissions.includes(PERMISSIONS.KYC_VERIFY);

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
    return { aadhaar: makeOne('aadhaar'), pan: makeOne('pan'), bank: makeOne('bank') };
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
      reviewedBy: user?.email || 'irm@ghl.com',
      reviewedAt: new Date().toISOString(),
    });
  };

  const allMarked = SECTION_KEYS.every(k => sections[k].status !== 'unchecked');
  const allVerified = SECTION_KEYS.every(k => sections[k].status === 'verified');
  const anyWrong = SECTION_KEYS.some(k => sections[k].status === 'wrong');
  const wrongReasonMissing = SECTION_KEYS.some(
    k => sections[k].status === 'wrong' && !sections[k].reason.trim(),
  );
  const canSave = allMarked && (!anyWrong || !wrongReasonMissing);

  const resolvedKycId = (deal as any).kycId || (deal as any).kycRecordId || deal.id;

  const patchDraft = useCallback(async () => {
    persistDraftLocally(deal.id, sections);

    if (isMockMode()) return;

    const token =
      sessionStorage.getItem('nexus_auth_token') ||
      localStorage.getItem('nexus_auth_token') ||
      localStorage.getItem('token') || '';

    const res = await fetch('/api/irm/kyc/' + resolvedKycId + '/verification', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      body: JSON.stringify({
        aadhaar: { status: sections.aadhaar.status, reason: sections.aadhaar.reason || null },
        pan: { status: sections.pan.status, reason: sections.pan.reason || null },
        bank: { status: sections.bank.status, reason: sections.bank.reason || null },
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to save draft');
    }
  }, [sections, deal.id, resolvedKycId]);

  const handleSaveDraft = async () => {
    setDraftSaving(true);
    try {
      await patchDraft();
      onShowToast('Draft saved — marks preserved.');
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
          identity: true, bank: true, documents: true, nominee: true, demat: true,
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
    const hasData = hasSectionData(key, profileKycData);
    const isDisabled = !hasData;
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

          {isDisabled ? (
            <span className="kvm-not-provided" style={{ display: 'block', marginTop: 4 }}>
              No data submitted
            </span>
          ) : (
            <>
              {!s.expanded && (
                <div className="kvm-preview">
                  {key === 'aadhaar' && (maskAadhaar(profileKycData.aadhaarNumber) || '—')}
                  {key === 'pan' && (profileKycData.panNumber || '—')}
                  {key === 'bank' &&
                    ((profileKycData.bankName || '—') +
                      ' · ' +
                      (maskAccount(profileKycData.accountNumber) || '—'))}
                </div>
              )}
              {s.expanded && (
                <>
                  {key === 'aadhaar' && <AadhaarDetails data={profileKycData} />}
                  {key === 'pan' && <PanDetails data={profileKycData} />}
                  {key === 'bank' && <BankDetails data={profileKycData} />}
                </>
              )}

              {crossActive && canVerify && (
                <div className="kvm-reason-row">
                  <label className="kvm-reason-label">Reason / what is wrong *</label>
                  <textarea
                    className={'kvm-reason-input' + (!s.reason.trim() ? ' kvm-reason-input--error' : '')}
                    placeholder="Describe what is incorrect in this section…"
                    value={s.reason}
                    onChange={e => updateSection(key, { reason: e.target.value })}
                    rows={2}
                  />
                  {!s.reason.trim() && (
                    <span className="kvm-reason-error">
                      <AlertCircle size={11} /> Reason is required
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
            </>
          )}
        </div>

        {/* Col 2: Verify / expand */}
        <div className="kvm-col-verify">
          <button
            type="button"
            className={'kvm-expand-btn' + (s.expanded ? ' kvm-expand-btn--active' : '')}
            disabled={isDisabled}
            onClick={() => handleExpand(key)}
            aria-expanded={s.expanded}
            aria-label={(s.expanded ? 'Collapse ' : 'Expand ') + SECTION_LABELS[key] + ' details'}
            title={
              isDisabled
                ? 'Customer has not submitted this section'
                : s.expanded
                  ? 'Collapse details'
                  : 'Expand to verify details'
            }
          >
            {s.expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            <span>{s.expanded ? 'Close' : 'Verify'}</span>
          </button>
        </div>

        {/* Col 3: ✗ */}
        <div className="kvm-col-mark">
          <button
            type="button"
            className={'kvm-mark-btn kvm-mark-wrong' + (crossActive ? ' kvm-mark-active-wrong' : '')}
            disabled={isDisabled || !s.viewedOnce || !canVerify}
            onClick={() => handleMark(key, 'wrong')}
            aria-label={'Mark ' + SECTION_LABELS[key] + ' wrong'}
            aria-pressed={crossActive}
            title={
              !canVerify
                ? 'You lack the kyc.verify permission'
                : !s.viewedOnce
                  ? 'Click Verify first to inspect the details'
                  : 'Mark as wrong'
            }
          >
            <X size={20} />
          </button>
        </div>

        {/* Col 4: ✓ */}
        <div className="kvm-col-mark">
          <button
            type="button"
            className={'kvm-mark-btn kvm-mark-ok' + (tickActive ? ' kvm-mark-active-ok' : '')}
            disabled={isDisabled || !s.viewedOnce || !canVerify}
            onClick={() => handleMark(key, 'verified')}
            aria-label={'Mark ' + SECTION_LABELS[key] + ' correct'}
            aria-pressed={tickActive}
            title={
              !canVerify
                ? 'You lack the kyc.verify permission'
                : !s.viewedOnce
                  ? 'Click Verify first to inspect the details'
                  : 'Mark as correct'
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
      <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={saving}>
        Cancel
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
                  ? 'Enter a reason for each wrong section'
                  : 'Mark all 3 sections before saving'
                : ''
            }
          >
            {saving
              ? 'Saving…'
              : confirmVerify
                ? '✓ Confirm — Mark Verified'
                : 'Save Verification'}
          </button>
        </>
      )}
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Verify KYC Details"
      subtitle={deal.customerName + ' · ' + ((deal as any).ghlId || deal.id)}
      size="xl"
      footer={footer}
    >
      <div className="kvm-body">
        {!canVerify && (
          <div className="kvm-readonly-banner">
            <AlertCircle size={14} />
            Read-only access — only users with the <strong>kyc.verify</strong> permission can mark sections.
          </div>
        )}

        <div className="kvm-table-header">
          <div className="kvm-col-info">Section &amp; Submitted Details</div>
          <div className="kvm-col-verify">Inspect</div>
          <div className="kvm-col-mark kvm-col-mark--header" aria-label="Mark wrong">✗</div>
          <div className="kvm-col-mark kvm-col-mark--header" aria-label="Mark correct">✓</div>
        </div>

        <div className="kvm-rows">{SECTION_KEYS.map(renderSection)}</div>

        {confirmVerify && (
          <div className="kvm-confirm-banner">
            <ShieldCheck size={14} />
            All 3 sections marked correct. Saving will set KYC Status to{' '}
            <strong>Verified</strong> permanently. Click{' '}
            <strong>Confirm — Mark Verified</strong> to proceed, or Cancel.
          </div>
        )}

        {anyWrong && wrongReasonMissing && (
          <div className="kvm-warn-banner">
            <AlertCircle size={14} />
            Please enter a reason for each section marked as wrong before saving.
          </div>
        )}
      </div>
    </Modal>
  );
};
