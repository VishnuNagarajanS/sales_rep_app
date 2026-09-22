import React, { useState, useEffect } from 'react';
import { PhoneCall, Phone, Delete } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { AgentAvailabilityToggle } from '../../components/calling/CallCenterComponents';
import { EmptyState } from '../../components/common/EmptyState';
import { CallRecordDto, FollowupDto, LeadDto, callsApi, followupsApi, leadsApi } from '../../services/crmApi';
import './CallCenterPage.css';
// ── Calendar-day comparison helper (same pattern as elsewhere in the app) ──────
const isSameCalendarDay = (dateStr: string, ref: Date): boolean => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
};

// ── Duration formatter (same as DashboardPage / ReportsPage) ─────────────────
const formatDuration = (seconds: number): string => {
  if (!seconds || seconds <= 0) return '0s';
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
};

// ── Priority sort order ────────────────────────────────────────────────────────
const PRIORITY_ORDER: Record<string, number> = {
  Urgent: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

export const CallCenterPage: React.FC = () => {
  const { tenant, user } = useAuth();
  const { availability, initiateCall, simulateIncomingCall } = useCall();

  const [dialNumber, setDialNumber] = useState('+91 ');
  const [contactName, setContactName] = useState('');

  // ── Real data from backend APIs ─────────────────────────────────────────────
  const [calls, setCalls] = useState<CallRecordDto[]>([]);
  const [followups, setFollowups] = useState<FollowupDto[]>([]);
  const [leads, setLeads] = useState<LeadDto[]>([]);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        const [fetchedCalls, fetchedFollowups, fetchedLeads] = await Promise.all([
          callsApi.getCalls().catch(() => ({ items: [] as CallRecordDto[] })),
          followupsApi.getFollowups().catch(() => ({ items: [] as FollowupDto[] })),
          leadsApi.getActiveLeads().catch(() => ({ items: [] as LeadDto[] })),
        ]);
        if (isMounted) {
          setCalls(fetchedCalls.items || []);
          setFollowups(fetchedFollowups.items || []);
          setLeads(fetchedLeads.items || []);
        }
      } catch (err) {
        console.error('Failed to load call center data:', err);
      }
    };
    loadData();
    window.addEventListener('nexus_storage_updated', loadData);
    return () => {
      isMounted = false;
      window.removeEventListener('nexus_storage_updated', loadData);
    };
  }, [tenant?.id]);

  // ── Task 1: Today's outbound calls + connect rate ────────────────────────────
  const today = new Date();
  const todayOutbound = calls.filter(
    c => c.direction === 'outbound' && isSameCalendarDay(c.timestamp, today)
  );
  const outboundConnected = todayOutbound.filter(c => c.duration > 0);
  const outboundConnectRate =
    todayOutbound.length > 0
      ? ((outboundConnected.length / todayOutbound.length) * 100).toFixed(1)
      : null;

  // ── Task 2: Avg talk time from today's outbound connected calls ───────────────
  const totalConnectedDuration = outboundConnected.reduce(
    (sum, c) => sum + (c.duration || 0),
    0
  );
  const avgTalkTime =
    outboundConnected.length > 0
      ? formatDuration(Math.round(totalConnectedDuration / outboundConnected.length))
      : null;

  // ── Task 3a: Pending followups due today ──────────────────────────────────────
  const needsOutreachToday = followups.filter(
    f => f.status === 'Pending' && isSameCalendarDay(f.scheduledAt, today)
  );

  // ── Task 5: Priority callback pipeline ────────────────────────────────────────
  // Combine: pending followups due today or overdue + Urgent/High leads with no
  // scheduled followup and not converted.
  const isOverdueOrToday = (f: FollowupDto): boolean => {
    if (!f.scheduledAt) return false;
    const d = new Date(f.scheduledAt);
    if (isNaN(d.getTime())) return false;
    // Due today or in the past (overdue)
    return d <= new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  };

  type PipelineItem = {
    id: string;
    name: string;
    phone: string;
    meta: string;
    priority: string;
    source: 'followup' | 'lead';
  };

  const pipelineFromFollowups: PipelineItem[] = followups
    .filter(f => f.status === 'Pending' && isOverdueOrToday(f))
    .map(f => ({
      id: String(f.id),
      name: f.contactName,
      phone: f.contactPhone,
      meta: f.notes || 'Pending follow-up',
      priority: f.priority,
      source: 'followup' as const,
    }));

  // Leads that are Urgent or High priority, not Converted, with no pending followup
  const followupContactIds = new Set(
    followups.filter(f => f.status === 'Pending').map(f => String(f.contactId || ''))
  );
  const pipelineFromLeads: PipelineItem[] = leads
    .filter(
      l =>
        (l.priority === 'Urgent' || l.priority === 'High') &&
        l.status !== 'Converted' &&
        !followupContactIds.has(String(l.id))
    )
    .map(l => ({
      id: String(l.id),
      name: l.name,
      phone: l.phone,
      meta: `${l.priority} priority lead • ${l.location || l.source}`,
      priority: l.priority,
      source: 'lead' as const,
    }));

  // Merge, deduplicate by name+phone, sort by priority, cap at 5
  const seen = new Set<string>();
  const pipelineItems = [...pipelineFromFollowups, ...pipelineFromLeads]
    .filter(item => {
      const key = `${item.name}|${item.phone}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort(
      (a, b) =>
        (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)
    )
    .slice(0, 5);

  // ── Availability colour helper ────────────────────────────────────────────────
  const availabilityColor = {
    Available: '#10b981',
    Busy: '#f59e0b',
    Offline: '#64748b',
  }[availability] ?? '#64748b';

  // ── Dial pad handlers ─────────────────────────────────────────────────────────
  const handleDial = (digit: string) => {
    setDialNumber(prev => prev + digit);
  };

  const handleBackspace = () => {
    setDialNumber(prev => prev.slice(0, -1));
  };

  const handleStartCall = () => {
    if (dialNumber.length > 5) {
      initiateCall(contactName || 'Direct Outbound Call', dialNumber);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <PhoneCall size={24} color="var(--primary-600)" /> Call Center Cockpit
          </h1>
          <p className="page-subtitle">
            Outbound dialer, callback pipeline, and your daily outreach dashboard for {tenant?.name}.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <AgentAvailabilityToggle />
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>

        {/* Card 1 — Needs Outreach Today (was "Queue Status") */}
        <div className="card">
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
            NEEDS OUTREACH TODAY
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: needsOutreachToday.length > 0 ? '#f59e0b' : 'var(--text-primary)',
              marginTop: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {needsOutreachToday.length > 0 && (
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#f59e0b',
                  boxShadow: '0 0 6px #f59e0b',
                  animation: 'pulse-ring 1.5s infinite',
                  flexShrink: 0,
                }}
              />
            )}
            {needsOutreachToday.length} Pending
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Follow-ups scheduled for today
          </div>
        </div>

        {/* Card 2 — Your Status (was "Agents Online") */}
        <div className="card">
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
            YOUR STATUS
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: availabilityColor,
              marginTop: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: availabilityColor,
                boxShadow: `0 0 6px ${availabilityColor}`,
                flexShrink: 0,
              }}
            />
            {availability}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Toggle from the header above
          </div>
        </div>

        {/* Card 3 — Today's Outbound (real data) */}
        <div className="card">
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
            TODAY'S OUTBOUND
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--primary-600)', marginTop: 6 }}>
            {todayOutbound.length} {todayOutbound.length === 1 ? 'Call' : 'Calls'}
          </div>
          <div style={{ fontSize: 11, color: outboundConnectRate !== null ? '#059669' : 'var(--text-muted)', marginTop: 4, fontWeight: 600 }}>
            {outboundConnectRate !== null
              ? `Connect rate: ${outboundConnectRate}%`
              : 'Connect rate: —'}
          </div>
        </div>

        {/* Card 4 — Avg Talk Time (real data) */}
        <div className="card">
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
            AVG TALK TIME
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginTop: 6 }}>
            {avgTalkTime ?? '—'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Target: 3m - 6m
          </div>
        </div>
      </div>

      {/* Main Cockpit: Softphone Dialer on Left, Callback Queue on Right */}
      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 24, alignItems: 'flex-start' }}>
        {/* Softphone Dialer */}
        <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>Outbound Softphone</h3>
            {/* Task 4 — honest badge, no false SIP claim */}
            <span
              style={{
                fontSize: 11,
                color: '#64748b',
                fontStyle: 'italic',
              }}
            >
              ● Simulated Line
            </span>
          </div>

          <div className="form-group">
            <input
              type="text"
              className="form-input"
              style={{ height: 42, fontSize: 16, fontWeight: 700, textAlign: 'center', letterSpacing: '0.05em' }}
              value={dialNumber}
              onChange={e => setDialNumber(e.target.value)}
              placeholder="+91 Phone number"
            />
          </div>

          <div className="form-group">
            <input
              type="text"
              className="form-input"
              style={{ fontSize: 12 }}
              value={contactName}
              onChange={e => setContactName(e.target.value)}
              placeholder="Contact Name (optional)"
            />
          </div>

          {/* Keypad Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map(digit => (
              <button
                key={digit}
                type="button"
                className="btn btn-secondary"
                style={{ height: 48, fontSize: 18, fontWeight: 700 }}
                onClick={() => handleDial(digit)}
              >
                {digit}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button
              type="button"
              className="btn btn-secondary btn-icon"
              style={{ width: 48, height: 48 }}
              onClick={handleBackspace}
              title="Backspace"
            >
              <Delete size={18} />
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ flex: 1, height: 48, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', fontSize: 15 }}
              onClick={handleStartCall}
            >
              <Phone size={18} /> Call Now
            </button>
          </div>
        </div>

        {/* Priority Callback Pipeline — real data */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700 }}>Priority Callback Pipeline</h3>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Today's pending follow-ups and high-priority leads awaiting outreach
                </p>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                style={{ color: 'var(--primary-600)' }}
                onClick={() => simulateIncomingCall('Pravin Godbole', '+91 97410 88223')}
              >
                Simulate Call Event
              </button>
            </div>

            {pipelineItems.length === 0 ? (
              <EmptyState
                icon={<PhoneCall size={24} />}
                title="All caught up!"
                description="No priority callbacks right now — you're all caught up."
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {pipelineItems.map(item => {
                  const priorityColor =
                    item.priority === 'Urgent'
                      ? '#dc2626'
                      : item.priority === 'High'
                        ? '#f59e0b'
                        : 'var(--text-muted)';

                  return (
                    <div
                      key={item.id}
                      style={{
                        padding: '12px 16px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--bg-surface-hover)',
                        border: '1px solid var(--border-base)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                          {item.name}
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: priorityColor,
                              border: `1px solid ${priorityColor}`,
                              borderRadius: 4,
                              padding: '1px 5px',
                              textTransform: 'uppercase',
                            }}
                          >
                            {item.priority}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                          {item.phone} • {item.meta}
                        </div>
                      </div>

                      <button
                        className="btn btn-primary btn-sm"
                        style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', flexShrink: 0 }}
                        onClick={() => initiateCall(item.name, item.phone)}
                      >
                        <Phone size={13} /> Dial Contact
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
