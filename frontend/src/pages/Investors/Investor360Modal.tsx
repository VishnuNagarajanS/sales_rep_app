import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  Phone,
  Clock,
  AlertCircle,
  FileText,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Copy,
  Check,
  UserCheck,
  Briefcase,
  IndianRupee,
  LayoutDashboard,
  Activity,
  TrendingUp,
  FolderOpen,
  Edit3,
  MapPin,
  Building,
  CreditCard,
  Users,
  Award,
  ArrowLeft,
  ChevronRight,
  Mail,
} from 'lucide-react';
import {
  Investor,
  Deal,
  CallRecord,
  Consultation,
  InvestmentOpportunity,
  Followup,
} from '../../types';
import { DocumentUploader } from '../../components/common/DocumentUploader';
import { DocumentList } from '../../components/common/DocumentList';
import { useTheme } from '../../context/ThemeContext';
import { getAuthHeaders } from '../../utils/authHeaders';
import { apiUrl } from '../../utils/apiUrl';
import { formatSmartScheduleDate } from '../../utils/dateUtils';
import './Investor360Modal.css';

interface Investor360ModalProps {
  isOpen: boolean;
  onClose: () => void;
  investor: Investor | null;
  deals: Deal[];
  calls: CallRecord[];
  consultations: Consultation[];
  opportunities: InvestmentOpportunity[];
  followups: Followup[];
  tenant?: any;
  isGhlAdmin?: boolean;
  onEditInvestor: (investor: Investor) => void;
  onCallCustomer: (name: string, phone: string, entityId?: string) => void;
  isInline?: boolean;
}

interface KycRecordDto {
  id?: number;
  status?: string;
  investorName?: string;
  nameAsPerPan?: string;
  fatherName?: string;
  dateOfBirth?: string;
  gender?: string;
  investorType?: string;
  residentType?: string;
  occupation?: string;
  panNumber?: string;
  aadhaarNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  accountType?: string;
  dematAccountNumber?: string;
  dpId?: string;
  nomineesJson?: string;
  panDocumentUrl?: string;
  aadhaarDocumentUrl?: string;
  bankChequeUrl?: string;
  dematDocumentUrl?: string;
  photoUrl?: string;
  signatureUrl?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  submittedAt?: string;
  customerConsentObtained?: boolean;
  customerConsentTimestamp?: string;
}

function maskPan(pan?: string | null): string {
  if (!pan) return '—';
  const clean = pan.trim();
  if (clean.length < 10) return clean;
  return `${clean.slice(0, 5)}****${clean.slice(9)}`;
}

function maskAadhaar(aadhaar?: string | null): string {
  if (!aadhaar) return '—';
  const clean = aadhaar.replace(/\D/g, '');
  if (clean.length < 4) return clean;
  return `•••• •••• ${clean.slice(-4)}`;
}

function maskAccount(acc?: string | null): string {
  if (!acc) return '—';
  const clean = acc.trim();
  if (clean.length < 4) return clean;
  return `•••• ${clean.slice(-4)}`;
}

function formatDate(val?: string | null): string {
  if (!val) return '—';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return val;
  }
}

