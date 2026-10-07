import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  Clock,
  PhoneCall,
  TrendingUp,
  Calendar,
  AlertCircle,
  ArrowUpRight,
  Phone,
  Plus,
  Briefcase,
  FileCheck,
  FolderArchive,
  Shield,
  RefreshCw,
  CheckCircle2,
  DollarSign,
  ArrowRight,
  Layers,
  PhoneIncoming,
  CalendarCheck
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useCall } from '../../../context/CallContext';
import {
  getLeads,
  getDeals,
  getCalls,
  getFollowups,
  getConsultations,
  getInvestors,
  getOpportunities,
  getIrmOtherRecords,
} from '../../../services/ghlApiService';
import { apiUrl } from '../../../utils/apiUrl';
import { getAuthHeaders } from '../../../utils/authHeaders';
import {
  Lead,
  Deal,
  CallRecord,
  Followup,
  Consultation,
  Investor,
  InvestmentOpportunity,
  IrmOtherRecord,
} from '../../../types';
import { StatusChip } from '../../../components/common/StatusChip';
import './IrmDashboardView.css';

interface IrmDashboardViewProps {
  onNavigate: (route: string) => void;
  onOpenQuickCreate: (type: 'lead' | 'followup' | 'deal' | 'visit' | 'consultation') => void;
}

