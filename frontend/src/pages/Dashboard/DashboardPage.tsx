import React, { useState, useEffect } from 'react';
import {
  Users,
  Clock,
  PhoneCall,
  TrendingUp,
  MapPin,
  Calendar,
  AlertCircle,
  ArrowUpRight,
  Phone,
  Plus,
  PhoneMissed,
  Briefcase,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { storageService } from '../../services/storageService';
import { StatusChip } from '../../components/common/StatusChip';
import { FEATURES } from '../../constants/features';
import './DashboardPage.css';

interface DashboardPageProps {
  onNavigate: (route: string) => void;
  onOpenQuickCreate: (type: 'lead' | 'followup' | 'deal' | 'visit' | 'consultation') => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate, onOpenQuickCreate }) => {
  const { user, tenant, enabledFeatures } = useAuth();
  const { initiateCall } = useCall();

  const [leads, setLeads] = useState(storageService.getLeads(tenant?.id));
  const [deals, setDeals] = useState(storageService.getDeals(tenant?.id));
  const [calls, setCalls] = useState(storageService.getCalls(tenant?.id));
  const [followups, setFollowups] = useState(storageService.getFollowups(tenant?.id));
  const [plots, setPlots] = useState(storageService.getPlots());
  const [consultations, setConsultations] = useState(storageService.getConsultations(tenant?.id));
  const [investors, setInvestors] = useState(storageService.getInvestors(tenant?.id));
  const [opportunities, setOpportunities] = useState(storageService.getOpportunities(tenant?.id));

  // Sync with storage updates
  useEffect(() => {
    const handleUpdate = () => {
      setLeads(storageService.getLeads(tenant?.id));
      setDeals(storageService.getDeals(tenant?.id));
      setCalls(storageService.getCalls(tenant?.id));
      setFollowups(storageService.getFollowups(tenant?.id));
      setPlots(storageService.getPlots());
      setConsultations(storageService.getConsultations(tenant?.id));
      setInvestors(storageService.getInvestors(tenant?.id));
      setOpportunities(storageService.getOpportunities(tenant?.id));
    };
    window.addEventListener('nexus_storage_updated', handleUpdate);
    return () => window.removeEventListener('nexus_storage_updated', handleUpdate);
  }, [tenant?.id]);

  // ── Role-based scoping (Task 2 & IRM) ────────────────────────────────────
  const roleCode = user?.role?.code;
  const isExec = roleCode === 'sales_executive';
  const isIrm = roleCode === 'irm';

  const scopedLeads = isExec
    ? leads.filter(l =>
      (l.assignedAgentId && l.assignedAgentId === user?.id) ||
      (l.assignedAgentName && l.assignedAgentName === user?.name)
    )
    : leads;

  const scopedDeals = isExec
    ? deals.filter(d =>
      (d.assignedAgentId && d.assignedAgentId === user?.id) ||
      (d.assignedAgentName && d.assignedAgentName === user?.name)
    )
    : deals;

  const scopedCalls = isExec
    ? calls.filter(c =>
      (c.agentId && c.agentId === user?.id) ||
      (c.agentName && c.agentName === user?.name)
    )
    : calls;

  const scopedFollowups = isExec
    ? followups.filter(f =>
      (f.assignedAgentId && f.assignedAgentId === user?.id) ||
      (f.assignedAgentName && f.assignedAgentName === user?.name)
    )
    : followups;

  // Investor domain scoping for IRM (and isExec if applicable)
  const scopedInvestors = (isIrm || isExec)
    ? investors.filter(inv =>
      (inv.assignedAgentId && inv.assignedAgentId === user?.id) ||
      (inv.assignedAgentName && inv.assignedAgentName === user?.name)
    )
    : investors;

  const scopedOpportunities = (isIrm || isExec)
    ? opportunities.filter(o =>
      (o.assignedAgentId && o.assignedAgentId === user?.id) ||
      (o.assignedAgentName && o.assignedAgentName === user?.name) ||
      scopedInvestors.some(inv => inv.id === o.investorId)
    )
    : opportunities;

  const scopedConsultations = (isIrm || isExec)
    ? consultations.filter(c =>
      (c.consultantId && c.consultantId === user?.id) ||
      (c.consultantName && c.consultantName === user?.name) ||
      scopedInvestors.some(inv => inv.id === c.investorId)
    )
    : consultations;

  // ── Derived metrics ──────────────────────────────────────────────────────
  const totalPipelineValue = scopedDeals.reduce((sum, d) => sum + (d.value || 0), 0);
  const overdueFollowups = scopedFollowups.filter(
    f => f.status === 'Pending' && f.scheduledAt.toLowerCase().includes('yesterday')
  );
  const pendingFollowups = scopedFollowups.filter(f => f.status === 'Pending');

  // Task 1a — real "+N this week" delta from scopedLeads.createdAt
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const leadsThisWeek = scopedLeads.filter(l => {
    if (!l.createdAt) return false;
    const d = new Date(l.createdAt);
    return !isNaN(d.getTime()) && d.getTime() >= sevenDaysAgo;
  }).length;

  // IRM Derived Metrics
  const parseAumToNumber = (val?: string): number => {
    if (!val) return 0;
    const clean = val.replace(/₹|,|\s/g, '').trim();
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

  const totalCommittedAUM = scopedInvestors.reduce(
    (sum, inv) => sum + parseAumToNumber(inv.committedAUM),
    0
  );

  const activeOpportunities = scopedOpportunities.filter(
    o => o.stage !== 'Closed Lost' && o.stage !== 'Closed Won'
  );
  const committedOppsCount = scopedOpportunities.filter(o => o.stage === 'Committed').length;
  const pipelineOppsCount = activeOpportunities.length - committedOppsCount;

  const upcomingConsultations = scopedConsultations.filter(c => c.status === 'Scheduled');

  const investorsThisWeek = scopedInvestors.filter(inv => {
    if (!inv.createdAt) return false;
    const d = new Date(inv.createdAt);
    return !isNaN(d.getTime()) && d.getTime() >= sevenDaysAgo;
  }).length;

  // Task 1b — real avg-duration from scopedCalls (same formula as ReportsPage)
  const formatDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
  };
  const connectedCalls = scopedCalls.filter(c => c.duration > 0);
  const totalConnectedDuration = connectedCalls.reduce((sum, c) => sum + (c.duration || 0), 0);
  const avgDuration =
    connectedCalls.length > 0
      ? formatDuration(Math.round(totalConnectedDuration / connectedCalls.length))
      : '0s';

  // Task 4 — missed calls: duration === 0 or disposition === 'No Response'
  const missedCalls = scopedCalls.filter(
    c => c.duration === 0 || c.disposition === 'No Response'
  ).length;

  // Format currency
  const formatCurrency = (val: number) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)} L`;
    return `₹${val.toLocaleString('en-IN')}`;
  };

  // ── Task 3 & IRM — label helpers ─────────────────────────────────────────
  const label = {
    activeleads: isExec ? 'MY ACTIVE LEADS' : 'ACTIVE LEADS',
    pendingfollowups: isExec ? 'MY PENDING FOLLOW-UPS' : 'PENDING FOLLOW-UPS',
    callslogged: isExec ? 'MY CALLS LOGGED' : 'CALLS LOGGED',
    pipelinevalue: isExec ? 'MY PIPELINE VALUE' : 'PIPELINE VALUE',
    investorsKpi: 'MY ASSIGNED INVESTORS',
    bannerSubtitle: isIrm
      ? "Here's your high-net-worth investor portfolio, active opportunities, and advisory schedule."
      : isExec
      ? "Here's your personal pipeline, assigned leads, and today's action items."
      : 'Here is your daily pipeline, incoming inquiries, and pending action items for today.',
    recentLeads: isExec ? 'My Recent Leads' : 'Recent Inbound Leads',
    recentInvestors: 'My Recent Investors',
    followupsTable: isIrm
      ? 'Upcoming Investor Consultations'
      : isExec
      ? 'My Follow-ups & Reminders'
      : 'Scheduled Reminders & Follow-ups',
  };

  return (
    <div className="dashboard-page-container">
      {/* Header Banner */}
      <div className="card dashboard-banner">
        <div>
          <div className="dashboard-banner-tag">
            {tenant?.name} • OPERATIONAL SNAPSHOT
          </div>
          <h1 className="dashboard-banner-title">
            Welcome back, {user?.name.split(' ')[0]} 👋
          </h1>
          <p className="dashboard-banner-subtitle">
            {label.bannerSubtitle}
          </p>
        </div>

        <div className="dashboard-banner-actions">
          {isIrm ? (
            <>
              <button
                className="btn btn-secondary btn-sm dashboard-banner-btn-secondary"
                onClick={() => onNavigate('investors')}
              >
                <Users size={14} /> View Investors
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => onOpenQuickCreate('consultation')}
              >
                <Calendar size={14} /> Book Consultation
              </button>
            </>
          ) : (
            <>
              <button
                className="btn btn-secondary btn-sm dashboard-banner-btn-secondary"
                onClick={() => onOpenQuickCreate('lead')}
              >
                <Plus size={14} /> Quick Lead
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => onOpenQuickCreate('followup')}
              >
                <Calendar size={14} /> Log Follow-up
              </button>
            </>
          )}
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="dashboard-kpi-grid">
        {isIrm ? (
          <>
            {/* IRM Card 1: Total Investors */}
            <div className="card card-hover dashboard-kpi-card" onClick={() => onNavigate('investors')}>
              <div className="dashboard-kpi-header">
                <span className="dashboard-kpi-label">{label.investorsKpi}</span>
                <div className="dashboard-kpi-icon-box leads">
                  <Users size={18} />
                </div>
              </div>
              <div className="dashboard-kpi-value">
                {scopedInvestors.length}
              </div>
              <div className="dashboard-kpi-delta-positive">
                <ArrowUpRight size={14} /> +{investorsThisWeek} this week
              </div>
            </div>

            {/* IRM Card 2: Active Opportunities */}
            <div className="card card-hover dashboard-kpi-card" onClick={() => onNavigate('opportunities')}>
              <div className="dashboard-kpi-header">
                <span className="dashboard-kpi-label">ACTIVE OPPORTUNITIES</span>
                <div className="dashboard-kpi-icon-box deals">
                  <TrendingUp size={18} />
                </div>
              </div>
              <div className="dashboard-kpi-value">
                {activeOpportunities.length}
              </div>
              <div className="dashboard-kpi-deals-stat">
                {committedOppsCount > 0
                  ? `${committedOppsCount} Committed • ${pipelineOppsCount} In Pipeline`
                  : `${activeOpportunities.length} open opportunities`}
              </div>
            </div>

            {/* IRM Card 3: Upcoming Consultations */}
            <div className="card card-hover dashboard-kpi-card" onClick={() => onNavigate('consultations')}>
              <div className="dashboard-kpi-header">
                <span className="dashboard-kpi-label">UPCOMING CONSULTATIONS</span>
                <div className="dashboard-kpi-icon-box consultations">
                  <Calendar size={18} />
                </div>
              </div>
              <div className="dashboard-kpi-value">
                {upcomingConsultations.length}
              </div>
              <div className="dashboard-kpi-consultations-stat">
                {upcomingConsultations.length > 0 ? `${upcomingConsultations.length} upcoming this week` : 'No upcoming this week'}
              </div>
            </div>

            {/* IRM Card 4: Committed AUM */}
            <div className="card card-hover dashboard-kpi-card" onClick={() => onNavigate('investors')}>
              <div className="dashboard-kpi-header">
                <span className="dashboard-kpi-label">COMMITTED AUM</span>
                <div className="dashboard-kpi-icon-box plots">
                  <Briefcase size={18} />
                </div>
              </div>
              <div className="dashboard-kpi-value">
                {formatCurrency(totalCommittedAUM)}
              </div>
              <div className="dashboard-kpi-plots-stat">
                Across {scopedInvestors.length} assigned investors
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Card 1: Active Leads */}
            <div className="card card-hover dashboard-kpi-card" onClick={() => onNavigate('leads')}>
              <div className="dashboard-kpi-header">
                <span className="dashboard-kpi-label">{label.activeleads}</span>
                <div className="dashboard-kpi-icon-box leads">
                  <Users size={18} />
                </div>
              </div>
              <div className="dashboard-kpi-value">
                {scopedLeads.length}
              </div>
              <div className="dashboard-kpi-delta-positive">
                <ArrowUpRight size={14} /> +{leadsThisWeek} this week
              </div>
            </div>

            {/* Card 2: Follow-ups */}
            <div className="card card-hover dashboard-kpi-card" onClick={() => onNavigate('followups')}>
              <div className="dashboard-kpi-header">
                <span className="dashboard-kpi-label">{label.pendingfollowups}</span>
                <div className="dashboard-kpi-icon-box followups">
                  <Clock size={18} />
                </div>
              </div>
              <div className="dashboard-kpi-value">
                {pendingFollowups.length}
              </div>
              <div className={`dashboard-kpi-followup-status ${overdueFollowups.length > 0 ? 'overdue' : 'on-time'}`}>
                {overdueFollowups.length > 0 ? (
                  <>
                    <AlertCircle size={14} /> {overdueFollowups.length} overdue item!
                  </>
                ) : (
                  'All scheduled on time'
                )}
              </div>
            </div>

            {/* Card 3: Calls Logged */}
            <div className="card card-hover dashboard-kpi-card" onClick={() => onNavigate('call-history')}>
              <div className="dashboard-kpi-header">
                <span className="dashboard-kpi-label">{label.callslogged}</span>
                <div className="dashboard-kpi-icon-box calls">
                  <PhoneCall size={18} />
                </div>
              </div>
              <div className="dashboard-kpi-value">
                {scopedCalls.length}
              </div>
              {/* Task 4 — Missed Calls inline stat for Sales Executive */}
              {isExec ? (
                <div className="dashboard-kpi-exec-row">
                  <span className="dashboard-kpi-subtext">
                    Avg duration: {avgDuration}
                  </span>
                  <span className={`dashboard-missed-pill ${missedCalls > 0 ? 'has-missed' : 'none'}`}>
                    <PhoneMissed size={11} />
                    {missedCalls} missed
                  </span>
                </div>
              ) : (
                <div className="dashboard-kpi-subtext">
                  Avg duration: {avgDuration}
                </div>
              )}
            </div>

            {/* Card 4: Pipeline Value */}
            {!isExec && (
              <div className="card card-hover dashboard-kpi-card" onClick={() => onNavigate('pipeline')}>
                <div className="dashboard-kpi-header">
                  <span className="dashboard-kpi-label">{label.pipelinevalue}</span>
                  <div className="dashboard-kpi-icon-box deals">
                    <TrendingUp size={18} />
                  </div>
                </div>
                <div className="dashboard-kpi-value">
                  {formatCurrency(totalPipelineValue)}
                </div>
                <div className="dashboard-kpi-deals-stat">
                  {scopedDeals.length} active deals
                </div>
              </div>
            )}

            {/* Tenant Specific 5th Card — plots (not scoped per-agent per spec) */}
            {enabledFeatures.includes(FEATURES.PROPERTIES) && (
              <div className="card card-hover dashboard-kpi-card" onClick={() => onNavigate('plots')}>
                <div className="dashboard-kpi-header">
                  <span className="dashboard-kpi-label">PLOT INVENTORY</span>
                  <div className="dashboard-kpi-icon-box plots">
                    <MapPin size={18} />
                  </div>
                </div>
                <div className="dashboard-kpi-value">
                  {plots.filter(p => p.status === 'Available').length}{' '}
                  <span className="dashboard-kpi-plots-total">/ {plots.length}</span>
                </div>
                <div className="dashboard-kpi-plots-stat">
                  {plots.filter(p => p.status === 'Hold').length} currently on Hold
                </div>
              </div>
            )}

            {enabledFeatures.includes(FEATURES.INVESTORS) && (
              <div className="card card-hover dashboard-kpi-card" onClick={() => onNavigate('consultations')}>
                <div className="dashboard-kpi-header">
                  <span className="dashboard-kpi-label">CONSULTATIONS</span>
                  <div className="dashboard-kpi-icon-box consultations">
                    <Calendar size={18} />
                  </div>
                </div>
                <div className="dashboard-kpi-value">
                  {consultations.length}
                </div>
                <div className="dashboard-kpi-consultations-stat">
                  {consultations.filter(c => c.status === 'Scheduled').length} upcoming this week
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Main Split Row: Recent Inquiries & Actionable Followups */}
      <div className="dashboard-split-grid">
        {isIrm ? (
          /* Recent Investors Table for IRM */
          <div className="card dashboard-split-card">
            <div className="dashboard-split-header">
              <div>
                <h3 className="dashboard-split-title">{label.recentInvestors}</h3>
                <p className="dashboard-split-subtitle">High-net-worth portfolio relationships</p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('investors')}>
                View All Investors &rarr;
              </button>
            </div>

            <div className="dashboard-table-container">
              <table className="dashboard-table">
                <thead>
                  <tr className="dashboard-table-thead-tr">
                    <th className="dashboard-table-th">Investor</th>
                    <th className="dashboard-table-th">Status</th>
                    <th className="dashboard-table-th">Committed AUM</th>
                    <th className="dashboard-table-th right">Quick Call</th>
                  </tr>
                </thead>
                <tbody>
                  {scopedInvestors.slice(0, 4).map(inv => (
                    <tr key={inv.id} className="dashboard-table-tbody-tr">
                      <td className="dashboard-table-td">
                        <div className="dashboard-contact-name">{inv.name}</div>
                        <div className="dashboard-contact-meta">{inv.phone}{isExec ? '' : ` • ${inv.preferredAssetClass || 'Equity & Commercial'}`}</div>
                      </td>
                      <td className="dashboard-table-td">
                        <StatusChip status={inv.status} size="sm" />
                      </td>
                      <td className="dashboard-table-td">
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>
                          {inv.committedAUM || inv.investmentCapacity || '—'}
                        </span>
                      </td>
                      <td className="dashboard-table-td right">
                        <button
                          className="btn btn-call btn-sm btn-icon dashboard-call-btn"
                          title={`Call ${inv.name}`}
                          onClick={() => initiateCall(inv.name, inv.phone, 'customer', inv.id)}
                        >
                          <Phone size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {scopedInvestors.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                        No assigned investors found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Recent Leads Table for Non-IRM */
          <div className="card dashboard-split-card">
            <div className="dashboard-split-header">
              <div>
                <h3 className="dashboard-split-title">{label.recentLeads}</h3>
                <p className="dashboard-split-subtitle">Click phone icon to dial immediately</p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('leads')}>
                View All Leads &rarr;
              </button>
            </div>

            <div className="dashboard-table-container">
              <table className="dashboard-table">
                <thead>
                  <tr className="dashboard-table-thead-tr">
                    <th className="dashboard-table-th">Contact</th>
                    <th className="dashboard-table-th">Status</th>
                    <th className="dashboard-table-th">Priority</th>
                    <th className="dashboard-table-th right">Quick Call</th>
                  </tr>
                </thead>
                <tbody>
                  {scopedLeads.slice(0, 4).map(l => (
                    <tr key={l.id} className="dashboard-table-tbody-tr">
                      <td className="dashboard-table-td">
                        <div className="dashboard-contact-name">{l.name}</div>
                        <div className="dashboard-contact-meta">{l.phone} • {l.location}</div>
                      </td>
                      <td className="dashboard-table-td">
                        <StatusChip status={l.status} size="sm" />
                      </td>
                      <td className="dashboard-table-td">
                        <StatusChip status={l.priority} size="sm" />
                      </td>
                      <td className="dashboard-table-td right">
                        <button
                          className="btn btn-call btn-sm btn-icon dashboard-call-btn"
                          title={`Call ${l.name}`}
                          onClick={() => initiateCall(l.name, l.phone, 'lead', l.id)}
                        >
                          <Phone size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {isIrm ? (
          /* Upcoming Investor Consultations for IRM */
          <div className="card dashboard-split-card">
            <div className="dashboard-split-header">
              <div>
                <h3 className="dashboard-split-title">{label.followupsTable}</h3>
                <p className="dashboard-split-subtitle">Scheduled advisory & portfolio sessions</p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('consultations')}>
                View All &rarr;
              </button>
            </div>

            <div className="dashboard-followups-list">
              {upcomingConsultations.slice(0, 4).map(c => (
                <div key={c.id} className="dashboard-followup-item">
                  <div>
                    <div className="dashboard-followup-contact">
                      <span className="dashboard-followup-name">{c.investorName}</span>
                      <StatusChip status={c.status} size="sm" />
                    </div>
                    <p className="dashboard-followup-notes">
                      {c.agenda}
                    </p>
                    <div className="dashboard-followup-schedule">
                      ⏰ {c.scheduledAt} • Advisor: {c.consultantName}
                    </div>
                  </div>

                  <button
                    className="btn btn-call btn-sm"
                    onClick={() => initiateCall(c.investorName, c.investorPhone, 'customer', c.investorId)}
                  >
                    <Phone size={13} /> Call
                  </button>
                </div>
              ))}
              {upcomingConsultations.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                  No upcoming consultations scheduled
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Due Follow-ups & Reminders for Non-IRM */
          <div className="card dashboard-split-card">
            <div className="dashboard-split-header">
              <div>
                <h3 className="dashboard-split-title">{label.followupsTable}</h3>
                <p className="dashboard-split-subtitle">Critical agent engagement tasks</p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('followups')}>
                View All &rarr;
              </button>
            </div>

            <div className="dashboard-followups-list">
              {scopedFollowups.slice(0, 4).map(f => (
                <div key={f.id} className="dashboard-followup-item">
                  <div>
                    <div className="dashboard-followup-contact">
                      <span className="dashboard-followup-name">{f.contactName}</span>
                      <StatusChip status={f.priority} size="sm" />
                    </div>
                    <p className="dashboard-followup-notes">
                      {f.notes}
                    </p>
                    <div className="dashboard-followup-schedule">
                      ⏰ {f.scheduledAt} • Assignee: {f.assignedAgentName}
                    </div>
                  </div>

                  <button
                    className="btn btn-call btn-sm"
                    onClick={() => initiateCall(f.contactName, f.contactPhone, 'lead', f.contactId)}
                  >
                    <Phone size={13} /> Call Now
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};