function formatDuration(sec?: number): string {
  if (!sec || isNaN(sec)) return '0s';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

export const Investor360Modal: React.FC<Investor360ModalProps> = ({
  isOpen,
  onClose,
  investor,
  deals,
  calls,
  consultations,
  opportunities,
  followups,
  tenant,
  isGhlAdmin = false,
  onEditInvestor,
  onCallCustomer,
  isInline = false,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [activeTab, setActiveTab] = useState<'overview' | 'kyc' | 'activity' | 'opportunities' | 'documents'>('overview');
  const [docsTab, setDocsTab] = useState<'investor' | 'company'>('investor');
  const [kycData, setKycData] = useState<KycRecordDto | null>(null);
  const [loadingKyc, setLoadingKyc] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Copy to clipboard helper
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Reset tab to overview on open
  useEffect(() => {
    if (isOpen) {
      setActiveTab('overview');
    }
  }, [isOpen, investor?.id]);

  // Fetch KYC details for this investor
  useEffect(() => {
    if (!isOpen || !investor) {
      setKycData(null);
      setLoadingKyc(false);
      return;
    }

    let isMounted = true;
    const fetchKyc = async () => {
      setLoadingKyc(true);
      try {
        // 1. Try by phone first (primary identifier across CRM and KYC)
        if (investor.phone && investor.phone.trim()) {
          try {
            const res = await fetch(apiUrl(`/irm/kyc/by-phone?phone=${encodeURIComponent(investor.phone.trim())}`), {
              headers: getAuthHeaders(),
            });
            if (res.ok) {
              const json = await res.json();
              if (json.success && json.data) {
                if (isMounted) {
                  setKycData(json.data);
                  setLoadingKyc(false);
                }
                return;
              }
            }
          } catch {}
        }

        // 2. Try by email
        if (investor.email && investor.email.trim()) {
          try {
            const res = await fetch(apiUrl(`/irm/kyc/by-email?email=${encodeURIComponent(investor.email.trim())}`), {
              headers: getAuthHeaders(),
            });
            if (res.ok) {
              const json = await res.json();
              if (json.success && json.data) {
                if (isMounted) {
                  setKycData(json.data);
                  setLoadingKyc(false);
                }
                return;
              }
            }
          } catch {}
        }

        // 3. Try matching deal's kycId or kycRecordId
        const fDigits = (investor.phone || '').replace(/\D/g, '').slice(-10);
        const matchingDeal = deals.find(d => {
          if (d.customerId && String(d.customerId) === String(investor.id)) return true;
          const dDigits = (d.phone || '').replace(/\D/g, '').slice(-10);
          if (fDigits && dDigits && dDigits === fDigits) return true;
          if (d.email && investor.email && d.email.trim().toLowerCase() === investor.email.trim().toLowerCase()) return true;
          return false;
        });

        const altId = (matchingDeal as any)?.kycId || (matchingDeal as any)?.kycRecordId;
        if (altId) {
          try {
            const res = await fetch(apiUrl(`/irm/kyc/${altId}`), {
              headers: getAuthHeaders(),
            });
            if (res.ok) {
              const json = await res.json();
              if (json.success && json.data) {
                if (isMounted) {
                  setKycData(json.data);
                  setLoadingKyc(false);
                }
                return;
              }
            }
          } catch {}
        }

        // 4. Try by investor ID via dedicated endpoint
        if (investor.id) {
          try {
            const res = await fetch(apiUrl(`/irm/kyc/by-investor/${investor.id}`), {
              headers: getAuthHeaders(),
            });
            if (res.ok) {
              const json = await res.json();
              if (json.success && json.data) {
                if (isMounted) {
                  setKycData(json.data);
                  setLoadingKyc(false);
                }
                return;
              }
            }
          } catch {}
        }

        // 5. Fallback: query all KYCs and match by phone digits, email, or name
        try {
          const res = await fetch(apiUrl('/irm/kyc/all'), {
            headers: getAuthHeaders(),
          });
          if (res.ok) {
            const json = await res.json();
            if (json.success && Array.isArray(json.data)) {
              const cleanMail = (investor.email || '').trim().toLowerCase();
              const cleanName = (investor.name || '').trim().toLowerCase();

              const candidates = json.data.filter((k: any) => {
                const kp = (k.phone || '').replace(/\D/g, '').slice(-10);
                if (fDigits && kp && fDigits === kp) return true;
                const km = (k.email || '').trim().toLowerCase();
                if (cleanMail && km && cleanMail === km) return true;
                const kn = (k.investorName || '').trim().toLowerCase();
                if (cleanName && kn && cleanName === kn) return true;
                return false;
              });

              // Prioritize approved/verified record or one with PAN number over empty draft
              const bestCandidate = candidates.find((c: any) => c.status === 'Approved' || c.status === 'Verified' || c.panNumber) || candidates[0];

              if (bestCandidate?.id) {
                const detailRes = await fetch(apiUrl(`/irm/kyc/${bestCandidate.id}`), {
                  headers: getAuthHeaders(),
                });
                if (detailRes.ok) {
                  const detailJson = await detailRes.json();
                  if (detailJson.success && detailJson.data) {
                    if (isMounted) {
                      setKycData(detailJson.data);
                      setLoadingKyc(false);
                    }
                    return;
                  }
                }
              }
            }
          }
        } catch {}

        if (isMounted) {
          setKycData(null);
        }
      } catch (err) {
        console.warn('Could not load KYC for investor:', err);
        if (isMounted) setKycData(null);
      } finally {
        if (isMounted) setLoadingKyc(false);
      }
    };

    fetchKyc();
    return () => {
      isMounted = false;
    };
  }, [isOpen, investor?.id, investor?.email, investor?.phone, deals]);

  if (!isOpen || !investor) return null;

  // Filter matching records for Activity & Opportunities tabs
  const fDigits = (investor.phone || '').replace(/\D/g, '').slice(-10);
  const invName = (investor.name || '').trim().toLowerCase();

  const matchingCalls = calls.filter(c => {
    if (c.investorId && String(c.investorId) === String(investor.id)) return true;
    if (c.contactId && String(c.contactId) === String(investor.id)) return true;
    if (c.customerId && String(c.customerId) === String(investor.id)) return true;
    const cDigits = (c.contactPhone || '').replace(/\D/g, '').slice(-10);
    if (fDigits && cDigits && cDigits === fDigits) return true;
    if (c.contactName && c.contactName.trim().toLowerCase() === invName) return true;
    return false;
  });

  const matchingConsultations = consultations.filter(con => {
    if (con.investorId && String(con.investorId) === String(investor.id)) return true;
    const conDigits = (con.investorPhone || '').replace(/\D/g, '').slice(-10);
    if (fDigits && conDigits && conDigits === fDigits) return true;
    if (con.investorName && con.investorName.trim().toLowerCase() === invName) return true;
    return false;
  });

  const matchingFollowups = followups.filter(f => {
    if (f.contactId && String(f.contactId) === String(investor.id)) return true;
    const fPhoneDigits = (f.contactPhone || '').replace(/\D/g, '').slice(-10);
    if (fDigits && fPhoneDigits && fPhoneDigits === fDigits) return true;
    if (f.contactName && f.contactName.trim().toLowerCase() === invName) return true;
    return false;
  });

  const matchingOpportunities = opportunities.filter(o => {
    if (o.investorId && String(o.investorId) === String(investor.id)) return true;
    if (o.investorName && o.investorName.trim().toLowerCase() === invName) return true;
    return false;
  });

  // Calculate investment amount
  const matchingDeal = deals.find(d => {
    if (d.customerId && String(d.customerId) === String(investor.id)) return true;
    const dDigits = (d.phone || '').replace(/\D/g, '').slice(-10);
    if (fDigits && dDigits && dDigits === fDigits) return true;
    if (d.email && investor.email && d.email.trim().toLowerCase() === investor.email.trim().toLowerCase()) return true;
    return false;
  });

  const displayInvestmentAmount =
    matchingDeal?.value ||
    (investor.committedAUM && !isNaN(Number(investor.committedAUM)) && Number(investor.committedAUM) > 0
      ? Number(investor.committedAUM)
      : null);

  // Initials for avatar
  const initials = investor.name
    ? investor.name
      .split(' ')
      .map(w => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase()
    : 'IN';

  // Parse nominees
  let nomineesList: Array<{ name?: string; relationship?: string; allocationPercentage?: number; share?: number }> = [];
  if (kycData?.nomineesJson) {
    try {
      const parsed = JSON.parse(kycData.nomineesJson);
      if (Array.isArray(parsed)) nomineesList = parsed;
    } catch {
      nomineesList = [];
    }
  }

  const isKycApproved =
    kycData?.status === 'Approved' ||
    kycData?.status === 'Verified' ||
    kycData?.status === 'Completed';

  const isKycSubmitted =
    kycData?.status === 'PendingReview' ||
    kycData?.status === 'Submitted' ||
    kycData?.status === 'Under Verification';

  const mainCard = (
    <div className={`iv-container ${isInline ? 'iv-inline-container' : ''} ${isDark ? 'dark-theme' : 'light-theme'}`} onClick={e => e.stopPropagation()}>
      {/* Top brand accent gradient bar */}
      <div className="iv-bar3"></div>

      {/* ── Header / Hero Profile Banner ─────────────────────────────────── */}
      <div className="iv-hd">
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flex: 1, minWidth: 0 }}>
          <div className="iv-av-wrapper">
            <div className="iv-av">{initials}</div>
            {isKycApproved && (
              <div className="iv-av-badge" title="KYC Verified">
                <Check size={11} strokeWidth={3} />
              </div>
            )}
          </div>

          <div className="iv-hd-info" style={{ flex: 1, minWidth: 0 }}>
            <div className="iv-hd-title-row">
              <h2 className="iv-hd-name">{investor.name}</h2>
              {isKycApproved && (
                <span className="iv-status-pill iv-status-verified">
                  <CheckCircle2 size={12} /> KYC Verified
                </span>
              )}
              <span className="iv-c g">
                <Award size={11} />
                {investor.status || 'Active Investor'}
              </span>
              <span className="iv-c muted" style={{ fontFamily: 'monospace' }}>
                ID #{investor.id}
              </span>
            </div>

            <div className="iv-hd-meta">
              {investor.phone && (
                <span
                  className="iv-copy-pill"
                  onClick={() => handleCopy(investor.phone, 'phone')}
                  title="Click to copy phone"
                >
                  <Phone size={12} opacity={0.7} />
                  <span>{investor.phone}</span>
                  {copiedKey === 'phone' ? <Check size={12} color="#10b981" /> : <Copy size={11} opacity={0.6} />}
                </span>
              )}
              {investor.phone && investor.email && <span className="iv-meta-dot">•</span>}
              {investor.email && (
                <span
                  className="iv-copy-pill"
                  onClick={() => handleCopy(investor.email, 'email')}
                  title="Click to copy email"
                >
                  <Mail size={12} opacity={0.7} />
                  <span>{investor.email}</span>
                  {copiedKey === 'email' ? <Check size={12} color="#10b981" /> : <Copy size={11} opacity={0.6} />}
                </span>
              )}
              {(investor.preferredAssetClass || kycData?.city) && (
                <>
                  <span className="iv-meta-dot">•</span>
                  <span className="iv-meta-location">
                    <MapPin size={12} opacity={0.7} />
                    <span>{kycData?.city || investor.preferredAssetClass}</span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {!isInline && (
          <button className="iv-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        )}
      </div>

      {/* ── Key Metrics Stats Bar ───────────────────────────────────────── */}
      <div className="iv-st">
        <div className="iv-k">
          <div className="iv-k-label">
            <UserCheck size={13} />
            <span>Wealth Consultant</span>
          </div>
          <div className="iv-k-val">{investor.assignedAgentName && investor.assignedAgentName !== '—' ? investor.assignedAgentName : <span className="not-specified-badge">Unassigned</span>}</div>
        </div>

        <div className="iv-k">
          <div className="iv-k-label">
            <Briefcase size={13} />
            <span>Capital Capacity</span>
          </div>
          <div className="iv-k-val">{investor.investmentCapacity && investor.investmentCapacity !== '—' ? investor.investmentCapacity : <span className="not-specified-badge">Not Specified</span>}</div>
        </div>

        <div className="iv-k">
          <div className="iv-k-label">
            <IndianRupee size={13} />
            <span>Investment Amount</span>
          </div>
          <div className={`iv-k-val ${displayInvestmentAmount ? 'emerald' : ''}`}>
            {displayInvestmentAmount ? `₹${displayInvestmentAmount.toLocaleString('en-IN')}` : <span className="not-specified-badge">Not Specified</span>}
          </div>
        </div>

        <div className="iv-k">
          <div className="iv-k-label">
            <Calendar size={13} />
            <span>Investor Since</span>
          </div>
          <div className="iv-k-val">{formatDate(investor.createdAt)}</div>
        </div>
      </div>

      {/* ── Segmented Navigation Tabs Bar ───────────────────────────────── */}
      <div className="iv-tabs">
        <button
          className={activeTab === 'overview' ? 'on' : ''}
          onClick={() => setActiveTab('overview')}
        >
          <LayoutDashboard size={14} />
          Overview
        </button>
        <button
          className={activeTab === 'kyc' ? 'on' : ''}
          onClick={() => setActiveTab('kyc')}
        >
          <ShieldCheck size={14} />
          KYC
          {isKycApproved && (
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
          )}
        </button>
        <button
          className={activeTab === 'activity' ? 'on' : ''}
          onClick={() => setActiveTab('activity')}
        >
          <Activity size={14} />
          Activity
          <span className="iv-tab-counter">{matchingCalls.length + matchingConsultations.length}</span>
        </button>
        <button
          className={activeTab === 'opportunities' ? 'on' : ''}
          onClick={() => setActiveTab('opportunities')}
        >
          <TrendingUp size={14} />
          Opportunities
          <span className="iv-tab-counter">{matchingOpportunities.length}</span>
        </button>
        <button
          className={activeTab === 'documents' ? 'on' : ''}
          onClick={() => setActiveTab('documents')}
        >
          <FolderOpen size={14} />
          Documents
        </button>
      </div>

      {/* ── Scrollable Body Area ────────────────────────────────────────── */}
      <div className="iv-body" key={activeTab}>
        {/* ── Tab 1: Overview ────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="iv-overview-bento">
            {/* Left Column (Main Investment Allocation & Notes) */}
            <div className="iv-bento-col-main">
              <div className="iv-card">
                <div className="iv-card-header">
                  <div className="iv-lb">
                    <Briefcase size={13} />
                    Investment Allocation & Mandate
                  </div>
                  <span className="iv-c muted">{investor.status || 'Active'}</span>
                </div>

                <div className="iv-grid iv-grid-3col">
                  <div className="iv-grid-item">
                    <span>Capital Capacity</span>
                    <b>{investor.investmentCapacity && investor.investmentCapacity !== '—' ? investor.investmentCapacity : <span className="not-specified-badge">Not Specified</span>}</b>
                  </div>
                  <div className="iv-grid-item">
                    <span>Preferred Asset Class</span>
                    <b>{investor.preferredAssetClass && investor.preferredAssetClass !== '—' ? investor.preferredAssetClass : <span className="not-specified-badge">Not Specified</span>}</b>
                  </div>
                  <div className="iv-grid-item">
                    <span>Investment Mandate</span>
                    <b>{investor.investmentMandate && investor.investmentMandate !== '—' ? investor.investmentMandate : <span className="not-specified-badge">Not Specified</span>}</b>
                  </div>
                  <div className="iv-grid-item">
                    <span>Risk Tolerance</span>
                    <b>{investor.riskTolerance ? investor.riskTolerance : <span className="not-specified-badge">Not Specified</span>}</b>
                  </div>
                  <div className="iv-grid-item">
                    <span>Committed AUM</span>
                    <b style={{ color: investor.committedAUM ? '#059669' : undefined }}>
                      {investor.committedAUM ? `₹${Number(investor.committedAUM).toLocaleString('en-IN')}` : <span className="not-specified-badge">Not Specified</span>}
                    </b>
                  </div>
                  <div className="iv-grid-item">
                    <span>Referral Source</span>
                    <b>{investor.referralSource || 'Direct Outreach'}</b>
                  </div>
                </div>
              </div>

              <div className="iv-card">
                <div className="iv-card-header">
                  <div className="iv-lb">
                    <FileText size={13} />
                    Advisory Portfolio Notes
                  </div>
                </div>
                <div className="iv-notes-box">
                  <p style={{ margin: 0, whiteSpace: 'pre-line', lineHeight: 1.6, color: 'var(--iv-text-secondary)', fontSize: 13 }}>
                    {investor.notes || 'No advisory portfolio notes recorded for this investor.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column (Relationship & Audit) */}
            <div className="iv-bento-col-side">
              <div className="iv-card">
                <div className="iv-card-header">
                  <div className="iv-lb">
                    <UserCheck size={13} />
                    Wealth Relationship
                  </div>
                </div>
                <div className="iv-advisor-card">
                  <div className="iv-advisor-avatar">
                    {(investor.assignedAgentName || 'U').slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <div className="iv-advisor-name">
                      {investor.assignedAgentName && investor.assignedAgentName !== '—' ? investor.assignedAgentName : 'Unassigned Advisor'}
                    </div>
                    <div className="iv-advisor-role"></div>
                  </div>
                </div>
              </div>

              {(investor.handoverId || (investor as any).handedOverFromName) && (
                <div className="iv-card">
                  <div className="iv-card-header">
                    <div className="iv-lb">
                      <UserCheck size={13} />
                      Work Handover Audit
                    </div>
                    <span className="iv-c a">Active Handover</span>
                  </div>
                  <div className="iv-grid">
                    <div className="iv-grid-item">
                      <span>Handed Over From</span>
                      <b>{(investor as any).handedOverFromName || 'Previous Lead Owner'}</b>
                    </div>
                    <div className="iv-grid-item">
                      <span>Planned Completion</span>
                      <b>{formatDate((investor as any).handoverPlannedEnd)}</b>
                    </div>
                  </div>
                </div>
              )}

              <div className="iv-card">
                <div className="iv-card-header">
                  <div className="iv-lb">
                    <Award size={13} />
                    Portfolio Readiness
                  </div>
                </div>
                <div className="iv-readiness-list">
                  <div className="iv-readiness-item">
                    <span>KYC Verification</span>
                    {isKycApproved ? (
                      <span className="iv-c g"><CheckCircle2 size={11} /> Verified</span>
                    ) : isKycSubmitted ? (
                      <span className="iv-c a"><Clock size={11} /> In Review</span>
                    ) : (
                      <span className="iv-c muted">Not Available</span>
                    )}
                  </div>
                  <div className="iv-readiness-item">
                    <span>Risk Tolerance</span>
                    <span className="iv-c b">{investor.riskTolerance || 'Standard'}</span>
                  </div>
                  <div className="iv-readiness-item">
                    <span>Logged Activities</span>
                    <span className="iv-c muted">{matchingCalls.length + matchingConsultations.length + matchingFollowups.length} logged</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab 2: KYC (Read-Only Verified KYC) ───────────────────────── */}
        {activeTab === 'kyc' && (
          <div>
            {loadingKyc ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--iv-text-muted)' }}>
                <Clock size={28} style={{ margin: '0 auto 10px', opacity: 0.6 }} className="spin" />
                <p style={{ margin: 0, fontWeight: 600 }}>Loading verified KYC submission...</p>
              </div>
            ) : !kycData ? (
              <div className="iv-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
                <ShieldCheck size={36} style={{ color: 'var(--iv-text-muted)', margin: '0 auto 10px', opacity: 0.4 }} />
                <p style={{ margin: 0, color: 'var(--iv-text-primary)', fontWeight: 700, fontSize: 14 }}>
                  KYC record not available
                </p>
                <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--iv-text-muted)' }}>
                  No verified KYC submission found for this investor yet.
                </p>
              </div>
            ) : (
              <>
                {/* Status Banner */}
                {isKycApproved && (
                  <div className="iv-ver">
                    <div className="iv-ver-icon-wrap">
                      <ShieldCheck size={22} color="#059669" />
                    </div>
                    <div>
                      <p style={{ margin: 0, color: 'var(--iv-ver-title)', fontWeight: 750, fontSize: 14 }}>
                        KYC Verified & Compliant
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--iv-ver-sub)' }}>
                        Verified by <strong>{kycData.verifiedBy || 'Compliance Officer'}</strong> on{' '}
                        {formatDate(kycData.verifiedAt || kycData.submittedAt)}
                      </p>
                    </div>
                  </div>
                )}

                {isKycSubmitted && !isKycApproved && (
                  <div className="iv-ver pending">
                    <div className="iv-ver-icon-wrap">
                      <Clock size={22} color="#d97706" />
                    </div>
                    <div>
                      <p style={{ margin: 0, color: 'var(--iv-pending-title)', fontWeight: 750, fontSize: 14 }}>
                        KYC Submitted – Pending Verification
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--iv-pending-sub)' }}>
                        Submitted on {formatDate(kycData.submittedAt)} • Compliance check in progress
                      </p>
                    </div>
                  </div>
                )}

                {!isKycApproved && !isKycSubmitted && (
                  <div className="iv-ver rejected">
                    <div className="iv-ver-icon-wrap">
                      <AlertCircle size={22} color="#dc2626" />
                    </div>
                    <div>
                      <p style={{ margin: 0, color: 'var(--iv-rejected-title)', fontWeight: 750, fontSize: 14 }}>
                        KYC Status: {kycData.status || 'Draft'}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--iv-rejected-sub)' }}>
                        Verification incomplete or requires document re-upload.
                      </p>
                    </div>
                  </div>
                )}

                <div className="iv-kyc-bento">
                  {/* Left Column */}
                  <div className="iv-bento-col">
                    {/* Personal details */}
                    <div className="iv-card">
                      <div className="iv-card-header">
                        <div className="iv-lb">
                          <UserCheck size={13} />
                          Personal Information
                        </div>
                      </div>
                      <div className="iv-grid">
                        <div className="iv-grid-item">
                          <span>Name as per PAN</span>
                          <b>{kycData.nameAsPerPan || kycData.investorName || '—'}</b>
                        </div>
                        <div className="iv-grid-item">
                          <span>Father Name</span>
                          <b>{kycData.fatherName || '—'}</b>
                        </div>
                        <div className="iv-grid-item">
                          <span>Date of Birth</span>
                          <b>{kycData.dateOfBirth || '—'}</b>
                        </div>
                        <div className="iv-grid-item">
                          <span>Gender</span>
                          <b>{kycData.gender || '—'}</b>
                        </div>
                        <div className="iv-grid-item">
                          <span>Investor Type</span>
                          <b>{kycData.investorType || '—'}</b>
                        </div>
                        <div className="iv-grid-item">
                          <span>Resident Type</span>
                          <b>{kycData.residentType || '—'}</b>
                        </div>
                        <div className="iv-grid-item" style={{ gridColumn: 'span 2' }}>
                          <span>Occupation</span>
                          <b>{kycData.occupation || '—'}</b>
                        </div>
                      </div>
                    </div>

                    {/* Address */}
                    <div className="iv-card">
                      <div className="iv-card-header">
                        <div className="iv-lb">
                          <MapPin size={13} />
                          Registered Address
                        </div>
                      </div>
                      <div className="iv-grid">
                        <div className="iv-grid-item" style={{ gridColumn: 'span 2' }}>
                          <span>Address Lines</span>
                          <b>{[kycData.addressLine1, kycData.addressLine2].filter(Boolean).join(', ') || '—'}</b>
                        </div>
                        <div className="iv-grid-item">
                          <span>City, State, Pincode</span>
                          <b>{[kycData.city, kycData.state, kycData.pincode].filter(Boolean).join(', ') || '—'}</b>
                        </div>
                        <div className="iv-grid-item">
                          <span>Country</span>
                          <b>{kycData.country || 'India'}</b>
                        </div>
                      </div>
                    </div>

                    {/* Consent Audit */}
                    {kycData.customerConsentObtained && (
                      <p style={{ margin: '8px 0 0', fontSize: 11.5, color: 'var(--iv-text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <CheckCircle2 size={13} color="#059669" />
                        Investor Electronic Consent obtained on {formatDate(kycData.customerConsentTimestamp)}
                      </p>
                    )}
                  </div>

                  {/* Right Column */}
                  <div className="iv-bento-col">
                    {/* Identity */}
                    <div className="iv-card">
                      <div className="iv-card-header">
                        <div className="iv-lb">
                          <CreditCard size={13} />
                          Government Identification
                        </div>
                      </div>
                      <div className="iv-grid">
                        <div className="iv-grid-item">
                          <span>PAN Card (Masked)</span>
                          <b style={{ letterSpacing: '0.04em' }}>{maskPan(kycData.panNumber)}</b>
                        </div>
                        <div className="iv-grid-item">
                          <span>Aadhaar (Last 4 Only)</span>
                          <b style={{ letterSpacing: '0.04em' }}>{maskAadhaar(kycData.aadhaarNumber)}</b>
                        </div>
                      </div>

                      <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {kycData.panDocumentUrl ? (
                          <a href={kycData.panDocumentUrl} target="_blank" rel="noopener noreferrer" className="iv-c g iv-c-link">
                            <CheckCircle2 size={12} /> PAN Document ↗
                          </a>
                        ) : (
                          <span className="iv-c muted">PAN Document</span>
                        )}

                        {kycData.aadhaarDocumentUrl ? (
                          <a href={kycData.aadhaarDocumentUrl} target="_blank" rel="noopener noreferrer" className="iv-c g iv-c-link">
                            <CheckCircle2 size={12} /> Aadhaar Document ↗
                          </a>
                        ) : (
                          <span className="iv-c muted">Aadhaar Document</span>
                        )}

                        {kycData.photoUrl ? (
                          <a href={kycData.photoUrl} target="_blank" rel="noopener noreferrer" className="iv-c g iv-c-link">
                            <CheckCircle2 size={12} /> Investor Photo ↗
                          </a>
                        ) : (
                          <span className="iv-c muted">Photo</span>
                        )}

                        {kycData.signatureUrl ? (
                          <a href={kycData.signatureUrl} target="_blank" rel="noopener noreferrer" className="iv-c g iv-c-link">
                            <CheckCircle2 size={12} /> Signature ↗
                          </a>
                        ) : (
                          <span className="iv-c muted">Signature</span>
                        )}
                      </div>
                    </div>

                    {/* Bank and Demat */}
                    <div className="iv-card">
                      <div className="iv-card-header">
                        <div className="iv-lb">
                          <Building size={13} />
                          Banking & Demat Depository
                        </div>
                      </div>
                      <div className="iv-grid">
                        <div className="iv-grid-item">
                          <span>Bank Name</span>
                          <b>{kycData.bankName || '—'}</b>
                        </div>
                        <div className="iv-grid-item">
                          <span>Account Type</span>
                          <b>{kycData.accountType || 'Savings Account'}</b>
                        </div>
                        <div className="iv-grid-item">
                          <span>Account Number (Last 4)</span>
                          <b style={{ letterSpacing: '0.04em' }}>{maskAccount(kycData.accountNumber)}</b>
                        </div>
                        <div className="iv-grid-item">
                          <span>IFSC Code</span>
                          <b style={{ letterSpacing: '0.04em' }}>{kycData.ifscCode || '—'}</b>
                        </div>
                        <div className="iv-grid-item">
                          <span>Demat Account Number</span>
                          <b>{kycData.dematAccountNumber || '—'}</b>
                        </div>
                        <div className="iv-grid-item">
                          <span>DP ID</span>
                          <b>{kycData.dpId || '—'}</b>
                        </div>
                      </div>

                      <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {kycData.bankChequeUrl ? (
                          <a href={kycData.bankChequeUrl} target="_blank" rel="noopener noreferrer" className="iv-c g iv-c-link">
                            <CheckCircle2 size={12} /> Cheque Leaf / Passbook ↗
                          </a>
                        ) : (
                          <span className="iv-c muted">Cheque Leaf</span>
                        )}

                        {kycData.dematDocumentUrl ? (
                          <a href={kycData.dematDocumentUrl} target="_blank" rel="noopener noreferrer" className="iv-c g iv-c-link">
                            <CheckCircle2 size={12} /> Demat Holding Proof ↗
                          </a>
                        ) : (
                          <span className="iv-c muted">Demat Proof</span>
                        )}
                      </div>
                    </div>

                    {/* Nominees */}
                    {nomineesList.length > 0 && (
                      <div className="iv-card">
                        <div className="iv-card-header">
                          <div className="iv-lb">
                            <Users size={13} />
                            Registered Nominees ({nomineesList.length})
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {nomineesList.map((nom, idx) => (
                            <div key={idx} className="iv-row" style={{ padding: '6px 10px' }}>
                              <div>
                                <b style={{ fontSize: 13, color: 'var(--iv-text-primary)' }}>{nom.name || 'Nominee'}</b>
                                <span style={{ fontSize: 12, color: 'var(--iv-text-muted)', marginLeft: 8 }}>
                                  ({nom.relationship || 'Nominee'})
                                </span>
                              </div>
                              <span className="iv-c b">
                                Share: {nom.allocationPercentage ?? nom.share ?? 100}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Tab 3: Activity ────────────────────────────────────────────── */}
        {activeTab === 'activity' && (
          <div className="iv-activity-bento">
            {/* Calls */}
            <div className="iv-card">
              <div className="iv-card-header">
                <div className="iv-lb">
                  <Phone size={13} />
                  Call Communications ({matchingCalls.length})
                </div>
              </div>

              {matchingCalls.length === 0 ? (
                <p className="iv-v-sub" style={{ margin: 0, padding: '10px 0' }}>No telephony sessions logged for this investor.</p>
              ) : (
                matchingCalls.slice(0, 10).map(c => (
                  <div key={c.id} className="iv-row">
                    <div>
                      <div style={{ fontWeight: 650, color: 'var(--iv-text-primary)', fontSize: 13 }}>
                        {c.direction === 'inbound' ? 'Inbound Customer Call' : 'Outbound Consultation Call'} • {formatDuration(c.duration)}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--iv-text-muted)', marginTop: 2 }}>
                        Disposition: <strong style={{ color: 'var(--iv-text-secondary)' }}>{c.disposition}</strong>
                        {c.notes ? ` — ${c.notes}` : ''}
                      </div>
                    </div>
                    <span className="iv-v-sub" style={{ whiteSpace: 'nowrap', fontWeight: 550 }}>
                      {formatDate(c.timestamp)}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Consultations */}
            <div className="iv-card">
              <div className="iv-card-header">
                <div className="iv-lb">
                  <Calendar size={13} />
                  Advisory Consultations ({matchingConsultations.length})
                </div>
              </div>

              {matchingConsultations.length === 0 ? (
                <p className="iv-v-sub" style={{ margin: 0, padding: '10px 0' }}>No advisory consultations recorded.</p>
              ) : (
                matchingConsultations.slice(0, 10).map(con => (
                  <div key={con.id} className="iv-row">
                    <div>
                      <div style={{ fontWeight: 650, color: 'var(--iv-text-primary)', fontSize: 13 }}>
                        {con.agenda || 'Portfolio Advisory Session'}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--iv-text-muted)', marginTop: 2 }}>
                        Status: <span className="iv-c a" style={{ padding: '1px 8px', fontSize: 10.5 }}>{con.status}</span>
                        {con.outcomeNotes ? ` — ${con.outcomeNotes}` : ''}
                      </div>
                    </div>
                    <span className="iv-v-sub" style={{ whiteSpace: 'nowrap', fontWeight: 550 }}>
                      {formatSmartScheduleDate(con.scheduledAt)}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Follow-ups */}
            <div className="iv-card">
              <div className="iv-card-header">
                <div className="iv-lb">
                  <Clock size={13} />
                  Scheduled Follow-ups ({matchingFollowups.length})
                </div>
              </div>

              {matchingFollowups.length === 0 ? (
                <p className="iv-v-sub" style={{ margin: 0, padding: '10px 0' }}>No pending follow-ups scheduled.</p>
              ) : (
                matchingFollowups.slice(0, 10).map(f => (
                  <div key={f.id} className="iv-row">
                    <div>
                      <div style={{ fontWeight: 650, color: 'var(--iv-text-primary)', fontSize: 13 }}>
                        {f.notes || 'Investor Relationship Follow-up'}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--iv-text-muted)', marginTop: 2 }}>
                        Priority: {f.priority || 'Normal'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className={`iv-c ${f.status === 'Completed' ? 'g' : 'a'}`}>
                        {f.status}
                      </span>
                      <span className="iv-v-sub" style={{ whiteSpace: 'nowrap' }}>
                        {formatSmartScheduleDate(f.scheduledAt)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── Tab 4: Opportunities ───────────────────────────────────────── */}
        {activeTab === 'opportunities' && (
          <div>
            {matchingOpportunities.length === 0 ? (
              <div className="iv-card" style={{ textAlign: 'center', padding: '36px 20px' }}>
                <TrendingUp size={36} style={{ color: 'var(--iv-text-muted)', margin: '0 auto 10px', opacity: 0.4 }} />
                <p style={{ margin: 0, color: 'var(--iv-text-primary)', fontWeight: 700, fontSize: 14 }}>
                  No opportunities linked
                </p>
                <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--iv-text-muted)' }}>
                  No commercial tranches or syndicated deals assigned to this investor.
                </p>
              </div>
            ) : (
              matchingOpportunities.map(opp => (
                <div key={opp.id} className="iv-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <b style={{ fontSize: 14, color: 'var(--iv-text-primary)' }}>
                      {opp.title || 'Commercial Syndicate Tranche'}
                    </b>
                    <span className="iv-c b">{opp.stage || 'Opportunity'}</span>
                  </div>

                  <div className="iv-grid" style={{ marginTop: 12 }}>
                    <div className="iv-grid-item">
                      <span>Committed Capital</span>
                      <b style={{ color: '#059669', fontSize: 14 }}>
                        {opp.committedAmount
                          ? `₹${Number(opp.committedAmount).toLocaleString('en-IN')}`
                          : opp.targetAmount
                            ? `₹${Number(opp.targetAmount).toLocaleString('en-IN')} (Target)`
                            : '—'}
                      </b>
                    </div>
                    <div className="iv-grid-item">
                      <span>Target Execution Date</span>
                      <b>{formatDate(opp.expectedCloseDate)}</b>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── Tab 5: Documents ───────────────────────────────────────────── */}
        {activeTab === 'documents' && (
          <div>
            <div className="iv-docs-toggle">
              <button
                className={`iv-docs-btn ${docsTab === 'investor' ? 'active' : ''}`}
                onClick={() => setDocsTab('investor')}
              >
                <FileText size={13} />
                Investor Documents
              </button>
              <button
                className={`iv-docs-btn ${docsTab === 'company' ? 'active' : ''}`}
                onClick={() => setDocsTab('company')}
              >
                <Building size={13} />
                Company Resources
              </button>
            </div>

            {docsTab === 'investor' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {!isGhlAdmin && (
                  <div className="iv-card">
                    <div className="iv-card-header">
                      <div className="iv-lb">
                        <FileText size={13} />
                        Upload Investor Document
                      </div>
                    </div>
                    <DocumentUploader
                      entityType="investor"
                      entityId={investor.id}
                      allowedCategories={[
                        'KYC',
                        'Mandate Agreement',
                        'Term Sheet',
                        'PAN / Aadhar',
                        'Other',
                      ]}
                    />
                  </div>
                )}

                <div className="iv-card">
                  <div className="iv-card-header">
                    <div className="iv-lb">
                      <FolderOpen size={13} />
                      Attached Files & Collateral
                    </div>
                  </div>
                  <DocumentList
                    entityType="investor"
                    entityId={investor.id}
                    canDelete={!isGhlAdmin}
                  />
                </div>
              </div>
            )}

            {docsTab === 'company' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {isGhlAdmin && (
                  <div className="iv-card">
                    <div className="iv-card-header">
                      <div className="iv-lb">
                        <Building size={13} />
                        Upload Company Resource
                      </div>
                    </div>
                    <DocumentUploader
                      entityType="company"
                      entityId={tenant?.id || tenant?.slug || '1'}
                      allowedCategories={['Brochure', 'Price List', 'Terms & Conditions', 'Policy Document', 'Other']}
                    />
                  </div>
                )}

                <div className="iv-card">
                  <div className="iv-card-header">
                    <div className="iv-lb">
                      <FolderOpen size={13} />
                      Available Company Resources
                    </div>
                  </div>
                  <DocumentList
                    entityType="company"
                    entityId={tenant?.id || tenant?.slug || '1'}
                    canDelete={isGhlAdmin}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <div className="iv-ft">
        <button
          className="iv-btn"
          onClick={() => onEditInvestor(investor)}
          id="iv-btn-edit-footer"
        >
          <Edit3 size={14} /> Edit Profile
        </button>
        <button
          className="iv-btn iv-btn-call"
          onClick={() => onCallCustomer(investor.name, investor.phone, investor.id)}
          id="iv-btn-call-footer"
        >
          <Phone size={14} /> Call Customer
        </button>
      </div>
    </div>
  );

  if (isInline) {
    return (
      <div className={`iv-workspace-canvas ${isDark ? 'dark-theme' : 'light-theme'}`}>
        <div className="iv-top-bar">
          <div className="iv-top-left">
            <button className="iv-back-btn" onClick={onClose} id="iv-btn-back">
              <ArrowLeft size={16} />
              <span>Back to Qualified Investors</span>
            </button>
            <div className="iv-breadcrumb">
              <span className="iv-crumb-muted">Qualified Investors</span>
              <ChevronRight size={13} className="iv-crumb-sep" />
              <span className="iv-crumb-current">{investor.name}</span>
            </div>
          </div>
          <div className="iv-top-right-actions">
            <button
              className="iv-action-btn iv-action-secondary"
              onClick={() => onEditInvestor(investor)}
              id="iv-btn-edit-top"
            >
              <Edit3 size={14} />
              <span>Edit Profile</span>
            </button>
            <button
              className="iv-action-btn iv-action-call"
              onClick={() => onCallCustomer(investor.name, investor.phone, investor.id)}
              id="iv-btn-call-top"
            >
              <Phone size={14} />
              <span>Call Customer</span>
            </button>
          </div>
        </div>
        {mainCard}
      </div>
    );
  }

  return (
    <div className={`iv-modal-backdrop ${isDark ? 'dark-theme' : 'light-theme'}`} onClick={onClose}>
      {mainCard}
    </div>
  );
};