export const IrmDashboardView: React.FC<IrmDashboardViewProps> = ({
  onNavigate,
  onOpenQuickCreate,
}) => {
  const { user, tenant } = useAuth();
  const { initiateCall } = useCall();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [opportunities, setOpportunities] = useState<InvestmentOpportunity[]>([]);
  const [kycs, setKycs] = useState<any[]>([]);
  const [otherRecords, setOtherRecords] = useState<IrmOtherRecord[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [scheduleTab, setScheduleTab] = useState<'followups' | 'consultations'>('followups');

  // ── Currency Formatter ───────────────────────────────────────────────────────
  const formatCurrency = (val: number) => {
    if (!val || isNaN(val)) return '₹0';
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    return `₹${val.toLocaleString('en-IN')}`;
  };

  // ── Number parser for currency strings (e.g. "2 Cr", "50 L", "20000000") ─────
  const parseAumToNumber = (val?: string | number): number => {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    const clean = String(val).replace(/₹|,|\s/g, '').trim();
    if (!clean) return 0;
    if (clean.toLowerCase().includes('cr') || clean.toLowerCase().includes('crore')) {
      const num = parseFloat(clean);
      return isNaN(num) ? 0 : num * 10000000;
    }
    if (clean.toLowerCase().includes('l') || clean.toLowerCase().includes('lakh') || clean.toLowerCase().includes('lac')) {
      const num = parseFloat(clean);
      return isNaN(num) ? 0 : num * 100000;
    }
    if (clean.toLowerCase().includes('k')) {
      const num = parseFloat(clean);
      return isNaN(num) ? 0 : num * 1000;
    }
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  };

  // ── Live Data Loading ────────────────────────────────────────────────────────
  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const [l, d, c, f, con, inv, opp, oth] = await Promise.allSettled([
        getLeads(tenant?.id),
        getDeals(tenant?.id),
        getCalls(tenant?.id),
        getFollowups(tenant?.id),
        getConsultations(tenant?.id),
        getInvestors(tenant?.id),
        getOpportunities(tenant?.id),
        getIrmOtherRecords(),
      ]);

      const getVal = <T,>(res: PromiseSettledResult<T>, fb: T): T =>
        res.status === 'fulfilled' ? res.value : fb;

      setLeads(getVal(l, []));
      setDeals(getVal(d, []));
      setCalls(getVal(c, []));
      setFollowups(getVal(f, []));
      setConsultations(getVal(con, []));
      setInvestors(getVal(inv, []));
      setOpportunities(getVal(opp, []));
      setOtherRecords(getVal(oth, []));

      // Fetch live KYC records from backend
      try {
        const kycRes = await fetch(apiUrl('/irm/kyc/all'), {
          headers: getAuthHeaders(),
        });
        if (kycRes.ok) {
          const kycJson = await kycRes.json();
          if (kycJson?.success && Array.isArray(kycJson.data)) {
            setKycs(kycJson.data);
          } else if (Array.isArray(kycJson)) {
            setKycs(kycJson);
          }
        }
      } catch (err) {
        console.error('[IrmDashboardView] Failed to fetch KYC records:', err);
      }
    } catch (err) {
      console.error('[IrmDashboardView] Error loading dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tenant?.id]);

  useEffect(() => {
    loadData();

    const handleUpdate = () => loadData(true);
    window.addEventListener('nexus_storage_updated', handleUpdate);
    window.addEventListener('nexus_call_logged', handleUpdate);

    return () => {
      window.removeEventListener('nexus_storage_updated', handleUpdate);
      window.removeEventListener('nexus_call_logged', handleUpdate);
    };
  }, [loadData]);

  // ── Role Scoping Helper ──────────────────────────────────────────────────────
  const isMine = useCallback((id?: string | number, name?: string) => {
    if (!user) return false;
    if (id && String(id) === String(user.id)) return true;
    if (name && user.name && name.trim().toLowerCase() === user.name.trim().toLowerCase()) return true;
    return false;
  }, [user]);

  // Scoped datasets for the logged-in IRM
  const scopedLeads = useMemo(() => leads.filter(l => isMine(l.assignedAgentId, l.assignedAgentName)), [leads, isMine]);
  const scopedInvestors = useMemo(() => investors.filter(i => isMine(i.assignedAgentId, i.assignedAgentName)), [investors, isMine]);
  const scopedOpportunities = useMemo(() => opportunities.filter(o => isMine(o.assignedAgentId, o.assignedAgentName)), [opportunities, isMine]);
  const scopedFollowups = useMemo(() => followups.filter(f => isMine(f.assignedAgentId, f.assignedAgentName)), [followups, isMine]);
  const scopedConsultations = useMemo(() => consultations.filter(c => isMine(c.consultantId, c.consultantName)), [consultations, isMine]);
  const scopedCalls = useMemo(() => calls.filter(c => isMine(c.agentId, c.agentName)), [calls, isMine]);
  const scopedOther = useMemo(() => otherRecords.filter(o => isMine(o.agentId, o.agentName)), [otherRecords, isMine]);

  // KYC pipeline deals (matching KYCPage stage === 'qualified_investor')
  const qualifiedKycDeals = useMemo(() => {
    return deals.filter(d => d.stage === 'qualified_investor' && isMine(d.assignedAgentId, d.assignedAgentName));
  }, [deals, isMine]);

  const scopedKycs = useMemo(() => {
    return kycs.filter(k => {
      if (k.irmId && String(k.irmId) === String(user?.id)) return true;
      const matchesInv = scopedInvestors.some(i => String(i.id) === String(k.investorId) || (i.phone && i.phone === k.phone));
      if (matchesInv) return true;
      const matchesLead = scopedLeads.some(l => (l.phone && l.phone === k.phone) || (l.email && l.email === k.email));
      return matchesLead;
    });
  }, [kycs, user?.id, scopedInvestors, scopedLeads]);

  // ── Calculated Metrics ───────────────────────────────────────────────────────
  // AUM Calculation — Includes Opportunities, Converted Deals, and Investor 360 inputs
  const wonOpps = useMemo(() => {
    return scopedOpportunities.filter(o => o.stage === 'Committed' || o.stage === 'Closed Won');
  }, [scopedOpportunities]);

  const totalCommittedAUM = useMemo(() => {
    const oppAum = wonOpps.reduce((s, o) => s + (Number(o.committedAmount) || 0), 0);

    // Converted / Won deals scoped to this IRM
    const dealAum = deals
      .filter(d => (d.stage === 'converted' || d.stage === 'won' || d.stage === 'investment_opportunity') && isMine(d.assignedAgentId, d.assignedAgentName))
      .reduce((s, d) => s + (Number(d.value) || 0), 0);

    // Investors in Investor 360 with entered amount or matching deal value
    const invAum = scopedInvestors.reduce((s, inv) => {
      const fDigits = (inv.phone || '').replace(/\D/g, '').slice(-10);
      const match = deals.find(d => {
        if (d.customerId && String(d.customerId) === String(inv.id)) return true;
        const dDigits = (d.phone || '').replace(/\D/g, '').slice(-10);
        return fDigits && dDigits && dDigits === fDigits;
      });
      const dealVal = match?.value ? Number(match.value) : 0;
      const parsedInv = parseAumToNumber(inv.committedAUM || inv.investmentCapacity);
      return s + Math.max(dealVal, parsedInv);
    }, 0);

    return Math.max(oppAum, dealAum, invAum);
  }, [wonOpps, deals, scopedInvestors, isMine]);

  const targetAum = Number((user as any)?.targetAum) || 25000000; // 2.5 Cr
  const aumProgress = Math.min(Math.round((totalCommittedAUM / targetAum) * 100), 100);

  // KYC Metrics — Synced with KYC Page UI (deals at stage qualified_investor)
  const totalKycTargetCount = qualifiedKycDeals.length > 0 ? qualifiedKycDeals.length : (scopedKycs.length || 0);

  const verifiedKycs = useMemo(() => {
    const verifiedDbIds = new Set(
      scopedKycs
        .filter(k => (k.status || '').toLowerCase() === 'verified' || (k.status || '').toLowerCase() === 'approved')
        .map(k => String(k.investorId || k.id))
    );
    const verifiedDeals = qualifiedKycDeals.filter(d => {
      const status = ((d as any).kycStatus || (d as any).customerKycStatus || '').toLowerCase();
      return status === 'verified' || status === 'approved' || verifiedDbIds.has(String(d.customerId || d.id));
    });
    return verifiedDeals.length > 0 ? verifiedDeals : scopedKycs.filter(k => (k.status || '').toLowerCase() === 'verified');
  }, [scopedKycs, qualifiedKycDeals]);

  const inReviewKycs = useMemo(() => {
    return scopedKycs.filter(k => {
      const s = (k.status || '').toLowerCase();
      return s === 'in_review' || s === 'under_review' || s === 'in-review' || s === 'submitted';
    });
  }, [scopedKycs]);

  const kycClearanceRate = totalKycTargetCount > 0
    ? Math.round((verifiedKycs.length / totalKycTargetCount) * 100)
    : 100;

  // Active Opportunities
  const activeOpportunities = useMemo(() => {
    return scopedOpportunities.filter(o => o.stage !== 'Closed Lost');
  }, [scopedOpportunities]);

  const totalPipelineCorpus = useMemo(() => {
    return activeOpportunities.reduce((s, o) => s + (Number(o.targetAmount) || 0), 0);
  }, [activeOpportunities]);

  // Follow-ups
  const pendingFollowups = useMemo(() => {
    return scopedFollowups.filter(f => f.status === 'Pending');
  }, [scopedFollowups]);

  const overdueFollowups = useMemo(() => {
    return pendingFollowups.filter(f => {
      const sch = (f.scheduledAt || '').toLowerCase();
      return sch.includes('yesterday') || sch.includes('overdue');
    });
  }, [pendingFollowups]);

  // Today's Follow-ups
  const todaysFollowups = useMemo(() => {
    return pendingFollowups.filter(f => {
      const sch = (f.scheduledAt || '').toLowerCase();
      return sch.includes('today') || !sch.includes('yesterday');
    });
  }, [pendingFollowups]);

  // Client Tiers
  const tier1Count = useMemo(() => {
    return scopedInvestors.filter(inv => {
      const parsed = parseAumToNumber(inv.investmentCapacity || inv.committedAUM);
      return parsed >= 10000000; // >= 1 Cr
    }).length;
  }, [scopedInvestors]);

  // Seven days delta
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const newInvestorsThisWeek = useMemo(() => {
    return scopedInvestors.filter(i => {
      if (!i.createdAt) return false;
      const d = new Date(i.createdAt);
      return !isNaN(d.getTime()) && d.getTime() >= sevenDaysAgo;
    }).length;
  }, [scopedInvestors, sevenDaysAgo]);

  return (
    <div className="irm-dashboard-container">
      {/* ── Advisor Welcome Banner ── */}
      <div className="card irm-dashboard-banner">
        <div className="irm-banner-left">
          <div className="irm-banner-badge">
            <Shield size={12} />
            <span>INVESTOR RELATIONSHIP MANAGER DESK</span>
          </div>
          <h1 className="irm-banner-title">
            Welcome back, {user?.name?.split(' ')[0] || user?.name || 'Advisor'} 👋
          </h1>
          <p className="irm-banner-subtitle">
            You have <strong>{pendingFollowups.length} follow-ups</strong> scheduled and{' '}
            <strong>{totalKycTargetCount - verifiedKycs.length} investor KYC cases</strong> awaiting compliance verification.
          </p>
        </div>

        <div className="irm-banner-actions">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => loadData(true)}
            title="Refresh dashboard metrics"
            disabled={refreshing}
          >
            <RefreshCw size={13} className={refreshing ? 'irm-spin' : ''} />
            <span>{refreshing ? 'Syncing...' : 'Refresh'}</span>
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => onOpenQuickCreate('followup')}
          >
            <Calendar size={13} /> Log Follow-up
          </button>

          <button
            className="btn btn-primary btn-sm"
            onClick={() => onNavigate('kyc')}
          >
            <FileCheck size={13} /> Verify KYC
          </button>
        </div>
      </div>

      {/* ── Top 5 Wealth KPI Metric Cards ── */}
      <div className="irm-dashboard-kpi-grid">
        {/* Card 1: Committed Capital (AUM) */}
        <div
          className="card card-hover irm-kpi-card aum"
          onClick={() => onNavigate('investors')}
          title="Click to view Investor 360 portfolio"
        >
          <div className="irm-kpi-header">
            <span className="irm-kpi-label">COMMITTED CAPITAL (AUM)</span>
            <div className="irm-kpi-icon aum"><DollarSign size={16} /></div>
          </div>
          <div className="irm-kpi-val">{formatCurrency(totalCommittedAUM)}</div>
          <div className="irm-kpi-progress-track">
            <div className="irm-kpi-progress-fill aum" style={{ width: `${aumProgress}%` }} />
          </div>
          <div className="irm-kpi-sub positive">
            <ArrowUpRight size={13} /> {aumProgress}% of {formatCurrency(targetAum)} target
          </div>
        </div>

        {/* Card 2: KYC Qualified Pipeline */}
        <div
          className="card card-hover irm-kpi-card kyc"
          onClick={() => onNavigate('kyc')}
          title="Click to view KYC module"
        >
          <div className="irm-kpi-header">
            <span className="irm-kpi-label">KYC QUALIFIED INVESTORS</span>
            <div className="irm-kpi-icon kyc"><FileCheck size={16} /></div>
          </div>
          <div className="irm-kpi-val">
            {verifiedKycs.length} <span className="irm-kpi-sub-num">/ {totalKycTargetCount}</span>
          </div>
          <div className="irm-kpi-progress-track">
            <div className="irm-kpi-progress-fill kyc" style={{ width: `${kycClearanceRate}%` }} />
          </div>
          <div className="irm-kpi-sub" style={{ color: '#8b5cf6' }}>
            <CheckCircle2 size={13} /> {kycClearanceRate}% clearance ({inReviewKycs.length} in review)
          </div>
        </div>

        {/* Card 3: Active Deal Pipeline */}
        <div
          className="card card-hover irm-kpi-card deals"
          onClick={() => onNavigate('opportunities')}
          title="Click to view Opportunities"
        >
          <div className="irm-kpi-header">
            <span className="irm-kpi-label">DEAL PIPELINE</span>
            <div className="irm-kpi-icon deals"><Briefcase size={16} /></div>
          </div>
          <div className="irm-kpi-val">{activeOpportunities.length}</div>
          <div className="irm-kpi-progress-track">
            <div className="irm-kpi-progress-fill deals" style={{ width: '75%' }} />
          </div>
          <div className="irm-kpi-sub" style={{ color: '#0284c7' }}>
            <TrendingUp size={13} /> Corpus: {formatCurrency(totalPipelineCorpus)}
          </div>
        </div>

        {/* Card 4: Actionable Follow-ups */}
        <div
          className="card card-hover irm-kpi-card followups"
          onClick={() => onNavigate('followups')}
          title="Click to view Follow-ups"
        >
          <div className="irm-kpi-header">
            <span className="irm-kpi-label">DUE FOLLOW-UPS</span>
            <div className="irm-kpi-icon followups"><Clock size={16} /></div>
          </div>
          <div className="irm-kpi-val">{pendingFollowups.length}</div>
          <div className="irm-kpi-progress-track">
            <div
              className="irm-kpi-progress-fill followups"
              style={{
                width: `${overdueFollowups.length > 0 ? 100 : 45}%`,
                backgroundColor: overdueFollowups.length > 0 ? '#ef4444' : '#f59e0b',
              }}
            />
          </div>
          <div
            className={`irm-kpi-sub ${overdueFollowups.length > 0 ? 'overdue' : ''}`}
            style={{ color: overdueFollowups.length > 0 ? '#ef4444' : '#d97706' }}
          >
            {overdueFollowups.length > 0 ? (
              <>
                <AlertCircle size={13} /> {overdueFollowups.length} overdue follow-up item!
              </>
            ) : (
              'All scheduled on time'
            )}
          </div>
        </div>

        {/* Card 5: Assigned HNW Investors */}
        <div
          className="card card-hover irm-kpi-card investors"
          onClick={() => onNavigate('investors')}
          title="Click to view Investor 360"
        >
          <div className="irm-kpi-header">
            <span className="irm-kpi-label">ASSIGNED HNW CLIENTS</span>
            <div className="irm-kpi-icon investors"><Users size={16} /></div>
          </div>
          <div className="irm-kpi-val">{scopedInvestors.length}</div>
          <div className="irm-kpi-progress-track">
            <div className="irm-kpi-progress-fill investors" style={{ width: '85%' }} />
          </div>
          <div className="irm-kpi-sub" style={{ color: '#3b82f6' }}>
            <Shield size={13} /> {tier1Count} Tier 1 Ultra-HNW clients
          </div>
        </div>
      </div>

      {/* ── Main Split View ── */}
      <div className="irm-dashboard-split">
        {/* Left Column: Opportunities & Investor 360 */}
        <div className="irm-split-col">
          {/* Active Opportunities Widget */}
          <div className="card irm-widget-card">
            <div className="irm-widget-header">
              <div>
                <h3 className="irm-widget-title">Active Investment Opportunities</h3>
                <p className="irm-widget-subtitle">Pipeline capital commitments in negotiation</p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('opportunities')}>
                View All Deals <ArrowRight size={13} />
              </button>
            </div>

            <div className="irm-opps-list">
              {activeOpportunities.slice(0, 4).map(opp => (
                <div key={opp.id} className="irm-opp-card" onClick={() => onNavigate('opportunities')}>
                  <div className="irm-opp-top">
                    <div>
                      <div className="irm-opp-title">{opp.title}</div>
                      <div className="irm-opp-investor">{opp.investorName}</div>
                    </div>
                    <span
                      className={`irm-opp-badge ${opp.stage.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      {opp.stage}
                    </span>
                  </div>
                  <div className="irm-opp-bottom">
                    <div className="irm-opp-amount">
                      <span className="irm-opp-amt-label">Target:</span>
                      <strong>{formatCurrency(opp.targetAmount)}</strong>
                    </div>
                    {opp.committedAmount ? (
                      <div className="irm-opp-committed">
                        <span className="irm-opp-amt-label">Committed:</span>
                        <strong style={{ color: '#059669' }}>{formatCurrency(opp.committedAmount)}</strong>
                      </div>
                    ) : null}
                    <div className="irm-opp-date">
                      {opp.expectedCloseDate ? `Close: ${opp.expectedCloseDate}` : 'In Discussion'}
                    </div>
                  </div>
                </div>
              ))}

              {activeOpportunities.length === 0 && (
                <div className="irm-empty-box">
                  <Briefcase size={28} color="var(--text-muted)" />
                  <p>No active opportunities logged in the pipeline.</p>
                </div>
              )}
            </div>
          </div>

          {/* Assigned HNW Investors Table */}
          <div className="card irm-widget-card">
            <div className="irm-widget-header">
              <div>
                <h3 className="irm-widget-title">Assigned HNW Investors (Investor 360)</h3>
                <p className="irm-widget-subtitle">Key portfolio accounts requiring active advisory</p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('investors')}>
                View 360 <ArrowRight size={13} />
              </button>
            </div>

            <div className="irm-table-wrap">
              <table className="irm-table">
                <thead>
                  <tr>
                    <th>Investor</th>
                    <th>Status</th>
                    <th>Capacity / AUM</th>
                    <th className="right">Outreach</th>
                  </tr>
                </thead>
                <tbody>
                  {scopedInvestors.slice(0, 4).map(inv => (
                    <tr key={inv.id}>
                      <td>
                        <div className="irm-td-name">{inv.name}</div>
                        <div className="irm-td-sub">
                          {inv.phone} • {inv.preferredAssetClass || 'AIF Category II'}
                        </div>
                      </td>
                      <td>
                        <StatusChip status={inv.status} size="sm" />
                      </td>
                      <td>
                        <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                          {inv.committedAUM || inv.investmentCapacity || '—'}
                        </strong>
                      </td>
                      <td className="right">
                        <button
                          className="btn btn-call btn-sm btn-icon irm-call-btn"
                          title={`Dial ${inv.name}`}
                          onClick={() => initiateCall(inv.name, inv.phone, 'customer', inv.id)}
                        >
                          <Phone size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {scopedInvestors.length === 0 && (
                    <tr>
                      <td colSpan={4} className="irm-td-empty">
                        No assigned investors in portfolio.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Pending KYC & Follow-ups */}
        <div className="irm-split-col">
          {/* Pending KYC Compliance Widget */}
          <div className="card irm-widget-card">
            <div className="irm-widget-header">
              <div>
                <h3 className="irm-widget-title">Pending KYC Verification</h3>
                <p className="irm-widget-subtitle">Prospective investors awaiting SEBI compliance clearance</p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('kyc')}>
                Open KYC <ArrowRight size={13} />
              </button>
            </div>

            <div className="irm-kyc-queue">
              {inReviewKycs.slice(0, 3).map((k, idx) => (
                <div key={idx} className="irm-kyc-item" onClick={() => onNavigate('kyc')}>
                  <div className="irm-kyc-item-left">
                    <div className="irm-kyc-avatar">
                      {(k.investorName || k.name || 'IN').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="irm-kyc-name">{k.investorName || k.name}</div>
                      <div className="irm-kyc-sub">
                        {k.phone} • PAN: {k.panNumber || 'Pending'}
                      </div>
                    </div>
                  </div>
                  <div className="irm-kyc-item-right">
                    <span className="irm-kyc-pill review">Under Review</span>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={e => {
                        e.stopPropagation();
                        initiateCall(k.investorName || k.name, k.phone, 'customer', String(k.investorId || k.id));
                      }}
                    >
                      <Phone size={11} /> Call
                    </button>
                  </div>
                </div>
              ))}

              {inReviewKycs.length === 0 && (
                <div className="irm-empty-box">
                  <CheckCircle2 size={28} color="#10b981" />
                  <p>All KYC investor dossiers are fully verified &amp; cleared!</p>
                </div>
              )}
            </div>
          </div>

          {/* Actionable Follow-ups & Consultations */}
          <div className="card irm-widget-card">
            <div className="irm-widget-header">
              <div className="irm-tab-toggle">
                <button
                  className={`irm-toggle-btn ${scheduleTab === 'followups' ? 'active' : ''}`}
                  onClick={() => setScheduleTab('followups')}
                >
                  <Calendar size={13} /> Follow-ups ({pendingFollowups.length})
                </button>
                <button
                  className={`irm-toggle-btn ${scheduleTab === 'consultations' ? 'active' : ''}`}
                  onClick={() => setScheduleTab('consultations')}
                >
                  <CalendarCheck size={13} /> Consultations ({scopedConsultations.length})
                </button>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => onNavigate(scheduleTab === 'followups' ? 'followups' : 'consultations')}
              >
                View All <ArrowRight size={13} />
              </button>
            </div>

            {scheduleTab === 'followups' ? (
              <div className="irm-followups-list">
                {pendingFollowups.slice(0, 4).map(f => (
                  <div key={f.id} className="irm-followup-row">
                    <div className="irm-followup-info">
                      <div className="irm-followup-top">
                        <span className="irm-followup-name">{f.contactName}</span>
                        <StatusChip status={f.priority} size="sm" />
                      </div>
                      <p className="irm-followup-notes">{f.notes || 'Scheduled touchpoint'}</p>
                      <div className="irm-followup-due">
                        ⏰ Due: <strong>{f.scheduledAt}</strong>
                      </div>
                    </div>
                    <button
                      className="btn btn-call btn-sm irm-action-call-btn"
                      onClick={() => initiateCall(f.contactName, f.contactPhone, 'customer', f.contactId)}
                    >
                      <Phone size={12} /> Call
                    </button>
                  </div>
                ))}

                {pendingFollowups.length === 0 && (
                  <div className="irm-empty-box">
                    <CheckCircle2 size={28} color="#10b981" />
                    <p>No pending follow-ups. You are completely caught up!</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="irm-followups-list">
                {scopedConsultations.slice(0, 4).map(c => (
                  <div key={c.id} className="irm-followup-row">
                    <div className="irm-followup-info">
                      <div className="irm-followup-top">
                        <span className="irm-followup-name">{c.investorName}</span>
                        <StatusChip status={c.status} size="sm" />
                      </div>
                      <p className="irm-followup-notes">{c.agenda || 'Advisory session'}</p>
                      <div className="irm-followup-due">
                        📅 Scheduled: <strong>{c.scheduledAt}</strong>
                      </div>
                    </div>
                    <button
                      className="btn btn-call btn-sm irm-action-call-btn"
                      onClick={() => initiateCall(c.investorName, c.investorPhone, 'customer', c.investorId)}
                    >
                      <Phone size={12} /> Call
                    </button>
                  </div>
                ))}

                {scopedConsultations.length === 0 && (
                  <div className="irm-empty-box">
                    <Calendar size={28} color="var(--text-muted)" />
                    <p>No upcoming advisory consultations scheduled.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Quick IRM Workflow Navigation Bar ── */}
      <div className="card irm-workflow-nav-bar">
        <span className="irm-nav-label">IRM WORKFLOW QUICK ACCESS:</span>
        <div className="irm-nav-chips">
          <button className="irm-nav-chip" onClick={() => onNavigate('leads')}>
            <Users size={13} />
            <span>My Leads</span>
            <strong>{scopedLeads.length}</strong>
          </button>
          <button className="irm-nav-chip" onClick={() => onNavigate('followups')}>
            <Clock size={13} />
            <span>Follow-up</span>
            <strong>{pendingFollowups.length}</strong>
          </button>
          <button className="irm-nav-chip" onClick={() => onNavigate('kyc')}>
            <FileCheck size={13} />
            <span>KYC Onboarding</span>
            <strong>{totalKycTargetCount}</strong>
          </button>
          <button className="irm-nav-chip" onClick={() => onNavigate('opportunities')}>
            <Briefcase size={13} />
            <span>Opportunities</span>
            <strong>{activeOpportunities.length}</strong>
          </button>
          <button className="irm-nav-chip" onClick={() => onNavigate('investors')}>
            <TrendingUp size={13} />
            <span>Investor 360</span>
            <strong>{scopedInvestors.length}</strong>
          </button>
          <button className="irm-nav-chip" onClick={() => onNavigate('irm-other')}>
            <FolderArchive size={13} />
            <span>Other Repository</span>
            <strong>{scopedOther.length}</strong>
          </button>
        </div>
      </div>
    </div>
  );
};
