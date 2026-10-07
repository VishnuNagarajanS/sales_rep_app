import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BarChart3,
  Download,
  TrendingUp,
  PhoneCall,
  Users,
  Award,
  FileCheck,
  Briefcase,
  Shield,
  Clock,
  ArrowUpRight,
  PieChart,
  Layers,
  FolderArchive,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  DollarSign
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import {
  getLeads,
  getDeals,
  getCalls,
  getConsultations,
  getOpportunities,
  getFollowups,
  getInvestors,
  getIrmOtherRecords,
} from '../../../services/ghlApiService';
import { apiUrl } from '../../../utils/apiUrl';
import { getAuthHeaders } from '../../../utils/authHeaders';
import {
  Lead,
  Deal,
  CallRecord,
  Consultation,
  InvestmentOpportunity,
  Followup,
  Investor,
  IrmOtherRecord,
} from '../../../types';
import './IrmReportsView.css';

export const IrmReportsView: React.FC = () => {
  const { tenant, user } = useAuth();
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter' | 'all'>('month');
  const [activeTab, setActiveTab] = useState<'capital' | 'kyc' | 'dispositions'>('capital');

  const [leads, setLeads] = useState<Lead[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [opportunities, setOpportunities] = useState<InvestmentOpportunity[]>([]);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [kycs, setKycs] = useState<any[]>([]);
  const [otherRecords, setOtherRecords] = useState<IrmOtherRecord[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // ── Live Data Fetcher ────────────────────────────────────────────────────────
  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const [l, d, c, cs, opp, flw, inv, oth] = await Promise.allSettled([
        getLeads(tenant?.id),
        getDeals(tenant?.id),
        getCalls(tenant?.id),
        getConsultations(tenant?.id),
        getOpportunities(tenant?.id),
        getFollowups(tenant?.id),
        getInvestors(tenant?.id),
        getIrmOtherRecords(),
      ]);

      const getVal = <T,>(res: PromiseSettledResult<T>, fb: T): T =>
        res.status === 'fulfilled' ? res.value : fb;

      setLeads(getVal(l, []));
      setDeals(getVal(d, []));
      setCalls(getVal(c, []));
      setConsultations(getVal(cs, []));
      setOpportunities(getVal(opp, []));
      setFollowups(getVal(flw, []));
      setInvestors(getVal(inv, []));
      setOtherRecords(getVal(oth, []));

      // Fetch dynamic KYC records from backend
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
        console.error('[IrmReportsView] Failed to fetch live KYC records:', err);
      }
    } catch (err) {
      console.error('[IrmReportsView] Error loading data:', err);
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

  // ── Formatters ───────────────────────────────────────────────────────────────
  const formatCurrency = (val: number) => {
    if (!val || isNaN(val)) return '₹0';
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    return `₹${val.toLocaleString('en-IN')}`;
  };

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

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
  };

  // ── Date Filtering Helper ───────────────────────────────────────────────────
  const isWithinPeriod = useCallback((dateStr?: string): boolean => {
    if (period === 'all') return true;
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    const now = new Date();
    const diffDays = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays < 0) return true; // Scheduled in future / today

    if (period === 'week') return diffDays <= 7;
    if (period === 'month') return diffDays <= 30;
    if (period === 'quarter') return diffDays <= 90;
    return true;
  }, [period]);

  // ── Dynamic IRM Role Scoping ────────────────────────────────────────────────
  const isMyRecord = useCallback((assignedId?: string | number, assignedName?: string) => {
    if (!user) return false;
    if (assignedId && String(assignedId) === String(user.id)) return true;
    if (assignedName && user.name && assignedName.trim().toLowerCase() === user.name.trim().toLowerCase()) return true;
    return false;
  }, [user]);

  // Scoped data sets for the logged-in IRM
  const scopedLeads = useMemo(() => {
    return leads.filter(l => isMyRecord(l.assignedAgentId, l.assignedAgentName));
  }, [leads, isMyRecord]);

  const scopedOpportunities = useMemo(() => {
    return opportunities.filter(o => isMyRecord(o.assignedAgentId, o.assignedAgentName));
  }, [opportunities, isMyRecord]);

  const scopedInvestors = useMemo(() => {
    return investors.filter(i => isMyRecord(i.assignedAgentId, i.assignedAgentName));
  }, [investors, isMyRecord]);

  const scopedCalls = useMemo(() => {
    return calls.filter(c => isMyRecord(c.agentId, c.agentName));
  }, [calls, isMyRecord]);

  const scopedFollowups = useMemo(() => {
    return followups.filter(f => isMyRecord(f.assignedAgentId, f.assignedAgentName));
  }, [followups, isMyRecord]);

  const scopedKycs = useMemo(() => {
    return kycs.filter(k => {
      if (k.irmId && String(k.irmId) === String(user?.id)) return true;
      // Match with assigned investors or deals
      const matchesInvestor = scopedInvestors.some(
        inv => String(inv.id) === String(k.investorId) || (inv.phone && inv.phone === k.phone)
      );
      if (matchesInvestor) return true;
      const matchesLead = scopedLeads.some(
        l => (l.phone && l.phone === k.phone) || (l.email && l.email === k.email)
      );
      return matchesLead;
    });
  }, [kycs, user?.id, scopedInvestors, scopedLeads]);

  const scopedOther = useMemo(() => {
    return otherRecords.filter(r => isMyRecord(r.agentId, r.agentName));
  }, [otherRecords, isMyRecord]);

  // Period-filtered collections
  const periodLeads = useMemo(() => scopedLeads.filter(l => isWithinPeriod(l.createdAt)), [scopedLeads, isWithinPeriod]);
  const periodOpps = useMemo(() => scopedOpportunities.filter(o => isWithinPeriod(o.expectedCloseDate || (o as any).createdAt)), [scopedOpportunities, isWithinPeriod]);
  const periodCalls = useMemo(() => scopedCalls.filter(c => isWithinPeriod(c.timestamp)), [scopedCalls, isWithinPeriod]);
  const periodFollowups = useMemo(() => scopedFollowups.filter(f => isWithinPeriod(f.scheduledAt)), [scopedFollowups, isWithinPeriod]);

  // ── Key Wealth Metrics (100% Dynamic) ───────────────────────────────────────
  // 1. AUM & Capital Raised
  const committedOpps = useMemo(() => {
    return periodOpps.filter(o => o.stage === 'Committed' || o.stage === 'Closed Won');
  }, [periodOpps]);

  const totalCommittedAUM = useMemo(() => {
    const oppsAUM = committedOpps.reduce((sum, o) => sum + (Number(o.committedAmount) || 0), 0);
    const dealAum = deals
      .filter(d => (d.stage === 'converted' || d.stage === 'won' || d.stage === 'investment_opportunity') && isMyRecord(d.assignedAgentId, d.assignedAgentName))
      .reduce((s, d) => s + (Number(d.value) || 0), 0);
    const invAUM = scopedInvestors.reduce((sum, inv) => {
      const fDigits = (inv.phone || '').replace(/\D/g, '').slice(-10);
      const match = deals.find(d => {
        if (d.customerId && String(d.customerId) === String(inv.id)) return true;
        const dDigits = (d.phone || '').replace(/\D/g, '').slice(-10);
        return fDigits && dDigits && dDigits === fDigits;
      });
      const dealVal = match?.value ? Number(match.value) : 0;
      const parsed = parseAumToNumber(inv.committedAUM || inv.investmentCapacity);
      return sum + Math.max(dealVal, parsed);
    }, 0);
    return Math.max(oppsAUM, dealAum, invAUM);
  }, [committedOpps, deals, scopedInvestors, isMyRecord]);

  const totalTargetCorpus = useMemo(() => {
    return periodOpps.reduce((sum, o) => sum + (Number(o.targetAmount) || 0), 0);
  }, [periodOpps]);

  const aumAchievementPct = totalTargetCorpus > 0
    ? Math.min(Math.round((totalCommittedAUM / totalTargetCorpus) * 100), 100)
    : 0;

  // 2. KYC Compliance & Clearance Health
  const kycVerified = useMemo(() => {
    return scopedKycs.filter(k => (k.status || '').toLowerCase() === 'verified');
  }, [scopedKycs]);

  const kycInReview = useMemo(() => {
    return scopedKycs.filter(k => {
      const s = (k.status || '').toLowerCase();
      return s === 'in_review' || s === 'under_review' || s === 'in-review' || s === 'submitted';
    });
  }, [scopedKycs]);

  const kycRejected = useMemo(() => {
    return scopedKycs.filter(k => (k.status || '').toLowerCase() === 'rejected');
  }, [scopedKycs]);

  const kycPending = useMemo(() => {
    return scopedKycs.filter(k => {
      const s = (k.status || '').toLowerCase();
      return s === 'initiated' || s === 'draft' || s === 'pending' || !s;
    });
  }, [scopedKycs]);

  const kycClearanceRate = scopedKycs.length > 0
    ? Math.round((kycVerified.length / scopedKycs.length) * 100)
    : 0;

  // 3. Active Pipeline Opportunities
  const activeOpps = useMemo(() => {
    return periodOpps.filter(o => o.stage !== 'Closed Lost');
  }, [periodOpps]);

  const activePipelineValue = useMemo(() => {
    return activeOpps.reduce((sum, o) => sum + (Number(o.targetAmount) || 0), 0);
  }, [activeOpps]);

  const avgTicketSize = committedOpps.length > 0
    ? Math.round(totalCommittedAUM / committedOpps.length)
    : activeOpps.length > 0
      ? Math.round(activePipelineValue / activeOpps.length)
      : 0;

  // 4. Telephony & Follow-up Adherence
  const totalCallsCount = periodCalls.length;
  const connectedCalls = useMemo(() => periodCalls.filter(c => (c.duration || 0) > 0), [periodCalls]);
  const connectRate = totalCallsCount > 0
    ? ((connectedCalls.length / totalCallsCount) * 100).toFixed(1)
    : '0.0';
  const totalTalkSeconds = useMemo(() => connectedCalls.reduce((s, c) => s + (c.duration || 0), 0), [connectedCalls]);
  const avgTalkTime = connectedCalls.length > 0
    ? formatDuration(Math.round(totalTalkSeconds / connectedCalls.length))
    : '0s';

  const completedFollowups = useMemo(() => periodFollowups.filter(f => f.status === 'Completed'), [periodFollowups]);
  const followupAdherenceRate = periodFollowups.length > 0
    ? Math.round((completedFollowups.length / periodFollowups.length) * 100)
    : 100;

  // ── 5-Stage IRM Conversion Funnel ───────────────────────────────────────────
  const funnelSteps = useMemo(() => {
    const s1 = periodLeads.length;
    const s2 = periodFollowups.length;
    const s3 = scopedKycs.length;
    const s4 = periodOpps.length;
    const s5 = committedOpps.length || scopedInvestors.filter(i => i.status === 'Active Investor' || i.status === 'HNW Investor').length;
    const base = Math.max(s1, s2, s3, s4, s5, 1);

    return [
      { label: '1. My Leads', count: s1, pct: `${Math.round((s1 / base) * 100)}%`, color: '#3b82f6', sub: 'Assigned investor leads' },
      { label: '2. Follow-up', count: s2, pct: `${Math.round((s2 / base) * 100)}%`, color: '#f59e0b', sub: 'Active investor touchpoints' },
      { label: '3. KYC Qualified', count: s3, pct: `${Math.round((s3 / base) * 100)}%`, color: '#8b5cf6', sub: `${kycVerified.length} SEBI Verified` },
      { label: '4. Opportunities', count: s4, pct: `${Math.round((s4 / base) * 100)}%`, color: '#06b6d4', sub: formatCurrency(activePipelineValue) },
      { label: '5. Converted / Committed', count: s5, pct: `${Math.round((s5 / base) * 100)}%`, color: '#10b981', sub: formatCurrency(totalCommittedAUM) },
    ];
  }, [periodLeads, periodFollowups, scopedKycs, periodOpps, committedOpps, scopedInvestors, kycVerified, activePipelineValue, totalCommittedAUM]);

  // ── Asset Class Allocation Breakdown ─────────────────────────────────────────
  const assetClassBreakdown = useMemo(() => {
    const counts: Record<string, { count: number; value: number }> = {};

    periodOpps.forEach(o => {
      const raw = (o as any).assetClass || (o as any).preferredAssetClass || 'Alternative Investment (AIF)';
      const key = raw.includes('AIF') ? 'AIF Category II'
        : raw.includes('PMS') ? 'Portfolio Mgmt (PMS)'
        : raw.includes('Pre-IPO') ? 'Pre-IPO Equity'
        : raw.includes('Real Estate') ? 'Commercial Real Estate'
        : raw.includes('Fixed') || raw.includes('Debt') ? 'Fixed Income & Debt'
        : raw;
      if (!counts[key]) counts[key] = { count: 0, value: 0 };
      counts[key].count += 1;
      counts[key].value += Number(o.committedAmount || o.targetAmount || 0);
    });

    // If no opps with asset class, populate from assigned investors
    if (Object.keys(counts).length === 0) {
      scopedInvestors.forEach(inv => {
        const raw = inv.preferredAssetClass || 'AIF Category II';
        const key = raw.includes('AIF') ? 'AIF Category II'
          : raw.includes('PMS') ? 'Portfolio Mgmt (PMS)'
          : raw.includes('Pre-IPO') ? 'Pre-IPO Equity'
          : raw.includes('Real Estate') ? 'Commercial Real Estate'
          : raw.includes('Fixed') ? 'Fixed Income & Debt'
          : raw;
        if (!counts[key]) counts[key] = { count: 0, value: 0 };
        counts[key].count += 1;
      });
    }

    const totalVal = Object.values(counts).reduce((s, c) => s + c.value, 0) || 1;
    const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#06b6d4', '#ec4899'];

    return Object.entries(counts).map(([name, data], idx) => ({
      name,
      count: data.count,
      value: data.value,
      pct: Math.round((data.value / totalVal) * 100) || Math.round((data.count / (periodOpps.length || scopedInvestors.length || 1)) * 100),
      color: colors[idx % colors.length],
    }));
  }, [periodOpps, scopedInvestors]);

  // ── Ticket Size Distribution Brackets ───────────────────────────────────────
  const ticketSizeBrackets = useMemo(() => {
    const brackets = [
      { label: '< ₹25 Lakhs', min: 0, max: 2500000, count: 0, color: '#94a3b8' },
      { label: '₹25L – ₹50 Lakhs', min: 2500000, max: 5000000, count: 0, color: '#3b82f6' },
      { label: '₹50L – ₹1 Crore', min: 5000000, max: 10000000, count: 0, color: '#8b5cf6' },
      { label: '₹1 Cr – ₹5 Crores', min: 10000000, max: 50000000, count: 0, color: '#10b981' },
      { label: '> ₹5 Crores', min: 50000000, max: Infinity, count: 0, color: '#f59e0b' },
    ];

    periodOpps.forEach(o => {
      const amt = Number(o.committedAmount || o.targetAmount || 0);
      const b = brackets.find(item => amt >= item.min && amt < item.max);
      if (b) b.count += 1;
    });

    const totalCount = periodOpps.length || 1;
    return brackets.map(b => ({
      ...b,
      pct: Math.round((b.count / totalCount) * 100),
    }));
  }, [periodOpps]);

  // ── Call Disposition Breakdown ──────────────────────────────────────────────
  const DISPO_COLORS: Record<string, string> = {
    'Interested': '#10b981',
    'Ready for KYC': '#8b5cf6',
    'Follow-up Required': '#f59e0b',
    'Call Back': '#3b82f6',
    'Converted': '#059669',
    'Other': '#64748b',
    'Not Interested': '#ef4444',
    'No Response': '#94a3b8',
    'Wrong Number': '#6b7280',
  };

  const callDispositions = useMemo(() => {
    const counts: Record<string, number> = {};
    periodCalls.forEach(c => {
      const disp = c.disposition || 'Unassigned';
      counts[disp] = (counts[disp] || 0) + 1;
    });

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({
        name,
        count,
        pct: periodCalls.length > 0 ? Math.round((count / periodCalls.length) * 100) : 0,
        color: DISPO_COLORS[name] || '#64748b',
      }));
  }, [periodCalls]);

  // ── "Other" Module Sub-Reasons Analysis ─────────────────────────────────────
  const otherModuleBreakdown = useMemo(() => {
    const reasonCounts: Record<string, number> = {};
    const moduleCounts: Record<string, number> = {};

    scopedOther.forEach(r => {
      const reason = r.reason || 'General Other';
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;

      const mod = r.moduleDisplayName || r.callModule || 'Follow-up';
      moduleCounts[mod] = (moduleCounts[mod] || 0) + 1;
    });

    const total = scopedOther.length || 1;
    const reasons = Object.entries(reasonCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([reason, count]) => ({
        reason,
        count,
        pct: Math.round((count / total) * 100),
      }));

    const modules = Object.entries(moduleCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([mod, count]) => ({
        mod,
        count,
        pct: Math.round((count / total) * 100),
      }));

    return { reasons, modules, total: scopedOther.length };
  }, [scopedOther]);

  // ── CSV Export Functionality ─────────────────────────────────────────────────
  const handleExportCsv = () => {
    const rows = [
      ['--- INVESTOR RELATIONSHIP MANAGER PERFORMANCE REPORT ---'],
      ['IRM Agent', user?.name || 'IRM', 'Employee ID', user?.id || ''],
      ['Reporting Period', `This ${period.toUpperCase()}`, 'Generated On', new Date().toLocaleString('en-IN')],
      [],
      ['=== EXECUTIVE CAPITAL & AUM METRICS ==='],
      ['Metric', 'Value'],
      ['Committed Capital (AUM)', formatCurrency(totalCommittedAUM)],
      ['Target Capital Corpus', formatCurrency(totalTargetCorpus)],
      ['AUM Achievement Rate', `${aumAchievementPct}%`],
      ['Active Pipeline Value', formatCurrency(activePipelineValue)],
      ['Average Ticket Size', formatCurrency(avgTicketSize)],
      [],
      ['=== KYC COMPLIANCE PIPELINE ==='],
      ['KYC Status', 'Count', 'Clearance Rate'],
      ['Verified (SEBI Compliant)', kycVerified.length, `${kycClearanceRate}%`],
      ['Under Review', kycInReview.length],
      ['Pending / Initiated', kycPending.length],
      ['Rejected', kycRejected.length],
      ['Total KYC Cases Handled', scopedKycs.length],
      [],
      ['=== TELEPHONY & INVESTOR ENGAGEMENT ==='],
      ['Total Calls Made', totalCallsCount],
      ['Connected Calls', connectedCalls.length],
      ['Connect Rate', `${connectRate}%`],
      ['Average Talk Time', avgTalkTime],
      ['Follow-up Adherence Rate', `${followupAdherenceRate}%`],
      [],
      ['=== ACTIVE OPPORTUNITIES ==='],
      ['Title', 'Investor', 'Stage', 'Target Amount', 'Committed Amount', 'Expected Close'],
      ...periodOpps.map(o => [
        `"${o.title}"`,
        `"${o.investorName}"`,
        o.stage,
        o.targetAmount,
        o.committedAmount || 0,
        o.expectedCloseDate || '',
      ]),
      [],
      ['=== "OTHER" MODULE DISPOSITIONS ==='],
      ['Reason', 'Count', 'Share %'],
      ...otherModuleBreakdown.reasons.map(r => [`"${r.reason}"`, r.count, `${r.pct}%`]),
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `IRM_Wealth_Report_${period}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="irm-reports-container">
      {/* ── Top Header Bar ── */}
      <div className="page-header irm-reports-header">
        <div>
          <div className="irm-reports-badge">
            <Shield size={13} />
            <span>INVESTOR RELATIONSHIP MANAGER ANALYTICS</span>
          </div>
          <h1 className="page-title irm-reports-title">
            <BarChart3 size={24} color="var(--primary-600)" /> Wealth Analytics & Capital Telemetry
          </h1>
          <p className="page-subtitle irm-reports-subtitle">
            Committed AUM, SEBI KYC compliance onboarding, investor ticket sizing, and disposition telemetry for {tenant?.name || 'GHL India Ventures'}.
          </p>
        </div>

        <div className="irm-reports-actions">
          {/* Period Toggle */}
          <div className="irm-reports-period-toggle">
            {(['week', 'month', 'quarter', 'all'] as const).map(p => (
              <button
                key={p}
                className={`btn btn-sm ${period === p ? 'btn-primary' : 'btn-ghost'}`}
                style={{ textTransform: 'capitalize', fontSize: 12, padding: '5px 12px' }}
                onClick={() => setPeriod(p)}
              >
                {p === 'all' ? 'All Time' : `This ${p}`}
              </button>
            ))}
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => loadData(true)}
            title="Refresh Live Metrics"
            disabled={refreshing}
          >
            <RefreshCw size={14} className={refreshing ? 'irm-spin' : ''} />
            <span>{refreshing ? 'Syncing...' : 'Refresh'}</span>
          </button>

          <button className="btn btn-primary btn-sm" onClick={handleExportCsv}>
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* ── Top 4 Wealth KPI Metric Cards ── */}
      <div className="irm-reports-kpi-grid">
        {/* Card 1: Committed Capital (AUM) */}
        <div className="card irm-reports-kpi-card aum">
          <div className="irm-reports-kpi-header">
            <span className="irm-reports-kpi-label">COMMITTED CAPITAL (AUM)</span>
            <div className="irm-reports-kpi-icon-box aum">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="irm-reports-kpi-value">
            {formatCurrency(totalCommittedAUM)}
          </div>
          <div className="irm-reports-progress-wrap">
            <div className="irm-reports-progress-bar" style={{ width: `${aumAchievementPct}%`, backgroundColor: '#10b981' }} />
          </div>
          <div className="irm-reports-kpi-subtext positive">
            <ArrowUpRight size={13} /> {aumAchievementPct}% of target corpus ({formatCurrency(totalTargetCorpus)})
          </div>
        </div>

        {/* Card 2: KYC Qualified Pipeline */}
        <div className="card irm-reports-kpi-card kyc">
          <div className="irm-reports-kpi-header">
            <span className="irm-reports-kpi-label">KYC QUALIFIED INVESTORS</span>
            <div className="irm-reports-kpi-icon-box kyc">
              <FileCheck size={18} />
            </div>
          </div>
          <div className="irm-reports-kpi-value">
            {kycVerified.length} <span className="irm-reports-kpi-sub-count">/ {scopedKycs.length}</span>
          </div>
          <div className="irm-reports-progress-wrap">
            <div className="irm-reports-progress-bar" style={{ width: `${kycClearanceRate}%`, backgroundColor: '#8b5cf6' }} />
          </div>
          <div className="irm-reports-kpi-subtext" style={{ color: '#8b5cf6' }}>
            <CheckCircle2 size={13} /> {kycClearanceRate}% clearance ({kycInReview.length} Under Review)
          </div>
        </div>

        {/* Card 3: Active Opportunities & Average Ticket */}
        <div className="card irm-reports-kpi-card pipeline">
          <div className="irm-reports-kpi-header">
            <span className="irm-reports-kpi-label">ACTIVE OPPORTUNITIES</span>
            <div className="irm-reports-kpi-icon-box pipeline">
              <Briefcase size={18} />
            </div>
          </div>
          <div className="irm-reports-kpi-value">
            {formatCurrency(activePipelineValue)}
          </div>
          <div className="irm-reports-kpi-subtext" style={{ color: '#0284c7' }}>
            <TrendingUp size={13} /> {activeOpps.length} deals • Avg Ticket: {formatCurrency(avgTicketSize)}
          </div>
        </div>

        {/* Card 4: Investor Connect Rate & Adherence */}
        <div className="card irm-reports-kpi-card connect">
          <div className="irm-reports-kpi-header">
            <span className="irm-reports-kpi-label">INVESTOR ENGAGEMENT</span>
            <div className="irm-reports-kpi-icon-box connect">
              <PhoneCall size={18} />
            </div>
          </div>
          <div className="irm-reports-kpi-value">
            {connectRate}%
          </div>
          <div className="irm-reports-kpi-subtext" style={{ color: '#059669' }}>
            <Clock size={13} /> Avg talk: {avgTalkTime} ({connectedCalls.length}/{totalCallsCount} connected)
          </div>
        </div>
      </div>

      {/* ── Segmented Navigation Tabs ── */}
      <div className="irm-reports-tabs-bar">
        <button
          className={`irm-reports-tab-btn ${activeTab === 'capital' ? 'active' : ''}`}
          onClick={() => setActiveTab('capital')}
        >
          <TrendingUp size={15} />
          <span>Capital & Pipeline Analytics</span>
        </button>
        <button
          className={`irm-reports-tab-btn ${activeTab === 'kyc' ? 'active' : ''}`}
          onClick={() => setActiveTab('kyc')}
        >
          <FileCheck size={15} />
          <span>KYC & Compliance Health</span>
          <span className="irm-reports-tab-counter">{scopedKycs.length}</span>
        </button>
        <button
          className={`irm-reports-tab-btn ${activeTab === 'dispositions' ? 'active' : ''}`}
          onClick={() => setActiveTab('dispositions')}
        >
          <FolderArchive size={15} />
          <span>Dispositions & "Other" Analytics</span>
          <span className="irm-reports-tab-counter">{scopedOther.length}</span>
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 1: CAPITAL & PIPELINE ANALYTICS
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'capital' && (
        <div className="irm-reports-tab-content">
          <div className="irm-reports-grid-2col">
            {/* 5-Stage IRM Conversion Funnel */}
            <div className="card irm-reports-card">
              <div className="irm-reports-card-header">
                <div>
                  <h3 className="irm-reports-card-title">IRM End-to-End Conversion Funnel</h3>
                  <p className="irm-reports-card-subtitle">
                    Progression from inbound lead qualification to committed investor capital.
                  </p>
                </div>
                <div className="irm-reports-pill">Live Stage Data</div>
              </div>

              <div className="irm-funnel-list">
                {funnelSteps.map((step, idx) => (
                  <div key={idx} className="irm-funnel-step">
                    <div className="irm-funnel-step-header">
                      <div className="irm-funnel-step-title">
                        <span className="irm-funnel-step-dot" style={{ backgroundColor: step.color }} />
                        <span className="irm-funnel-step-name">{step.label}</span>
                      </div>
                      <div className="irm-funnel-step-stats">
                        <span className="irm-funnel-step-count">{step.count}</span>
                        <span className="irm-funnel-step-pct">({step.pct})</span>
                      </div>
                    </div>
                    <div className="irm-funnel-track">
                      <div
                        className="irm-funnel-fill"
                        style={{
                          width: step.pct,
                          backgroundColor: step.color,
                          transition: 'width 0.6s ease-in-out',
                        }}
                      />
                    </div>
                    <div className="irm-funnel-step-meta">{step.sub}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Ticket Size Distribution */}
            <div className="card irm-reports-card">
              <div className="irm-reports-card-header">
                <div>
                  <h3 className="irm-reports-card-title">Investor Ticket Size Distribution</h3>
                  <p className="irm-reports-card-subtitle">
                    Deal breakdown across HNW investment capacity brackets.
                  </p>
                </div>
                <div className="irm-reports-pill">HNW Brackets</div>
              </div>

              <div className="irm-brackets-list">
                {ticketSizeBrackets.map((bracket, idx) => (
                  <div key={idx} className="irm-bracket-item">
                    <div className="irm-bracket-header">
                      <span className="irm-bracket-label">{bracket.label}</span>
                      <span className="irm-bracket-count">
                        <strong>{bracket.count}</strong> deals ({bracket.pct}%)
                      </span>
                    </div>
                    <div className="irm-bracket-track">
                      <div
                        className="irm-bracket-fill"
                        style={{
                          width: `${bracket.pct}%`,
                          backgroundColor: bracket.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="irm-bracket-summary">
                <div className="irm-bracket-stat">
                  <span className="irm-bracket-stat-label">Total Opportunities Analyzed</span>
                  <span className="irm-bracket-stat-val">{periodOpps.length} deals</span>
                </div>
                <div className="irm-bracket-stat">
                  <span className="irm-bracket-stat-label">Average Investment Value</span>
                  <span className="irm-bracket-stat-val" style={{ color: '#059669' }}>
                    {formatCurrency(avgTicketSize)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Asset Class Allocation Row */}
          <div className="card irm-reports-card" style={{ marginTop: 20 }}>
            <div className="irm-reports-card-header">
              <div>
                <h3 className="irm-reports-card-title">Asset Class Capital Allocation</h3>
                <p className="irm-reports-card-subtitle">
                  Committed and targeted capital distribution across private market products.
                </p>
              </div>
              <div className="irm-reports-pill">Private Markets</div>
            </div>

            {assetClassBreakdown.length === 0 ? (
              <div className="irm-empty-state">
                <PieChart size={32} color="var(--text-muted)" />
                <p>No investment opportunity records logged for this period.</p>
              </div>
            ) : (
              <div className="irm-asset-grid">
                {assetClassBreakdown.map((item, idx) => (
                  <div key={idx} className="irm-asset-card">
                    <div className="irm-asset-header">
                      <span className="irm-asset-dot" style={{ backgroundColor: item.color }} />
                      <span className="irm-asset-title">{item.name}</span>
                    </div>
                    <div className="irm-asset-val">
                      {formatCurrency(item.value)}
                    </div>
                    <div className="irm-asset-meta">
                      <span>{item.count} opportunities</span>
                      <span className="irm-asset-pct">{item.pct}% share</span>
                    </div>
                    <div className="irm-asset-track">
                      <div
                        className="irm-asset-fill"
                        style={{ width: `${item.pct}%`, backgroundColor: item.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 2: KYC & COMPLIANCE HEALTH
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'kyc' && (
        <div className="irm-reports-tab-content">
          <div className="irm-reports-grid-2col">
            {/* SEBI Compliance Status Card */}
            <div className="card irm-reports-card">
              <div className="irm-reports-card-header">
                <div>
                  <h3 className="irm-reports-card-title">SEBI KYC Verification Status</h3>
                  <p className="irm-reports-card-subtitle">
                    Live verification lifecycle of assigned prospective investors.
                  </p>
                </div>
                <div className="irm-reports-pill" style={{ color: '#059669', borderColor: '#10b981' }}>
                  {kycClearanceRate}% Clearance
                </div>
              </div>

              <div className="irm-kyc-status-grid">
                <div className="irm-kyc-status-box verified">
                  <div className="irm-kyc-status-label">Verified (SEBI Compliant)</div>
                  <div className="irm-kyc-status-num">{kycVerified.length}</div>
                  <div className="irm-kyc-status-bar">
                    <div
                      style={{
                        width: `${scopedKycs.length ? (kycVerified.length / scopedKycs.length) * 100 : 0}%`,
                        backgroundColor: '#10b981',
                      }}
                    />
                  </div>
                </div>

                <div className="irm-kyc-status-box review">
                  <div className="irm-kyc-status-label">Under Compliance Review</div>
                  <div className="irm-kyc-status-num">{kycInReview.length}</div>
                  <div className="irm-kyc-status-bar">
                    <div
                      style={{
                        width: `${scopedKycs.length ? (kycInReview.length / scopedKycs.length) * 100 : 0}%`,
                        backgroundColor: '#f59e0b',
                      }}
                    />
                  </div>
                </div>

                <div className="irm-kyc-status-box pending">
                  <div className="irm-kyc-status-label">Documentation Initiated</div>
                  <div className="irm-kyc-status-num">{kycPending.length}</div>
                  <div className="irm-kyc-status-bar">
                    <div
                      style={{
                        width: `${scopedKycs.length ? (kycPending.length / scopedKycs.length) * 100 : 0}%`,
                        backgroundColor: '#06b6d4',
                      }}
                    />
                  </div>
                </div>

                <div className="irm-kyc-status-box rejected">
                  <div className="irm-kyc-status-label">Rejected / Clarification Needed</div>
                  <div className="irm-kyc-status-num">{kycRejected.length}</div>
                  <div className="irm-kyc-status-bar">
                    <div
                      style={{
                        width: `${scopedKycs.length ? (kycRejected.length / scopedKycs.length) * 100 : 0}%`,
                        backgroundColor: '#ef4444',
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Document Checklist Health Card */}
            <div className="card irm-reports-card">
              <div className="irm-reports-card-header">
                <div>
                  <h3 className="irm-reports-card-title">Investor Documentation Checklist</h3>
                  <p className="irm-reports-card-subtitle">
                    Mandatory SEBI KYC documents validated across investor dossiers.
                  </p>
                </div>
                <div className="irm-reports-pill">SEBI Compliant</div>
              </div>

              <div className="irm-doc-health-list">
                {[
                  { label: 'PAN Card Verification', key: 'panDocumentUrl', fallbackKey: 'panNumber', icon: <FileCheck size={16} /> },
                  { label: 'Aadhaar / Address Proof', key: 'aadhaarDocumentUrl', fallbackKey: 'aadhaarNumber', icon: <Shield size={16} /> },
                  { label: 'Bank Account & Cheque Copy', key: 'bankChequeUrl', fallbackKey: 'accountNumber', icon: <DollarSign size={16} /> },
                  { label: 'Demat / CMR Client Master', key: 'dematDocumentUrl', fallbackKey: 'dematAccountNumber', icon: <Layers size={16} /> },
                ].map((doc, idx) => {
                  const verifiedCount = scopedKycs.filter(k => k[doc.key] || k[doc.fallbackKey]).length;
                  const pct = scopedKycs.length > 0 ? Math.round((verifiedCount / scopedKycs.length) * 100) : 0;
                  return (
                    <div key={idx} className="irm-doc-health-item">
                      <div className="irm-doc-health-icon">{doc.icon}</div>
                      <div className="irm-doc-health-body">
                        <div className="irm-doc-health-top">
                          <span className="irm-doc-health-name">{doc.label}</span>
                          <span className="irm-doc-health-val">{verifiedCount} of {scopedKycs.length} ({pct}%)</span>
                        </div>
                        <div className="irm-doc-health-track">
                          <div className="irm-doc-health-fill" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="irm-kyc-tat-box">
                <Clock size={16} color="#8b5cf6" />
                <div>
                  <strong>Average Verification Turnaround:</strong> ~1.8 Business Days
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 3: DISPOSITIONS & "OTHER" ANALYTICS
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'dispositions' && (
        <div className="irm-reports-tab-content">
          <div className="irm-reports-grid-2col">
            {/* Call Center Outcomes Distribution */}
            <div className="card irm-reports-card">
              <div className="irm-reports-card-header">
                <div>
                  <h3 className="irm-reports-card-title">IRM Call Outcome Distribution</h3>
                  <p className="irm-reports-card-subtitle">
                    Telemetry from logged investor outreach and consultations.
                  </p>
                </div>
                <div className="irm-reports-pill">{periodCalls.length} Total Calls</div>
              </div>

              {callDispositions.length === 0 ? (
                <div className="irm-empty-state">
                  <PhoneCall size={32} color="var(--text-muted)" />
                  <p>No calls logged in this period.</p>
                </div>
              ) : (
                <div className="irm-dispo-list">
                  {callDispositions.map((disp, idx) => (
                    <div key={idx} className="irm-dispo-row">
                      <div className="irm-dispo-left">
                        <span className="irm-dispo-dot" style={{ backgroundColor: disp.color }} />
                        <span className="irm-dispo-name">{disp.name}</span>
                      </div>
                      <div className="irm-dispo-track-wrap">
                        <div
                          className="irm-dispo-track-fill"
                          style={{ width: `${disp.pct}%`, backgroundColor: disp.color }}
                        />
                      </div>
                      <div className="irm-dispo-right">
                        <strong>{disp.count}</strong>
                        <span className="irm-dispo-pct">({disp.pct}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* "Other" Module Sub-Reasons Analysis */}
            <div className="card irm-reports-card">
              <div className="irm-reports-card-header">
                <div>
                  <h3 className="irm-reports-card-title">"Other" Module Sub-Reason Breakdown</h3>
                  <p className="irm-reports-card-subtitle">
                    Reason telemetry for leads & investors moved to the Other repository.
                  </p>
                </div>
                <div className="irm-reports-pill" style={{ color: '#d97706', borderColor: '#f59e0b' }}>
                  {otherModuleBreakdown.total} Dispositions
                </div>
              </div>

              {otherModuleBreakdown.reasons.length === 0 ? (
                <div className="irm-empty-state">
                  <FolderArchive size={32} color="var(--text-muted)" />
                  <p>No records have been moved to the "Other" module yet.</p>
                </div>
              ) : (
                <div className="irm-other-analytics-wrap">
                  <div className="irm-other-reasons-list">
                    {otherModuleBreakdown.reasons.map((r, idx) => (
                      <div key={idx} className="irm-other-reason-row">
                        <div className="irm-other-reason-header">
                          <span className="irm-other-reason-title">{r.reason}</span>
                          <span className="irm-other-reason-count">
                            <strong>{r.count}</strong> cases ({r.pct}%)
                          </span>
                        </div>
                        <div className="irm-other-reason-track">
                          <div
                            className="irm-other-reason-fill"
                            style={{ width: `${r.pct}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="irm-other-origins-box">
                    <span className="irm-other-origins-title">Originating IRM Workflow Modules:</span>
                    <div className="irm-other-origins-tags">
                      {otherModuleBreakdown.modules.map((m, idx) => (
                        <div key={idx} className="irm-other-origin-tag">
                          <span>{m.mod}</span>
                          <strong>{m.count}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
