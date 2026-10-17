import React, { useState } from 'react';
import {
  Phone,
  Edit2,
  Mail,
  Clock,
  CheckCircle,
  FileText,
  User,
  ShieldCheck,
  IndianRupee,
  TrendingUp,
  Building2,
  Users,
  Copy,
  Check,
  ExternalLink,
  CheckCircle2,
  Hash,
  Landmark,
  ArrowLeft,
  FolderOpen,
  PhoneCall,
  Briefcase,
  Download,
  FileCheck,
  Calendar,
  AlertCircle,
  Shield,
  ArrowUpRight,
  ChevronRight,
  Layers,
  Percent,
  Info,
  X,
  AlertTriangle,
} from 'lucide-react';
import { Deal, CallRecord, Consultation, Followup } from '../../types';

export interface InvestmentRouteDetails {
  id: 'direct_aif' | 'debenture';
  name: string;
  pillLabel: string;
  fundType: string;
  focus: string;
  minInvestmentNum: number;
  minInvestmentLabel: string;
  targetReturns: string;
  returnStructure: string;
  capitalAppreciation?: string;
  totalAssuredReturns?: string;
  payoutFrequency: string;
  taxation: string;
  tenure: string;
  fundSize: string;
  strategyBullets: string[];
  documentsProvided: string[];
  securityStructure: string[];
  presets: { label: string; value: number }[];
}

export const INVESTMENT_ROUTES: Record<'direct_aif' | 'debenture', InvestmentRouteDetails> = {
  debenture: {
    id: 'debenture',
    name: 'Alternate route to Invest in AIF via Debenture',
    pillLabel: 'Alternate route to Invest in AIF via Debenture',
    fundType: 'Category II AIF (as per SEBI Alternative Investment Fund Regulations, 2012)',
    focus: 'Stressed and special situation real estate assets',
    minInvestmentNum: 1000000,
    minInvestmentLabel: 'starting from ₹10,00,000',
    targetReturns: '24% per annum',
    returnStructure: '1% per month (means 12% per annum)',
    capitalAppreciation: '12% per annum payable at redemption',
    totalAssuredReturns: '24% per annum',
    payoutFrequency: '1% Monthly Interest Payout',
    taxation: 'Interest taxable at applicable slab rate (10% TDS). Capital appreciation taxed at redemption.',
    tenure: 'Min 3 years, Max 10 years',
    fundSize: '₹100 crore',
    strategyBullets: [
      'Acquire industrial land, residential layouts, and commercial land at 30-50% below market value through bank auctions, distressed sales, and private deals.',
      'Monetize quickly by selling to industries, developers, or other end-users at less than fair market price.',
      'Short-to-medium term exits (usually 8-12 months) to generate attractive returns.',
    ],
    documentsProvided: [
      'Acknowledgment letter',
      'Debenture Agreement',
      'Debenture allotment letter',
      'Debenture Certificate (physical or demat)',
      'Investor portal access',
    ],
    securityStructure: [
      'Debenture Trustee appointed as per the Companies Act',
      'Mortgage / Charge creation on company assets',
      'CHG - 9 Form filed with Ministry of Corporate Affairs',
    ],
    presets: [
      { label: '₹10L', value: 1000000 },
      { label: '₹25L', value: 2500000 },
      { label: '₹50L', value: 5000000 },
      { label: '₹75L', value: 7500000 },
      { label: '₹1Cr', value: 10000000 },
    ],
  },
  direct_aif: {
    id: 'direct_aif',
    name: 'Direct AIF Route',
    pillLabel: 'Direct AIF Route',
    fundType: 'Category II AIF — Direct Investment',
    focus: 'SEBI-registered AIF with stressed real estate exposure',
    minInvestmentNum: 10000000,
    minInvestmentLabel: '₹1 crore (Direct AIF)',
    targetReturns: '24% p.a. (performance-linked; AIF cannot guarantee returns under SEBI guidelines)',
    returnStructure: '12% distributed annually as income; Balance profit added to capital for long-term wealth creation',
    payoutFrequency: 'Annual Income Distribution',
    taxation: 'Dividend / Interest taxable at applicable slab rate (10% TDS). Capital accumulation taxed as capital gains at 12% or 20% (without / with indexation)',
    tenure: 'Minimum - 3 years, Maximum - 10 years',
    fundSize: '₹100 crore',
    strategyBullets: [
      'Direct participation in SEBI-regulated AIF scheme',
      'Diversified portfolio across stressed real estate assets',
      'Professional fund management with quarterly NAV updates',
    ],
    documentsProvided: [
      'PPM (Private Placement Memorandum)',
      'Contribution Agreement',
      'Capital Call Notice',
      'NAV Statement',
    ],
    securityStructure: [
      'SEBI registered Category II AIF',
      'Independent custodian for assets',
      'Quarterly audited NAV',
    ],
    presets: [
      { label: '₹1 Cr', value: 10000000 },
      { label: '₹2 Cr', value: 20000000 },
      { label: '₹5 Cr', value: 50000000 },
      { label: '₹10 Cr', value: 100000000 },
    ],
  },
};

export const INVESTMENT_PRESETS = INVESTMENT_ROUTES.direct_aif.presets;

function formatCurrency(amount: number): string {
  if (isNaN(amount) || amount === 0) return '₹0';
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
  return `₹${amount.toLocaleString('en-IN')}`;
}

function formatDuration(sec?: number): string {
  if (!sec || isNaN(sec)) return '0s';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function formatDate(val?: string | null): string {
  if (!val) return '—';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return val;
  }
}

export interface OpportunityProfileWorkspaceProps {
  deal: Deal;
  liveKycData: any;
  isKycLoading: boolean;
  amountInput: string;
  isEditingAmount: boolean;
  activeDossierTab?: 'all' | 'basic' | 'identity' | 'bank' | 'demat' | 'nominees';
  copiedField: string | null;
  isDark: boolean;
  calls?: CallRecord[];
  consultations?: Consultation[];
  followups?: Followup[];
  onClose: () => void;
  onCallInvestor: (name: string, phone: string, entityId?: string) => void;
  onConvertDeal: (deal: Deal) => void;
  onEditAmount: () => void;
  onAmountInputChange: (val: string) => void;
  onConfirmAmountClick: (route?: 'direct_aif' | 'debenture') => void;
  onRouteChange?: (route: 'direct_aif' | 'debenture') => void;
  setActiveDossierTab?: (tab: 'all' | 'basic' | 'identity' | 'bank' | 'demat' | 'nominees') => void;
  copyToClipboard: (text: string, fieldKey: string) => void;
  getDealKycStatus: (deal: Deal, liveKyc?: any) => 'Pending' | 'Partially Completed' | 'Submitted' | 'Verified' | 'Wrong';
}

