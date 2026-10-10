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
import { formatSmartScheduleDate, isDateToday, isDateOverdue, isDateDueTodayOrOverdue } from '../../../utils/dateUtils';
import { getAgentRoleInfo, getAssigningSalesAgentInfo } from '../../../utils/agentRoleUtils';
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

  // Lead scoping for this IRM: includes leads directly assigned to IRM or handed over to IRM
  const isMineLead = useCallback((l: Lead) => {
    if (!user) return false;
    const uId = String(user.id);
    const uName = (user.name || '').trim().toLowerCase();
    return (
      (l.assignedIrmId && String(l.assignedIrmId) === uId) ||
      (l.assignedIrmName && l.assignedIrmName.trim().toLowerCase() === uName) ||
      (l.customFields?.assignedIrmId && String(l.customFields.assignedIrmId) === uId) ||
      (l.customFields?.assignedIrmName && String(l.customFields.assignedIrmName).trim().toLowerCase() === uName) ||
      (l.assignedAgentId && String(l.assignedAgentId) === uId) ||
      (!!l.assignedAgentName && l.assignedAgentName.trim().toLowerCase() === uName)
    );
  }, [user]);

  // Scoped datasets for the logged-in IRM
  const scopedLeads = useMemo(() => leads.filter(l => isMineLead(l)), [leads, isMineLead]);
  const scopedInvestors = useMemo(() => investors.filter(i => isMine(i.assignedAgentId, i.assignedAgentName) || (i.assignedIrmId && String(i.assignedIrmId) === String(user?.id)) || (i.assignedIrmName && i.assignedIrmName.trim().toLowerCase() === (user?.name || '').trim().toLowerCase())), [investors, isMine, user]);
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

  // Active Opportunities (matches OpportunitiesPage irmDeals + scopedOpportunities)
  const irmOpportunitiesDeals = useMemo(() => {
    return deals.filter(d => (d.stage === 'investment_opportunity' || d.stage === 'opportunity') && isMine(d.assignedAgentId, d.assignedAgentName));
  }, [deals, isMine]);

  const activeOpportunities = useMemo(() => {
    return scopedOpportunities.filter(o => o.stage !== 'Closed Lost');
  }, [scopedOpportunities]);

  const activeOpportunitiesCount = useMemo(() => {
    return activeOpportunities.length + irmOpportunitiesDeals.length;
  }, [activeOpportunities, irmOpportunitiesDeals]);

  const totalPipelineCorpus = useMemo(() => {
    const oppCorpus = activeOpportunities.reduce((s, o) => s + (Number(o.targetAmount) || 0), 0);
    const dealCorpus = irmOpportunitiesDeals.reduce((s, d) => s + (Number(d.value) || 0), 0);
    return oppCorpus + dealCorpus;
  }, [activeOpportunities, irmOpportunitiesDeals]);

  // Follow-ups
  const pendingFollowups = useMemo(() => {
    return scopedFollowups.filter(f => f.status === 'Pending');
  }, [scopedFollowups]);

  const overdueFollowups = useMemo(() => {
    return pendingFollowups.filter(f => isDateOverdue(f.scheduledAt));
  }, [pendingFollowups]);

  // Today's Follow-ups
  const todaysFollowups = useMemo(() => {
    return pendingFollowups.filter(f => isDateToday(f.scheduledAt));
  }, [pendingFollowups]);

  // Actionable Due Follow-ups (Due Today + Overdue)
  const dueFollowups = useMemo(() => {
    return pendingFollowups.filter(f => isDateDueTodayOrOverdue(f.scheduledAt));
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

  // ── Today's Assigned Leads for this IRM (Present Day only) ──────────────────

  const todayLeads = useMemo(() => {
    return scopedLeads.filter(l => {
      const d = l.assignedIrmAt || (l as any).assignedAt || l.createdAt;
      return isDateToday(d);
    });
  }, [scopedLeads]);

  const todayDateLabel = useMemo(() => {
    return new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }, []);

  const formatLeadTime = (dateVal?: string | Date) => {
    if (!dateVal) return 'Today';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return 'Today';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

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
            You have <strong>{dueFollowups.length} follow-up{dueFollowups.length === 1 ? '' : 's'}</strong> due today and{' '}
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
          <div className="irm-kpi-val">{activeOpportunitiesCount}</div>
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
          <div className="irm-kpi-val">{dueFollowups.length}</div>
          <div className="irm-kpi-progress-track">
            <div
              className="irm-kpi-progress-fill followups"
              style={{
                width: `${overdueFollowups.length > 0 ? 100 : (dueFollowups.length > 0 ? 60 : 0)}%`,
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
            ) : dueFollowups.length > 0 ? (
              `${dueFollowups.length} scheduled for today`
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

      {/* ── Main Clean 2-Column Split View ── */}
      <div className="irm-dashboard-split">
        {/* Left Column: Today's Assigned Leads (Present day only) */}
        <div className="card irm-widget-card">
          <div className="irm-widget-header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 className="irm-widget-title">Today's Assigned Leads</h3>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 12,
                    background: 'rgba(59, 130, 246, 0.15)',
                    color: '#3b82f6',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                  }}
                >
                  {todayLeads.length} Today
                </span>
              </div>
              <p className="irm-widget-subtitle">
                Leads assigned to you today ({todayDateLabel}) • Older leads available in All Leads
              </p>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('all-leads')}>
              View All Leads <ArrowRight size={13} />
            </button>
          </div>

          <div className="irm-followups-list">
            {todayLeads.slice(0, 5).map(lead => {
              const salesAgent = getAssigningSalesAgentInfo(lead);
              return (
                <div key={lead.id} className="irm-followup-row">
                  <div className="irm-followup-info">
                    <div className="irm-followup-top">
                      <span className="irm-followup-name">{lead.name}</span>
                      <StatusChip status={lead.status} size="sm" />
                      {lead.priority && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: 4,
                            textTransform: 'uppercase',
                            background:
                              lead.priority.toLowerCase() === 'high' || lead.priority.toLowerCase() === 'urgent'
                                ? 'rgba(239, 68, 68, 0.15)'
                                : 'rgba(59, 130, 246, 0.15)',
                            color:
                              lead.priority.toLowerCase() === 'high' || lead.priority.toLowerCase() === 'urgent'
                                ? '#ef4444'
                                : '#3b82f6',
                          }}
                        >
                          {lead.priority}
                        </span>
                      )}
                    </div>
                    <div className="irm-td-sub" style={{ marginTop: 2 }}>
                      📞 {lead.phone} {lead.location ? `• 📍 ${lead.location}` : ''}
                    </div>
                    <div className="irm-followup-due" style={{ color: 'var(--text-muted)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 3 }}>
                      <span>👤 Assigned by:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{salesAgent.name}</strong>
                      <span className={`badge-role-inline ${salesAgent.badgeClass}`}>
                        {salesAgent.role}
                      </span>
                      <span>• 🕒 {formatLeadTime(lead.assignedIrmAt || (lead as any).assignedAt || lead.createdAt)}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      className="btn btn-call btn-sm irm-action-call-btn"
                      title={`Dial ${lead.name}`}
                      onClick={() => initiateCall(lead.name, lead.phone, 'lead', lead.id, undefined, 'my_leads')}
                    >
                      <Phone size={12} /> Call
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      title="Open in My Leads"
                      onClick={() => onNavigate('leads')}
                    >
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              );
            })}

            {todayLeads.length === 0 && (
              <div className="irm-empty-box">
                <Clock size={28} color="var(--text-muted)" />
                <p>No new leads assigned today yet.</p>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  When sales agents assign leads to you today, they will appear here in real time.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Follow-ups & Consultations */}
        <div className="card irm-widget-card">
          <div className="irm-widget-header">
            <div className="irm-tab-toggle">
              <button
                className={`irm-toggle-btn ${scheduleTab === 'followups' ? 'active' : ''}`}
                onClick={() => setScheduleTab('followups')}
              >
                <Calendar size={13} /> Follow-ups ({dueFollowups.length})
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
              {dueFollowups.slice(0, 5).map(f => (
                <div key={f.id} className="irm-followup-row">
                  <div className="irm-followup-info">
                    <div className="irm-followup-top">
                      <span className="irm-followup-name">{f.contactName}</span>
                      <StatusChip status={f.priority} size="sm" />
                    </div>
                    <p className="irm-followup-notes">{f.notes || 'Scheduled touchpoint'}</p>
                    <div className="irm-followup-due">
                      ⏰ Due: <strong>{formatSmartScheduleDate(f.scheduledAt)}</strong>
                    </div>
                  </div>
                  <button
                    className="btn btn-call btn-sm irm-action-call-btn"
                    onClick={() => initiateCall(f.contactName, f.contactPhone, (f.contactType as any) || 'customer', f.contactId, f.id, 'follow_up')}
                  >
                    <Phone size={12} /> Call
                  </button>
                </div>
              ))}

              {dueFollowups.length === 0 && (
                <div className="irm-empty-box">
                  <CheckCircle2 size={28} color="#10b981" />
                  <p>No follow-ups due today. You are completely caught up!</p>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {pendingFollowups.length > 0
                      ? `${pendingFollowups.length} upcoming follow-up${pendingFollowups.length > 1 ? 's' : ''} scheduled for later dates.`
                      : 'When new follow-ups are scheduled for today, they will appear here.'}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="irm-followups-list">
              {scopedConsultations.slice(0, 5).map(c => (
                <div key={c.id} className="irm-followup-row">
                  <div className="irm-followup-info">
                    <div className="irm-followup-top">
                      <span className="irm-followup-name">{c.investorName}</span>
                      <StatusChip status={c.status} size="sm" />
                      {c.referredByAgentName && (
                        <span style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600 }}>
                          • Sent by {c.referredByAgentName}
                        </span>
                      )}
                    </div>
                    <p className="irm-followup-notes">{c.agenda || 'Advisory session'}</p>
                    <div className="irm-followup-due">
                      📅 Scheduled: <strong>{formatSmartScheduleDate(c.scheduledAt)}</strong>
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
                  <CalendarCheck size={28} color="var(--text-muted)" />
                  <p>No upcoming advisory consultations scheduled.</p>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    When sales agents refer customer consultations, they will appear here.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
