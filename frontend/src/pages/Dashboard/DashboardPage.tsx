import React, { useState, useEffect, useCallback } from 'react';
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
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { leadsApi, followupsApi, consultationsApi, customersApi, callsApi } from '../../services/crmApi';
import { StatusChip } from '../../components/common/StatusChip';
import { Lead, Followup, Consultation, Customer, CallRecord } from '../../types';
import './DashboardPage.css';

interface DashboardPageProps {
  onNavigate: (route: string) => void;
  onOpenQuickCreate: (type: 'lead' | 'followup' | 'deal' | 'visit' | 'consultation') => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate, onOpenQuickCreate }) => {
  const { user, tenant } = useAuth();
  const { initiateCall } = useCall();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const roleCode = user?.role?.code;
  const isExec = roleCode === 'sales_executive';
  const isIrm = roleCode === 'irm';

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const emptyPaged = { items: [], totalCount: 0, page: 1, pageSize: 50, totalPages: 0 };
      const [leadsRes, fwRes, cnsRes, custRes, callsRes] = await Promise.all([
        leadsApi.getActiveLeads({ pageSize: 50 }).catch(() => emptyPaged),
        followupsApi.getFollowups({ status: 'Pending', scope: isExec ? undefined : 'all', pageSize: 50 }).catch(() => emptyPaged),
        consultationsApi.getConsultations({ pageSize: 50 }).catch(() => emptyPaged),
        customersApi.getCustomers({ pageSize: 50 }).catch(() => emptyPaged),
        callsApi.getCalls({ pageSize: 50 }).catch(() => emptyPaged),
      ]);

      // Map Leads
      if (leadsRes?.items) {
        const raw = leadsRes.items;
        setLeads(
          raw.map((l: any) => ({
            id: String(l.id),
            tenantId: String(tenant?.id || ''),
            companyId: String(l.companyId || tenant?.id || ''),
            name: l.name || '',
            phone: l.phone || '',
            email: l.email || '',
            location: l.location || '',
            status: l.status || 'New',
            priority: l.priority || 'Medium',
            source: l.source || 'Direct',
            assignedAgentId: String(l.assignedAgentId || ''),
            assignedAgentName: l.assignedAgentName || 'Unassigned',
            notes: l.notes || '',
            customFields: l.customFields || {},
            createdAt: l.createdAt ? new Date(l.createdAt).toLocaleDateString('en-IN') : '—',
          }))
        );
      }

      // Map Followups
      if (fwRes?.items) {
        const raw = fwRes.items;
        setFollowups(
          raw.map((f: any) => ({
            id: String(f.id),
            tenantId: String(tenant?.id || ''),
            companyId: String(tenant?.id || ''),
            contactName: f.contactName || 'Contact',
            contactPhone: f.contactPhone || '',
            contactType: f.contactType || 'lead',
            contactId: f.contactId ? String(f.contactId) : '',
            assignedAgentId: String(f.assignedAgentId || ''),
            assignedAgentName: f.assignedAgentName || 'Agent',
            scheduledAt: f.scheduledAt ? new Date(f.scheduledAt).toLocaleString('en-IN') : 'Scheduled',
            notes: f.notes || '',
            priority: f.priority || 'Medium',
            status: f.status || 'Pending',
          }))
        );
      }

      // Map Consultations
      if (cnsRes?.items) {
        const raw = cnsRes.items;
        setConsultations(
          raw.map((c: any) => ({
            id: String(c.id),
            companyId: String(tenant?.id || ''),
            investorId: String(c.investorId || ''),
            investorName: c.investorName || 'Investor',
            investorPhone: c.investorPhone || '',
            consultantId: String(c.consultantId || ''),
            consultantName: c.consultantName || 'Consultant',
            scheduledAt: c.scheduledAt ? new Date(c.scheduledAt).toLocaleString('en-IN') : 'Scheduled',
            status: c.status || 'Scheduled',
            agenda: c.agenda || '',
            outcomeNotes: c.outcomeNotes || '',
          }))
        );
      }

      // Map Customers
      if (custRes?.items) {
        const raw = custRes.items;
        setCustomers(
          raw.map((c: any) => ({
            id: String(c.id),
            companyId: String(tenant?.id || ''),
            name: c.name || '',
            phone: c.phone || '',
            email: c.email || '',
            status: c.status || 'Active',
            assignedAgentId: String(c.assignedAgentId || ''),
            assignedAgentName: c.assignedAgentName || 'Agent',
            location: c.location || '',
            lastContacted: c.lastContacted ? new Date(c.lastContacted).toISOString().split('T')[0] : '—',
            openDealsCount: c.openDealsCount || 0,
            totalValue: Number(c.totalValue || 0),
            createdAt: c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-IN') : '—',
            notes: c.notes || '',
            customFields: c.customFields || {},
          }))
        );
      }

      // Map Calls
      if (callsRes?.items) {
        const raw = callsRes.items;
        setCalls(
          raw.map((c: any) => ({
            id: String(c.id),
            tenantId: String(tenant?.id || ''),
            companyId: String(tenant?.id || ''),
            contactName: c.contactName || '',
            contactPhone: c.contactPhone || '',
            agentId: String(c.agentId || ''),
            agentName: c.agentName || 'Agent',
            direction: (c.direction || 'outbound').toLowerCase() as any,
            duration: Number(c.duration || 0),
            disposition: c.disposition || 'Interested',
            timestamp: c.timestamp ? new Date(c.timestamp).toLocaleString('en-IN') : 'Just now',
            notes: c.notes || '',
          }))
        );
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard metrics from backend API');
    } finally {
      setLoading(false);
    }
  }, [tenant?.id, isExec]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Scoped lists
  const scopedLeads = isExec
    ? leads.filter(
        l =>
          (l.assignedAgentId && l.assignedAgentId === user?.id) ||
          (l.assignedAgentName && l.assignedAgentName === user?.name)
      )
    : leads;

  const scopedCalls = isExec
    ? calls.filter(
        c =>
          (c.agentId && c.agentId === user?.id) ||
          (c.agentName && c.agentName === user?.name)
      )
    : calls;

  const scopedFollowups = isExec
    ? followups.filter(
        f =>
          (f.assignedAgentId && f.assignedAgentId === user?.id) ||
          (f.assignedAgentName && f.assignedAgentName === user?.name)
      )
    : followups;

  const scopedCustomers = isExec
    ? customers.filter(
        c =>
          (c.assignedAgentId && c.assignedAgentId === user?.id) ||
          (c.assignedAgentName && c.assignedAgentName === user?.name)
      )
    : customers;

  const scopedConsultations = isIrm || isExec
    ? consultations.filter(
        c =>
          (c.consultantId && c.consultantId === user?.id) ||
          (c.consultantName && c.consultantName === user?.name)
      )
    : consultations;

  // Derived metrics
  const totalPipelineValue = scopedCustomers.reduce((sum, c) => sum + (c.totalValue || 0), 0);
  const pendingFollowups = scopedFollowups.filter(f => f.status === 'Pending');
  const overdueFollowups = scopedFollowups.filter(
    f => f.status === 'Pending' && (f.scheduledAt || '').toLowerCase().includes('yesterday')
  );

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

  const missedCalls = scopedCalls.filter(
    c => c.duration === 0 || c.disposition === 'No Response'
  ).length;

  const formatCurrency = (val: number) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)} L`;
    return `₹${val.toLocaleString('en-IN')}`;
  };

  const label = {
    activeleads: isExec ? 'MY ACTIVE LEADS' : 'ACTIVE LEADS',
    pendingfollowups: isExec ? 'MY PENDING FOLLOW-UPS' : 'PENDING FOLLOW-UPS',
    callslogged: isExec ? 'MY CALLS LOGGED' : 'CALLS LOGGED',
    pipelinevalue: isExec ? 'MY PORTFOLIO VALUE' : 'PORTFOLIO VALUE',
    bannerSubtitle: isIrm
      ? "Here's your high-net-worth investor portfolio and upcoming consultations in PostgreSQL."
      : isExec
      ? "Here's your personal pipeline, assigned leads, and today's action items in PostgreSQL."
      : 'Here is your daily pipeline, incoming inquiries, and pending action items for today.',
    recentLeads: isExec ? 'My Recent Leads' : 'Recent Inbound Leads',
    followupsTable: isIrm
      ? 'Upcoming Consultations'
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
            {tenant?.name || 'CRM'} • LIVE POSTGRESQL CONNECTED
          </div>
          <h1 className="dashboard-banner-title">
            Welcome back, {user?.name.split(' ')[0]} 👋
          </h1>
          <p className="dashboard-banner-subtitle">
            {label.bannerSubtitle}
          </p>
        </div>

        <div className="dashboard-banner-actions">
          <button
            className="btn btn-secondary btn-sm dashboard-banner-btn-secondary"
            onClick={loadDashboardData}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh DB Data
          </button>
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
        </div>
      </div>

      {error && (
        <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', padding: '10px 14px', borderRadius: 8, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards Row */}
      <div className="dashboard-kpi-grid">
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
            <ArrowUpRight size={14} /> Live in PostgreSQL
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
                <AlertCircle size={14} /> {overdueFollowups.length} overdue!
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
          <div className="dashboard-kpi-exec-row">
            <span className="dashboard-kpi-subtext">Avg duration: {avgDuration}</span>
            {missedCalls > 0 && (
              <span className="dashboard-missed-pill has-missed">
                <PhoneMissed size={11} />
                {missedCalls} missed
              </span>
            )}
          </div>
        </div>

        {/* Card 4: Portfolio / Customer Value */}
        <div className="card card-hover dashboard-kpi-card" onClick={() => onNavigate('customers')}>
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
            {scopedCustomers.length} active customer accounts
          </div>
        </div>
      </div>

      {/* Main Split Row: Recent Inquiries & Actionable Followups */}
      <div className="dashboard-split-grid">
        {/* Recent Leads Table */}
        <div className="card dashboard-split-card">
          <div className="dashboard-split-header">
            <div>
              <h3 className="dashboard-split-title">{label.recentLeads}</h3>
              <p className="dashboard-split-subtitle">Direct records from Neon database</p>
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
                {scopedLeads.slice(0, 5).map(l => (
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
                {scopedLeads.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                      No active leads found in database.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Due Follow-ups & Reminders */}
        <div className="card dashboard-split-card">
          <div className="dashboard-split-header">
            <div>
              <h3 className="dashboard-split-title">{label.followupsTable}</h3>
              <p className="dashboard-split-subtitle">Actionable commitments scheduled in PostgreSQL</p>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('followups')}>
              View All &rarr;
            </button>
          </div>

          <div className="dashboard-followups-list">
            {scopedFollowups.slice(0, 5).map(f => (
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
            {scopedFollowups.length === 0 && (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                No pending follow-ups found in database.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};