export const OpportunityProfileWorkspace: React.FC<OpportunityProfileWorkspaceProps> = ({
  deal,
  liveKycData,
  isKycLoading,
  amountInput,
  isEditingAmount,
  copiedField,
  isDark,
  calls = [],
  consultations = [],
  followups = [],
  onClose,
  onCallInvestor,
  onConvertDeal,
  onEditAmount,
  onAmountInputChange,
  onConfirmAmountClick,
  onRouteChange,
  copyToClipboard,
  getDealKycStatus,
}) => {
  // Determine initial route:
  const initialRoute: 'direct_aif' | 'debenture' =
    deal.investorType?.toLowerCase().includes('debenture') ||
    (deal.investmentRoute === 'debenture') ||
    (deal.value > 0 && deal.value < 10000000)
      ? 'debenture'
      : 'direct_aif';

  const [currentRoute, setCurrentRoute] = useState<'direct_aif' | 'debenture'>(initialRoute);
  const [showFundModal, setShowFundModal] = useState<boolean>(false);
  const [fundModalRoute, setFundModalRoute] = useState<'direct_aif' | 'debenture'>(initialRoute);

  const activeRouteMeta = INVESTMENT_ROUTES[currentRoute];

  const handleSelectRoute = (route: 'direct_aif' | 'debenture') => {
    setCurrentRoute(route);
    if (onRouteChange) {
      onRouteChange(route);
    }
  };

  const handleDownloadTerms = (routeKey: 'direct_aif' | 'debenture') => {
    const meta = INVESTMENT_ROUTES[routeKey];
    const textContent = `=====================================================
GHL INDIA VENTURES — AIF FUND TERMS & CONDITIONS
Route: ${meta.name}
Fund Type: ${meta.fundType}
Focus: ${meta.focus}
=====================================================

KEY INVESTMENT TERMS:
- Minimum Investment: ${meta.minInvestmentLabel}
- Target Returns: ${meta.targetReturns}
- Return Structure: ${meta.returnStructure}
${meta.capitalAppreciation ? `- Capital Appreciation: ${meta.capitalAppreciation}\n` : ''}${meta.totalAssuredReturns ? `- Total Assured Returns: ${meta.totalAssuredReturns}\n` : ''}- Taxation: ${meta.taxation}
- Tenure: ${meta.tenure}
- Fund Size: ${meta.fundSize}

INVESTMENT STRATEGY:
${meta.strategyBullets.map(b => `• ${b}`).join('\n')}

DOCUMENTS PROVIDED:
${meta.documentsProvided.map(d => `• ${d}`).join('\n')}

SECURITY STRUCTURE:
${meta.securityStructure.map(s => `• ${s}`).join('\n')}

Generated for: ${deal.customerName} (Deal #${deal.id})
Date: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
=====================================================`;

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `GHL_AIF_${routeKey.toUpperCase()}_Terms.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Default to Investor Dossier & KYC as primary deal view
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<'dossier' | 'activity' | 'documents'>('dossier');

  const kycStatus = getDealKycStatus(deal, liveKycData);
  const kycBadgeStyles = {
    Verified: { bg: 'rgba(132, 204, 22, 0.14)', color: '#84cc16', border: 'rgba(132, 204, 22, 0.35)' },
    Submitted: { bg: 'rgba(59, 130, 246, 0.12)', color: '#60a5fa', border: 'rgba(59, 130, 246, 0.3)' },
    'Partially Completed': { bg: 'rgba(245, 158, 11, 0.12)', color: '#fbbf24', border: 'rgba(245, 158, 11, 0.3)' },
    Wrong: { bg: 'rgba(220, 38, 38, 0.12)', color: '#ef4444', border: 'rgba(220, 38, 38, 0.3)' },
    Pending: { bg: 'rgba(148, 163, 184, 0.12)', color: '#94a3b8', border: 'rgba(148, 163, 184, 0.25)' },
  }[kycStatus];

  const kycData = liveKycData;
  const isConfirmed = Boolean(deal.investmentAmountConfirmed) && !isEditingAmount;

  const initials = deal.customerName
    ? deal.customerName.trim().split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'IN';

  // Filter activities for this customer
  const fDigits = (deal.phone || liveKycData?.phone || '').replace(/\D/g, '').slice(-10);
  const cleanMail = (deal.email || liveKycData?.email || '').trim().toLowerCase();
  const cleanName = (deal.customerName || liveKycData?.investorName || '').trim().toLowerCase();

  const matchingCalls = calls.filter(c => {
    if (deal.customerId && (String(c.customerId) === String(deal.customerId) || String(c.contactId) === String(deal.customerId))) return true;
    const cDigits = (c.contactPhone || (c as any).phone || '').replace(/\D/g, '').slice(-10);
    if (fDigits && cDigits && cDigits === fDigits) return true;
    if (c.contactName && c.contactName.trim().toLowerCase() === cleanName) return true;
    return false;
  });

  const matchingConsultations = consultations.filter(con => {
    if (deal.customerId && String(con.investorId) === String(deal.customerId)) return true;
    const conDigits = (con.investorPhone || (con as any).phone || '').replace(/\D/g, '').slice(-10);
    if (fDigits && conDigits && conDigits === fDigits) return true;
    if (con.investorName && con.investorName.trim().toLowerCase() === cleanName) return true;
    return false;
  });

  const matchingFollowups = followups.filter(f => {
    if (deal.customerId && String(f.contactId) === String(deal.customerId)) return true;
    const fPhoneDigits = (f.contactPhone || '').replace(/\D/g, '').slice(-10);
    if (fDigits && fPhoneDigits && fPhoneDigits === fDigits) return true;
    if (f.contactName && f.contactName.trim().toLowerCase() === cleanName) return true;
    return false;
  });

  // Calculate uploaded docs count strictly from genuine document URLs
  const panDocUrl = kycData?.panDoc?.url || kycData?.panDocumentUrl;
  const aadhaarDocUrl = kycData?.aadhaarDoc?.url || kycData?.aadhaarDocumentUrl;
  const bankProofDocUrl = kycData?.bankProofDoc?.url || kycData?.bankChequeUrl;
  const dematDocUrl = kycData?.dematDoc?.url || kycData?.dematDocumentUrl;

  const docsCount = [panDocUrl, aadhaarDocUrl, bankProofDocUrl, dematDocUrl].filter(Boolean).length;

  // Primary nominee extraction
  const primaryNominee = Array.isArray(kycData?.nominees) && kycData.nominees.length > 0
    ? kycData.nominees[0]
    : null;
  const nomineeName = primaryNominee?.name || primaryNominee?.nomineeName || kycData?.nomineeName || '';
  const nomineeRelation = primaryNominee?.relationship || primaryNominee?.relation || kycData?.nomineeRelation || '';
  const nomineeDob = primaryNominee?.dateOfBirth || primaryNominee?.dob || kycData?.nomineeDob || null;
  const nomineeShare = primaryNominee?.allocationPercentage ?? primaryNominee?.sharePercentage ?? kycData?.nomineeAllocation ?? null;

  const dealValueNum = Number(deal.value || 0);
  const isUnderMinTicket = dealValueNum > 0 && dealValueNum < activeRouteMeta.minInvestmentNum;

  const formatStageName = (stage?: string) => {
    if (!stage) return 'Investment Opportunity';
    return stage
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  };

  const renderKvValue = (val: string | number | null | undefined, isMono?: boolean, copyKey?: string) => {
    const isValEmpty = val === null || val === undefined || val === '' || val === '—';
    const displayVal = isValEmpty ? '—' : String(val);

    return (
      <span className={`opp-kv-value ${isMono ? 'mono' : ''} ${isValEmpty ? 'is-empty' : ''}`}>
        <span>{displayVal}</span>
        {!isValEmpty && copyKey && (
          <button
            type="button"
            className="opp-kv-copy-btn"
            onClick={() => copyToClipboard(displayVal, copyKey)}
            title="Copy to clipboard"
          >
            {copiedField === copyKey ? <Check size={11} color="#16a34a" /> : <Copy size={11} />}
          </button>
        )}
      </span>
    );
  };

  return (
    <div className={`opp-dealroom-root ${isDark ? 'dark-theme' : 'light-theme'}`}>
      {/* ── 1. Top Executive Deal Room Ribbon (Zero Vertical Waste) ─────────── */}
      <header className="opp-dealroom-ribbon">
        <div className="opp-ribbon-left">
          <button
            type="button"
            className="opp-ribbon-back-btn"
            onClick={onClose}
            title="Return to Investment Opportunities list"
          >
            <ArrowLeft size={14} />
            <span>Opportunities</span>
          </button>
          
          <div className="opp-ribbon-divider" />

          <div className="opp-ribbon-identity">
            <span className="opp-ribbon-code">DEAL #{deal.id}</span>
            <h1 className="opp-ribbon-title">{deal.customerName}</h1>
            {deal.customerId && (
              <span className="opp-ribbon-cid">Cust ID: #{deal.customerId}</span>
            )}
            <button
              type="button"
              className="opp-ribbon-btn-fund-details"
              onClick={() => {
                setFundModalRoute(currentRoute);
                setShowFundModal(true);
              }}
              title="View Fund Details & Route Comparison"
            >
              <FileText size={13} />
              <span>Fund Details & Terms</span>
            </button>
          </div>
        </div>

        <div className="opp-ribbon-right">
          <div className="opp-ribbon-metric">
            <span className="opp-ribbon-metric-label">PIPELINE STAGE</span>
            <span className="opp-ribbon-stage-pill">
              <span className="opp-pulse-beacon" />
              <span className="opp-stage-pill-text">{formatStageName(deal.stage)}</span>
            </span>
          </div>

          <div className="opp-ribbon-metric">
            <span className="opp-ribbon-metric-label">TARGET TRANCHE</span>
            <span className="opp-ribbon-metric-val">{formatCurrency(dealValueNum)}</span>
          </div>

          {deal.phone && (
            <button
              type="button"
              className="opp-ribbon-btn-call"
              onClick={() => onCallInvestor(deal.customerName || 'Investor', deal.phone!, String(deal.id))}
              title="Initiate direct phone consultation"
            >
              <Phone size={13} />
              <span>Call Investor</span>
            </button>
          )}

          <button
            type="button"
            className={`opp-ribbon-btn-convert ${deal.investmentAmountConfirmed ? 'is-pulse' : ''}`}
            disabled={!deal.investmentAmountConfirmed}
            onClick={() => {
              if (deal.investmentAmountConfirmed) {
                onConvertDeal(deal);
              }
            }}
            title={deal.investmentAmountConfirmed ? 'Convert Deal to Active Investor' : 'Confirm investment amount first'}
          >
            <CheckCircle size={14} />
            <span>Convert Deal</span>
          </button>
        </div>
      </header>

      {/* ── 2. Split-Screen Workstation (Left 38% Sticky Rail | Right 62% Workstation) */}
      <div className="opp-dealroom-body">
        {/* ═════════════════════════════════════════════════════════════════════
            LEFT EXECUTION RAIL (Sticky Deal Passport & Action Terminal)
            ═════════════════════════════════════════════════════════════════════ */}
        <aside className="opp-dealroom-rail">
          {/* Rail Card 1: Capital Mandate & Commitment Terminal */}
          <div className="opp-rail-terminal-card">
            <div className="opp-terminal-head">
              <div className="opp-terminal-badge-row">
                <span className="opp-terminal-title">CAPITAL ALLOCATION</span>
                {deal.investmentAmountConfirmed ? (
                  <span className="opp-mandate-confirmed-chip">
                    <CheckCircle2 size={11} /> MANDATE LOCKED
                  </span>
                ) : (
                  <span className="opp-mandate-pending-chip">
                    <Clock size={11} /> PENDING LOCK
                  </span>
                )}
              </div>
            </div>

            {/* ── Investment Route Switcher (Direct AIF vs Debenture) ── */}
            <div className="opp-route-switcher-container">
              <div className="opp-route-switcher-header">
                <span className="opp-route-label">INVESTMENT ROUTE</span>
                <button
                  type="button"
                  className="opp-route-info-btn"
                  onClick={() => {
                    setFundModalRoute(currentRoute);
                    setShowFundModal(true);
                  }}
                  title="View Full Route Details & Terms"
                >
                  <Info size={11} /> View Terms
                </button>
              </div>
              <div className="opp-route-pills-row">
                <button
                  type="button"
                  className={`opp-route-tab-pill ${currentRoute === 'debenture' ? 'active' : ''}`}
                  onClick={() => handleSelectRoute('debenture')}
                >
                  <span className="opp-route-tab-title">Debenture Route</span>
                  <span className="opp-route-tab-sub">Min ₹10L • 1%/mo</span>
                </button>
                <button
                  type="button"
                  className={`opp-route-tab-pill ${currentRoute === 'direct_aif' ? 'active' : ''}`}
                  onClick={() => handleSelectRoute('direct_aif')}
                >
                  <span className="opp-route-tab-title">Direct AIF</span>
                  <span className="opp-route-tab-sub">Min ₹1Cr • Annual</span>
                </button>
              </div>
            </div>

            {/* Minimum Ticket Warning Alert */}
            {isUnderMinTicket && (
              <div className="opp-ticket-warning-box">
                <div className="opp-warning-text">
                  <AlertTriangle size={13} color="#f59e0b" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>
                    {currentRoute === 'direct_aif'
                      ? `Direct AIF minimum is ₹1 Crore (SEBI). For ${formatCurrency(dealValueNum)}, switch to Debenture route.`
                      : `Debenture route minimum investment is ₹10 Lakhs.`}
                  </span>
                </div>
                {currentRoute === 'direct_aif' && dealValueNum < 10000000 && dealValueNum >= 1000000 && (
                  <button
                    type="button"
                    className="opp-switch-route-cta"
                    onClick={() => handleSelectRoute('debenture')}
                  >
                    Switch to Debenture
                  </button>
                )}
              </div>
            )}

            {/* Live Bold Capital Ticker */}
            <div className="opp-terminal-ticker">
              <span className="opp-ticker-symbol">₹</span>
              <span className="opp-ticker-num">
                {dealValueNum > 0 ? dealValueNum.toLocaleString('en-IN') : '0'}
              </span>
            </div>

            {/* Amount Modification Console */}
            {!isEditingAmount ? (
              <div className="opp-ticker-footer">
                <span className="opp-ticker-hint">
                  {deal.investmentAmountConfirmed
                    ? 'Investment amount confirmed'
                    : 'Target investment amount pending confirmation'}
                </span>
                <button
                  type="button"
                  className="opp-terminal-modify-btn"
                  onClick={onEditAmount}
                >
                  <Edit2 size={12} /> Modify Tranche
                </button>
              </div>
            ) : (
              <div className="opp-ticker-editor-box">
                <div className="opp-editor-input-row">
                  <div className="opp-editor-input-group">
                    <span className="opp-input-curr">₹</span>
                    <input
                      type="number"
                      className="opp-editor-input"
                      value={amountInput}
                      onChange={e => onAmountInputChange(e.target.value)}
                      placeholder="e.g. 2500000"
                      autoFocus
                    />
                  </div>
                  <button
                    type="button"
                    className="opp-editor-confirm-btn"
                    onClick={() => onConfirmAmountClick(currentRoute)}
                  >
                    <Check size={13} /> Confirm
                  </button>
                </div>

                <div className="opp-editor-presets">
                  {activeRouteMeta.presets.map(p => (
                    <button
                      key={p.value}
                      type="button"
                      className="opp-preset-pill"
                      onClick={() => onAmountInputChange(String(p.value))}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Huge Conversion Command Button */}
            <button
              type="button"
              className={`opp-rail-convert-cta ${deal.investmentAmountConfirmed ? 'ready' : 'disabled'}`}
              disabled={!deal.investmentAmountConfirmed}
              onClick={() => {
                if (deal.investmentAmountConfirmed) {
                  onConvertDeal(deal);
                }
              }}
            >
              <div className="opp-convert-cta-icon">
                <CheckCircle2 size={18} />
              </div>
              <div className="opp-convert-cta-meta">
                <strong>{deal.investmentAmountConfirmed ? 'Execute Deal Conversion' : 'Confirm Amount to Convert'}</strong>
                <span>{deal.investmentAmountConfirmed ? 'Promote opportunity into active Investor 360' : 'Mandate tranche must be confirmed first'}</span>
              </div>
              <ArrowUpRight size={16} className="opp-cta-arrow" />
            </button>
          </div>

          {/* Rail Card 2: 4-Stage Visual Deal Pipeline Stepper */}
          <div className="opp-rail-pipeline-card">
            <div className="opp-pipeline-card-head">
              <span className="opp-card-section-label">DEAL CONVERSION PROGRESSION</span>
              <span className="opp-card-step-count">Stage 3 of 4</span>
            </div>

            <div className="opp-pipeline-stepper-track">
              {/* Step 1: Discovery & Lead Assignment */}
              <div className="opp-stepper-item completed">
                <div className="opp-stepper-dot">
                  <Check size={11} strokeWidth={3} />
                </div>
                <div className="opp-stepper-content">
                  <div className="opp-stepper-name">1. Lead Discovery</div>
                  <div className="opp-stepper-sub">Owner: {deal.assignedAgentName || 'Unassigned'}</div>
                </div>
              </div>

              {/* Step 2: Compliance & KYC */}
              <div className={`opp-stepper-item ${kycStatus === 'Verified' ? 'completed' : 'active'}`}>
                <div className="opp-stepper-dot">
                  {kycStatus === 'Verified' ? <Check size={11} strokeWidth={3} /> : '2'}
                </div>
                <div className="opp-stepper-content">
                  <div className="opp-stepper-name">2. Investor Compliance (KYC)</div>
                  <div className="opp-stepper-sub" style={{ color: kycBadgeStyles.color }}>
                    {kycStatus} Status
                  </div>
                </div>
              </div>

              {/* Step 3: Capital Mandate Commitment */}
              <div className={`opp-stepper-item ${deal.investmentAmountConfirmed ? 'completed' : 'active'}`}>
                <div className="opp-stepper-dot">
                  {deal.investmentAmountConfirmed ? <Check size={11} strokeWidth={3} /> : '3'}
                </div>
                <div className="opp-stepper-content">
                  <div className="opp-stepper-name">3. Capital Mandate Tranche</div>
                  <div className="opp-stepper-sub" style={{ color: deal.investmentAmountConfirmed ? '#84cc16' : 'inherit' }}>
                    {deal.investmentAmountConfirmed ? `Locked ${formatCurrency(dealValueNum)}` : 'Pending Amount Lock'}
                  </div>
                </div>
              </div>

              {/* Step 4: Final Conversion */}
              <div className="opp-stepper-item future">
                <div className="opp-stepper-dot">4</div>
                <div className="opp-stepper-content">
                  <div className="opp-stepper-name">4. Investor 360 Promotion</div>
                  <div className="opp-stepper-sub">Deal Execution & Onboarding</div>
                </div>
              </div>
            </div>
          </div>

          {/* Rail Card 3: Investor Relationship DNA */}
          <div className="opp-rail-passport-card">
            <div className="opp-passport-head">
              <div className="opp-passport-avatar">
                {initials}
              </div>
              <div className="opp-passport-titles">
                <h3 className="opp-passport-name">{deal.customerName}</h3>
                {((deal as any).assetClass || liveKycData?.investorType) && (
                  <span className="opp-passport-asset">
                    <Building2 size={11} /> {(deal as any).assetClass || liveKycData?.investorType}
                  </span>
                )}
              </div>
            </div>

            <div className="opp-passport-ledger">
              {deal.phone && (
                <div className="opp-passport-row">
                  <span className="opp-ledger-lbl">
                    <Phone size={12} color="#84cc16" /> Phone
                  </span>
                  <span className="opp-ledger-val">{deal.phone}</span>
                  <button
                    type="button"
                    className="opp-ledger-copy"
                    onClick={() => copyToClipboard(deal.phone || '', 'rail_phone')}
                    title="Copy Phone"
                  >
                    {copiedField === 'rail_phone' ? <Check size={11} color="#84cc16" /> : <Copy size={11} />}
                  </button>
                </div>
              )}

              {deal.email && (
                <div className="opp-passport-row">
                  <span className="opp-ledger-lbl">
                    <Mail size={12} color="#ef4444" /> Email
                  </span>
                  <span className="opp-ledger-val">{deal.email}</span>
                  <button
                    type="button"
                    className="opp-ledger-copy"
                    onClick={() => copyToClipboard(deal.email || '', 'rail_email')}
                    title="Copy Email"
                  >
                    {copiedField === 'rail_email' ? <Check size={11} color="#84cc16" /> : <Copy size={11} />}
                  </button>
                </div>
              )}

              <div className="opp-passport-row">
                <span className="opp-ledger-lbl">
                  <User size={12} /> Relationship IRM
                </span>
                <span className="opp-ledger-val">{deal.assignedAgentName || 'Unassigned'}</span>
              </div>

              {kycData?.panNumber && (
                <div className="opp-passport-row">
                  <span className="opp-ledger-lbl">
                    <ShieldCheck size={12} /> PAN Ref
                  </span>
                  <span className="opp-ledger-val mono">{kycData.panNumber}</span>
                  <button
                    type="button"
                    className="opp-ledger-copy"
                    onClick={() => copyToClipboard(kycData.panNumber, 'rail_pan')}
                    title="Copy PAN"
                  >
                    {copiedField === 'rail_pan' ? <Check size={11} color="#84cc16" /> : <Copy size={11} />}
                  </button>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* ═════════════════════════════════════════════════════════════════════
            RIGHT SYNDICATION WORKSTATION (Deep Multi-Module Deal Hub)
           ═════════════════════════════════════════════════════════════════════ */}
        <main className="opp-dealroom-workstation">
          {/* Workstation Top Navigation Tabs */}
          <nav className="opp-workstation-tabs">
            <button
              type="button"
              className={`opp-ws-tab-btn ${activeWorkspaceTab === 'dossier' ? 'active' : ''}`}
              onClick={() => setActiveWorkspaceTab('dossier')}
            >
              <FileText size={14} />
              <span>1. Investor Dossier & KYC</span>
              <span className="opp-ws-tab-counter" style={{ color: kycBadgeStyles.color }}>
                {kycStatus}
              </span>
            </button>

            <button
              type="button"
              className={`opp-ws-tab-btn ${activeWorkspaceTab === 'activity' ? 'active' : ''}`}
              onClick={() => setActiveWorkspaceTab('activity')}
            >
              <PhoneCall size={14} />
              <span>2. Telephony & Activity</span>
              <span className="opp-ws-tab-counter">
                {matchingCalls.length + matchingFollowups.length}
              </span>
            </button>

            <button
              type="button"
              className={`opp-ws-tab-btn ${activeWorkspaceTab === 'documents' ? 'active' : ''}`}
              onClick={() => setActiveWorkspaceTab('documents')}
            >
              <FolderOpen size={14} />
              <span>3. Vault & Legal Binder</span>
              <span className="opp-ws-tab-counter">{docsCount}/4</span>
            </button>
          </nav>

          {/* TAB 2: INVESTOR PROFILE & KYC DOSSIER */}
          {activeWorkspaceTab === 'dossier' && (
            <div className="opp-ws-pane">
              {isKycLoading ? (
                <div className="opp-loading-box">
                  <div className="opp-spinner" />
                  <span>Retrieving verified investor profile from secure store...</span>
                </div>
              ) : !kycData ? (
                <div className="opp-empty-box">
                  No KYC dossier records found for this contact.
                </div>
              ) : (
                <div className="opp-ledger-container">
                  {/* Ledger Section 1: Statutory Identifiers */}
                  <div className="opp-formal-ledger-card">
                    <div className="opp-ledger-card-head">
                      <div className="opp-card-title-group">
                        <ShieldCheck size={16} color="#ef4444" />
                        <h3>1. Statutory & Identity Proofs</h3>
                      </div>
                      <span className="opp-compliance-tag" style={{ color: kycBadgeStyles.color }}>
                        {kycStatus}
                      </span>
                    </div>

                    <div className="opp-ledger-keyval-grid">
                      <div className="opp-kv-item">
                        <span className="opp-kv-label">Full Legal Name</span>
                        {renderKvValue(kycData.investorName || deal.customerName)}
                      </div>
                      <div className="opp-kv-item">
                        <span className="opp-kv-label">PAN Number</span>
                        {renderKvValue(kycData.panNumber, true, 'k_pan')}
                      </div>
                      <div className="opp-kv-item">
                        <span className="opp-kv-label">Aadhaar Number</span>
                        {renderKvValue(kycData.aadhaarNumber, true)}
                      </div>
                      <div className="opp-kv-item">
                        <span className="opp-kv-label">Date of Birth</span>
                        {renderKvValue(formatDate(kycData.dateOfBirth))}
                      </div>
                      <div className="opp-kv-item">
                        <span className="opp-kv-label">Gender</span>
                        {renderKvValue(kycData.gender)}
                      </div>
                      <div className="opp-kv-item">
                        <span className="opp-kv-label">Residential Status</span>
                        {renderKvValue(kycData.residentType)}
                      </div>
                    </div>
                  </div>

                  {/* Ledger Section 2: Banking & Settlement Ledger */}
                  <div className="opp-formal-ledger-card">
                    <div className="opp-ledger-card-head">
                      <div className="opp-card-title-group">
                        <Landmark size={16} color="#16a34a" />
                        <h3>2. Banking & Settlement Accounts</h3>
                      </div>
                      {kycData.accountType && (
                        <span className="opp-meta-pill">{kycData.accountType}</span>
                      )}
                    </div>

                    <div className="opp-ledger-keyval-grid">
                      <div className="opp-kv-item">
                        <span className="opp-kv-label">Bank Name</span>
                        {renderKvValue(kycData.bankName)}
                      </div>
                      <div className="opp-kv-item">
                        <span className="opp-kv-label">Account Number</span>
                        {renderKvValue(kycData.accountNumber, true, 'k_acc')}
                      </div>
                      <div className="opp-kv-item">
                        <span className="opp-kv-label">IFSC Code</span>
                        {renderKvValue(kycData.ifscCode, true, 'k_ifsc')}
                      </div>
                      <div className="opp-kv-item">
                        <span className="opp-kv-label">Demat Account Number</span>
                        {renderKvValue(kycData.dematAccountNumber, true, 'k_demat')}
                      </div>
                      <div className="opp-kv-item">
                        <span className="opp-kv-label">DP Name</span>
                        {renderKvValue(kycData.dematDepository || kycData.dpName || kycData.dpId)}
                      </div>
                      <div className="opp-kv-item">
                        <span className="opp-kv-label">Account Type</span>
                        {renderKvValue(kycData.accountType)}
                      </div>
                    </div>
                  </div>

                  {/* Ledger Section 3: Nominee & Legal Heirs */}
                  <div className="opp-formal-ledger-card">
                    <div className="opp-ledger-card-head">
                      <div className="opp-card-title-group">
                        <Users size={16} color="#ef4444" />
                        <h3>3. Nominee & Succession Details</h3>
                      </div>
                      {nomineeShare != null && (
                        <span className="opp-meta-pill">{nomineeShare}% Allocation</span>
                      )}
                    </div>

                    {!nomineeName ? (
                      <div className="opp-dossier-empty-note">
                        <Users size={15} color="#94a3b8" />
                        <span>No nominee registered in investor KYC dossier.</span>
                      </div>
                    ) : (
                      <div className="opp-ledger-keyval-grid">
                        <div className="opp-kv-item">
                          <span className="opp-kv-label">Nominee Name</span>
                          {renderKvValue(nomineeName)}
                        </div>
                        <div className="opp-kv-item">
                          <span className="opp-kv-label">Relationship with Investor</span>
                          {renderKvValue(nomineeRelation)}
                        </div>
                        <div className="opp-kv-item">
                          <span className="opp-kv-label">Nominee Date of Birth</span>
                          {renderKvValue(formatDate(nomineeDob))}
                        </div>
                        <div className="opp-kv-item">
                          <span className="opp-kv-label">Nominee Allocation Share</span>
                          {renderKvValue(nomineeShare != null ? `${nomineeShare}%` : '100%')}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Ledger Section 4: Registered Address */}
                  <div className="opp-formal-ledger-card">
                    <div className="opp-ledger-card-head">
                      <div className="opp-card-title-group">
                        <Building2 size={16} color="#16a34a" />
                        <h3>4. Permanent Communication Address</h3>
                      </div>
                    </div>

                    {(!kycData.address && !kycData.city && !kycData.state && !kycData.pincode) ? (
                      <div className="opp-dossier-empty-note">
                        <Building2 size={15} color="#94a3b8" />
                        <span>No registered communication address on file.</span>
                      </div>
                    ) : (
                      <div className="opp-ledger-keyval-grid">
                        <div className="opp-kv-item" style={{ gridColumn: 'span 2' }}>
                          <span className="opp-kv-label">Full Residential Address</span>
                          {renderKvValue(kycData.address || kycData.addressLine)}
                        </div>
                        <div className="opp-kv-item">
                          <span className="opp-kv-label">City</span>
                          {renderKvValue(kycData.city)}
                        </div>
                        <div className="opp-kv-item">
                          <span className="opp-kv-label">State / Province</span>
                          {renderKvValue(kycData.state)}
                        </div>
                        <div className="opp-kv-item">
                          <span className="opp-kv-label">PIN Code</span>
                          {renderKvValue(kycData.pincode, true)}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bottom Deal Room Ready Action */}
                  <div className="opp-termsheet-bottom-cta">
                    <div>
                      <h4 className="opp-ts-cta-title">Ready to Promote Deal to Converted Investor?</h4>
                      <p className="opp-ts-cta-desc">
                        Executing this will advance {deal.customerName} into active Investor 360 portfolio management.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="opp-termsheet-cta-btn"
                      disabled={!deal.investmentAmountConfirmed}
                      onClick={() => {
                        if (deal.investmentAmountConfirmed) {
                          onConvertDeal(deal);
                        }
                      }}
                    >
                      <CheckCircle size={15} />
                      <span>Convert Deal to Investor 360</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: TELEPHONY & ACTIVITY STREAM */}
          {activeWorkspaceTab === 'activity' && (
            <div className="opp-ws-pane">
              <div className="opp-activity-stream">
                <div className="opp-stream-head">
                  <div>
                    <h3 className="opp-stream-title">Telephony History & Deal Interactions</h3>
                    <p className="opp-stream-sub">
                      Recorded consultations, phone touchpoints and follow-up activities
                    </p>
                  </div>
                  {deal.phone && (
                    <button
                      type="button"
                      className="opp-ribbon-btn-call"
                      onClick={() => onCallInvestor(deal.customerName || 'Investor', deal.phone!, String(deal.id))}
                    >
                      <Phone size={13} />
                      <span>Dial Investor</span>
                    </button>
                  )}
                </div>

                {matchingCalls.length === 0 && matchingFollowups.length === 0 ? (
                  <div className="opp-empty-box">
                    No phone consultations or follow-up notes logged yet for this deal.
                  </div>
                ) : (
                  <div className="opp-stream-list">
                    {matchingCalls.map(c => (
                      <div key={c.id} className="opp-stream-item">
                        <div className="opp-stream-icon-box call">
                          <Phone size={14} color="#84cc16" />
                        </div>
                        <div className="opp-stream-body">
                          <div className="opp-stream-item-top">
                            <span className="opp-stream-action-name">
                              Outbound Telephony Consult ({c.disposition || c.callStatus || (c as any).status || 'Completed'})
                            </span>
                            <span className="opp-stream-time">{formatDate(c.timestamp || (c as any).createdAt)}</span>
                          </div>
                          <div className="opp-stream-notes">
                            {c.notes ? c.notes : <span style={{ opacity: 0.6, fontStyle: 'italic' }}>No call notes recorded</span>}
                          </div>
                          <div className="opp-stream-meta-row">
                            <span className="opp-stream-meta-chip">
                              Duration: {formatDuration(c.duration)}
                            </span>
                            <span className="opp-stream-meta-chip">
                              Agent: {c.agentName || (c as any).callerName || deal.assignedAgentName || 'Unassigned'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}

                    {matchingFollowups.map(f => (
                      <div key={f.id} className="opp-stream-item">
                        <div className="opp-stream-icon-box note">
                          <Calendar size={14} color="#ef4444" />
                        </div>
                        <div className="opp-stream-body">
                          <div className="opp-stream-item-top">
                            <span className="opp-stream-action-name">
                              Scheduled Follow-up: {(f as any).title || (f.followupType ? f.followupType.toUpperCase() : 'General Follow-up')}
                            </span>
                            <span className="opp-stream-time">{formatDate(f.scheduledAt || (f as any).createdAt)}</span>
                          </div>
                          <div className="opp-stream-notes">
                            {f.notes ? f.notes : <span style={{ opacity: 0.6, fontStyle: 'italic' }}>No notes provided</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: VAULT & LEGAL BINDER */}
          {activeWorkspaceTab === 'documents' && (
            <div className="opp-ws-pane">
              <div className="opp-vault-deck">
                <div className="opp-vault-head-box">
                  <div>
                    <h3 className="opp-vault-title">Compliance Document Vault</h3>
                    <p className="opp-vault-desc">
                      Verified statutory identity cards, banking proofs, and private syndication binders.
                    </p>
                  </div>
                  <span className="opp-vault-verified-tag">
                    <ShieldCheck size={14} color="#84cc16" />
                    <span>{docsCount} of 4 Documents Uploaded</span>
                  </span>
                </div>

                <div className="opp-vault-grid-list">
                  {/* PAN Proof */}
                  <div className="opp-vault-item-card">
                    <div className="opp-vault-item-top">
                      <div className="opp-vault-ico red">
                        <FileText size={16} />
                      </div>
                      <div>
                        <h4 className="opp-vault-doc-title">Permanent Account Number (PAN)</h4>
                        <span className="opp-vault-doc-sub">Statutory Tax Identification</span>
                      </div>
                    </div>
                    <div className="opp-vault-item-bottom">
                      {panDocUrl ? (
                        <>
                          <span className="opp-vault-status-pill verified">
                            <Check size={11} /> Uploaded
                          </span>
                          <a href={panDocUrl} target="_blank" rel="noopener noreferrer" className="opp-vault-link">
                            <Download size={12} /> View File
                          </a>
                        </>
                      ) : (
                        <>
                          <span className="opp-vault-status-pill pending">
                            <Clock size={11} /> Not Uploaded
                          </span>
                          <span className="opp-vault-no-file">No document attached</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Aadhaar Proof */}
                  <div className="opp-vault-item-card">
                    <div className="opp-vault-item-top">
                      <div className="opp-vault-ico green">
                        <FileCheck size={16} />
                      </div>
                      <div>
                        <h4 className="opp-vault-doc-title">Aadhaar Identity Card</h4>
                        <span className="opp-vault-doc-sub">UIDAI Identity & Address Proof</span>
                      </div>
                    </div>
                    <div className="opp-vault-item-bottom">
                      {aadhaarDocUrl ? (
                        <>
                          <span className="opp-vault-status-pill verified">
                            <Check size={11} /> Uploaded
                          </span>
                          <a href={aadhaarDocUrl} target="_blank" rel="noopener noreferrer" className="opp-vault-link">
                            <Download size={12} /> View File
                          </a>
                        </>
                      ) : (
                        <>
                          <span className="opp-vault-status-pill pending">
                            <Clock size={11} /> Not Uploaded
                          </span>
                          <span className="opp-vault-no-file">No document attached</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Bank Proof */}
                  <div className="opp-vault-item-card">
                    <div className="opp-vault-item-top">
                      <div className="opp-vault-ico green">
                        <Landmark size={16} />
                      </div>
                      <div>
                        <h4 className="opp-vault-doc-title">Bank Statement / Passbook</h4>
                        <span className="opp-vault-doc-sub">Settlement Bank Verification</span>
                      </div>
                    </div>
                    <div className="opp-vault-item-bottom">
                      {bankProofDocUrl ? (
                        <>
                          <span className="opp-vault-status-pill verified">
                            <Check size={11} /> Uploaded
                          </span>
                          <a href={bankProofDocUrl} target="_blank" rel="noopener noreferrer" className="opp-vault-link">
                            <Download size={12} /> View File
                          </a>
                        </>
                      ) : (
                        <>
                          <span className="opp-vault-status-pill pending">
                            <Clock size={11} /> Not Uploaded
                          </span>
                          <span className="opp-vault-no-file">No document attached</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Demat Client Master */}
                  <div className="opp-vault-item-card">
                    <div className="opp-vault-item-top">
                      <div className="opp-vault-ico red">
                        <Briefcase size={16} />
                      </div>
                      <div>
                        <h4 className="opp-vault-doc-title">Demat / CML Statement</h4>
                        <span className="opp-vault-doc-sub">Securities Depository Record</span>
                      </div>
                    </div>
                    <div className="opp-vault-item-bottom">
                      {dematDocUrl ? (
                        <>
                          <span className="opp-vault-status-pill verified">
                            <Check size={11} /> Uploaded
                          </span>
                          <a href={dematDocUrl} target="_blank" rel="noopener noreferrer" className="opp-vault-link">
                            <Download size={12} /> View File
                          </a>
                        </>
                      ) : (
                        <>
                          <span className="opp-vault-status-pill pending">
                            <Clock size={11} /> Not Uploaded
                          </span>
                          <span className="opp-vault-no-file">No document attached</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Route-Specific Legal Binders & Scheme Documents */}
                <div style={{ marginTop: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                        {activeRouteMeta.name} — Scheme Documents & Binders
                      </h4>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        Statutory investment execution paperwork for {activeRouteMeta.fundType}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="opp-vault-link"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      onClick={() => handleDownloadTerms(currentRoute)}
                    >
                      <Download size={13} /> Download Route Terms
                    </button>
                  </div>

                  <div className="opp-vault-grid-list">
                    {activeRouteMeta.documentsProvided.map((docName, idx) => (
                      <div key={idx} className="opp-vault-item-card">
                        <div className="opp-vault-item-top">
                          <div className="opp-vault-ico red">
                            <FileText size={16} />
                          </div>
                          <div>
                            <h4 className="opp-vault-doc-title">{docName}</h4>
                            <span className="opp-vault-doc-sub">{currentRoute === 'debenture' ? 'NCD / Debenture Route' : 'Direct AIF Scheme'}</span>
                          </div>
                        </div>
                        <div className="opp-vault-item-bottom">
                          <span className="opp-vault-status-pill scheduled">
                            <Clock size={11} /> Prepared on Allocation
                          </span>
                          <button
                            type="button"
                            className="opp-vault-link"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                            onClick={() => handleDownloadTerms(currentRoute)}
                          >
                            <Download size={12} /> View Terms
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── 3. Fund Details & Terms Modal (Matching GHL screenshots) ── */}
      {showFundModal && (
        <div className="opp-fund-modal-overlay" onClick={() => setShowFundModal(false)}>
          <div className={`opp-fund-modal-dialog ${isDark ? 'dark-theme' : 'light-theme'}`} onClick={e => e.stopPropagation()}>
            <div className="opp-fund-modal-head">
              <h2 className="opp-fund-modal-title">
                <FileText size={18} color="#9b1c24" />
                <span>GHL India Ventures — Fund Terms & Investment Schemes</span>
              </h2>
              <button
                type="button"
                className="opp-fund-modal-close"
                onClick={() => setShowFundModal(false)}
                title="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <div className="opp-fund-modal-body">
              {/* Route Selector Pills */}
              <div className="opp-modal-route-bar">
                <button
                  type="button"
                  className={`opp-modal-route-btn ${fundModalRoute === 'debenture' ? 'active' : ''}`}
                  onClick={() => setFundModalRoute('debenture')}
                >
                  Alternate route to Invest in AIF via Debenture
                </button>
                <button
                  type="button"
                  className={`opp-modal-route-btn ${fundModalRoute === 'direct_aif' ? 'active' : ''}`}
                  onClick={() => setFundModalRoute('direct_aif')}
                >
                  Direct AIF Route
                </button>
              </div>

              {/* Scheme Sheet Content */}
              {(() => {
                const modalMeta = INVESTMENT_ROUTES[fundModalRoute];
                return (
                  <div className="opp-fund-sheet-box">
                    <div className="opp-fund-sheet-top">
                      <div>
                        <h3 className="opp-sheet-title">{modalMeta.name}</h3>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {modalMeta.fundType}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="opp-btn-download-terms"
                        onClick={() => handleDownloadTerms(fundModalRoute)}
                        title="Download structured terms sheet"
                      >
                        <Download size={14} />
                        <span>Download Terms</span>
                      </button>
                    </div>

                    <div className="opp-fund-two-col">
                      {/* Left: Key Terms Table */}
                      <div>
                        <table className="opp-fund-table">
                          <tbody>
                            <tr>
                              <td className="opp-td-label">Focus</td>
                              <td className="opp-td-val">{modalMeta.focus}</td>
                            </tr>
                            <tr>
                              <td colSpan={2} style={{ padding: '12px 8px 4px 8px' }}>
                                <div className="opp-section-subhead">Key Investment Terms</div>
                              </td>
                            </tr>
                            <tr>
                              <td className="opp-td-label">Minimum Investment</td>
                              <td className="opp-td-val" style={{ fontWeight: 700, color: '#9b1c24' }}>
                                {modalMeta.minInvestmentLabel}
                              </td>
                            </tr>
                            <tr>
                              <td className="opp-td-label">Target Returns</td>
                              <td className="opp-td-val" style={{ fontWeight: 700 }}>
                                {modalMeta.targetReturns}
                              </td>
                            </tr>
                            <tr>
                              <td className="opp-td-label">Return Structure</td>
                              <td className="opp-td-val">{modalMeta.returnStructure}</td>
                            </tr>
                            {modalMeta.capitalAppreciation && (
                              <tr>
                                <td className="opp-td-label">Capital Appreciation</td>
                                <td className="opp-td-val">{modalMeta.capitalAppreciation}</td>
                              </tr>
                            )}
                            {modalMeta.totalAssuredReturns && (
                              <tr>
                                <td className="opp-td-label">Total Assured Returns</td>
                                <td className="opp-td-val" style={{ fontWeight: 700, color: '#16a34a' }}>
                                  {modalMeta.totalAssuredReturns}
                                </td>
                              </tr>
                            )}
                            <tr>
                              <td className="opp-td-label">Payout Frequency</td>
                              <td className="opp-td-val">{modalMeta.payoutFrequency}</td>
                            </tr>
                            <tr>
                              <td className="opp-td-label">Taxation</td>
                              <td className="opp-td-val">{modalMeta.taxation}</td>
                            </tr>
                            <tr>
                              <td className="opp-td-label">Tenure</td>
                              <td className="opp-td-val">{modalMeta.tenure}</td>
                            </tr>
                            <tr>
                              <td className="opp-td-label">Fund Size</td>
                              <td className="opp-td-val">{modalMeta.fundSize}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Right: Strategy, Documents & Security */}
                      <div className="opp-fund-col-right">
                        <div>
                          <h4 className="opp-right-block-title">Investment Strategy</h4>
                          <ul className="opp-bullet-list">
                            {modalMeta.strategyBullets.map((bullet, idx) => (
                              <li key={idx}>{bullet}</li>
                            ))}
                          </ul>
                        </div>

                        <div>
                          <h4 className="opp-right-block-title">Documents Provided</h4>
                          <ul className="opp-bullet-list">
                            {modalMeta.documentsProvided.map((doc, idx) => (
                              <li key={idx}>{doc}</li>
                            ))}
                          </ul>
                        </div>

                        <div>
                          <h4 className="opp-right-block-title">Security & Governance Structure</h4>
                          <ul className="opp-bullet-list">
                            {modalMeta.securityStructure.map((sec, idx) => (
                              <li key={idx}>{sec}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="opp-fund-modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowFundModal(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="opp-modal-apply-btn"
                onClick={() => {
                  handleSelectRoute(fundModalRoute);
                  setShowFundModal(false);
                }}
              >
                <Check size={14} />
                <span>Apply This Route to Deal ({INVESTMENT_ROUTES[fundModalRoute].name})</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
