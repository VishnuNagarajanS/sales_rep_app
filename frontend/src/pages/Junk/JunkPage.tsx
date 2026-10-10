import React, { useState, useEffect } from 'react';
import { Phone, ExternalLink, Trash2, RefreshCw } from 'lucide-react';
import { Lead, CallRecord } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { getLeads, getJunkLeads, saveLead as apiSaveLead, saveFollowup as apiSaveFollowup, getCalls } from '../../services/ghlApiService';
import { apiClient } from '../../services/apiClient';
import { DataTable, Column, RowAction } from '../../components/common/DataTable';
import { StatusChip } from '../../components/common/StatusChip';
import { Drawer } from '../../components/common/Drawer';
import { Timeline, TimelineEvent } from '../../components/common/Timeline';
import { LeadDetailDrawerContent } from '../../components/common/LeadDetailDrawerContent';
import './JunkPage.css';

export const JunkPage: React.FC = () => {
  const { tenant, user } = useAuth();
  const { initiateCall } = useCall();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [reengaging, setReengaging] = useState(false);

  const roleCode = user?.role?.code;
  const isExec = roleCode === 'sales_executive';
  const isGhlSalesExec = tenant?.slug === 'ghl' && isExec;

  const loadData = async () => {
    try {
      const [junkLeads, allCalls] = await Promise.all([
        getJunkLeads(tenant?.id),
        getCalls(tenant?.id),
      ]);

      const scopedLeads = isExec
        ? junkLeads.filter(l => {
            const uid = user?.id ? String(user.id) : '';
            const uname = user?.name ? user.name.trim().toLowerCase() : '';
            const agentId = l.assignedAgentId ? String(l.assignedAgentId) : '';
            const agentName = l.assignedAgentName ? l.assignedAgentName.trim().toLowerCase() : '';
            const salesExecId = l.assignedSalesExecutiveId ? String(l.assignedSalesExecutiveId) : '';
            const salesExecName = l.assignedSalesExecutiveName ? l.assignedSalesExecutiveName.trim().toLowerCase() : '';

            if (!agentId && !agentName) return true;
            if (uid && (agentId === uid || salesExecId === uid)) return true;
            if (uname && (agentName === uname || salesExecName === uname)) return true;
            return false;
          })
        : junkLeads;

      setLeads(scopedLeads);
      setCalls(allCalls);
    } catch (err) {
      console.error('Failed to load junk leads', err);
    }
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('nexus_storage_updated', handleUpdate);
    return () => window.removeEventListener('nexus_storage_updated', handleUpdate);
  }, [tenant?.id, user?.id, isExec]);

  // Helper to extract disposition/junk reason with robust fallbacks
  const getDispositionReason = (lead: Lead): string => {
    // 1. Stored in customFields.dispositionReason
    if (lead.customFields?.dispositionReason && typeof lead.customFields.dispositionReason === 'string' && lead.customFields.dispositionReason.trim()) {
      return lead.customFields.dispositionReason.trim();
    }

    // 2. Parse from lead notes if present
    if (lead.notes) {
      const match = lead.notes.match(/(?:Junk|Wrong Number) Reason:\s*([^\n]+)/i);
      if (match && match[1]?.trim()) {
        return match[1].trim();
      }
      const match2 = lead.notes.match(/\[Reason\]:\s*([^\n]+)/i);
      if (match2 && match2[1]?.trim()) {
        return match2[1].trim();
      }
    }

    // 3. Fallback to latest call log with disposition 'Wrong Number' or 'Junk'
    const junkCalls = calls
      .filter((c: any) => (c.contactPhone === lead.phone || c.contactName === lead.name) && (c.disposition === 'Wrong Number' || c.disposition === 'Junk'));
    if (junkCalls.length > 0) {
      const latestCall = junkCalls.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
      if (latestCall.reason && typeof latestCall.reason === 'string' && latestCall.reason.trim()) {
        return latestCall.reason.trim();
      }
      if (latestCall.notes) {
        const reasonMatch = latestCall.notes.match(/Reason:\s*([^\n]+)/i) || latestCall.notes.match(/\[Reason\]:\s*([^\n]+)/i);
        if (reasonMatch && reasonMatch[1]?.trim()) {
          return reasonMatch[1].trim();
        }
        return latestCall.notes.trim();
      }
      if (latestCall.disposition === 'Wrong Number') {
        return 'Wrong Number';
      }
    }

    if (lead.status === 'Wrong Number') {
      return 'Wrong Number';
    }

    return 'No specific reason provided';
  };

  // Re-engage: move lead from Junk → Contacted and create a follow-up entry
  const handleReengage = async (lead: Lead) => {
    if (!tenant || !user) return;
    setReengaging(true);
    try {
      const numId = parseInt(String(lead.id).replace(/\D/g, ''), 10);
      if (numId) {
        try {
          await apiClient.post(`/sales-executive/leads/${numId}/reengage`);
        } catch (e) {
          console.warn('Backend reengage error, falling back to apiSaveLead', e);
          await apiSaveLead({ ...lead, status: 'Contacted' });
        }
      } else {
        await apiSaveLead({ ...lead, status: 'Contacted' });
      }

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const newFlw = {
        id: `flw-${Date.now()}`,
        companyId: tenant.id,
        contactId: lead.id,
        contactName: lead.name,
        contactPhone: lead.phone,
        contactType: 'lead' as const,
        scheduledAt: tomorrow.toISOString(),
        priority: 'High' as const,
        status: 'Pending' as const,
        notes: `Re-engaged from Junk — follow-up required with ${lead.name}.`,
        assignedAgentId: user.id,
        assignedAgentName: user.name,
      };
      await apiSaveFollowup(newFlw);
      await loadData();

      setIsDetailDrawerOpen(false);
      setSelectedLead(null);
    } catch (err) {
      console.error('Failed to reengage lead', err);
    } finally {
      setReengaging(false);
    }
  };

  const columns: Column<Lead>[] = [
    {
      key: 'name',
      header: 'Name & Contact',
      render: (r: Lead) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.name}</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
            {r.phone} • {r.location || 'Unknown'}
          </div>
        </div>
      ),
    },
    {
      key: 'source',
      header: 'Source',
      render: (r: Lead) => (
        <span
          style={{
            display: "inline-flex",
            padding: "3px 10px",
            borderRadius: 100,
            fontSize: 11,
            fontWeight: 600,
            background: "rgba(100, 116, 139, 0.12)",
            color: "#94a3b8",
            border: "1px solid rgba(100, 116, 139, 0.2)",
          }}
        >
          {r.source}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r: Lead) => <StatusChip status={r.status || 'Junk'} size="sm" />
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (r: Lead) => {
        const reasonText = getDispositionReason(r);
        if (!reasonText || reasonText === 'No specific reason provided') return <span style={{ color: 'var(--text-muted)', fontSize: 12, fontStyle: 'italic' }}>—</span>;
        const firstLine = reasonText.split('\n')[0];
        const isTruncated = firstLine.length < reasonText.length || firstLine.length > 60;
        const displayText = firstLine.length > 60 ? firstLine.slice(0, 60) + '…' : firstLine;
        return (
          <span
            title={reasonText}
            style={{
              fontSize: 12,
              color: 'var(--text-secondary)',
              maxWidth: 200,
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              cursor: isTruncated ? 'help' : 'default',
            }}
          >
            {displayText}
          </span>
        );
      },
    },
  ];

  const actions: RowAction<Lead>[] = [
    {
      label: 'View',
      icon: <ExternalLink size={14} />,
      onClick: (row) => {
        setSelectedLead(row);
        setIsDetailDrawerOpen(true);
      },
    },
  ];

  // ── Non-GHL exec: timeline helper ───────────────────────────────────────────
  const getTimelineEvents = (lead: Lead): TimelineEvent[] => {
    const events: TimelineEvent[] = [];

    events.push({
      id: `ev-create-${lead.id}`,
      type: 'note',
      title: 'Lead Created',
      description: `Sourced from ${lead.source}`,
      timestamp: lead.createdAt,
      actorName: lead.assignedAgentName,
    });

    const leadCalls = calls.filter(c => c.contactPhone === lead.phone || c.contactName === lead.name);

    leadCalls.forEach(c => {
      events.push({
        id: `ev-call-${c.id}`,
        type: 'call',
        title: `Call Logged - ${c.disposition}`,
        description: `Duration: ${Math.floor(c.duration / 60)}m ${c.duration % 60}s. ${c.notes || ''}`,
        timestamp: c.timestamp,
        actorName: c.agentName,
      });
    });

    return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  };

  const timelineEvents = selectedLead && !isGhlSalesExec ? getTimelineEvents(selectedLead) : [];
  const callsCount = selectedLead && !isGhlSalesExec
    ? calls.filter(c => c.contactPhone === selectedLead.phone || c.contactName === selectedLead.name).length
    : 0;

  return (
    <div className="junk-page">
      <div>
        <h1 className="junk-title">
          <Trash2 size={22} color="#64748b" />
          Junk
        </h1>
        <p className="junk-subtitle">Wrong numbers and invalid inquiries</p>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <DataTable
          columns={columns}
          data={leads}
          keyExtractor={(r) => r.id}
          rowActions={actions}
          emptyTitle="No junk leads found."
          onRowClick={isGhlSalesExec ? (row) => { setSelectedLead(row); setIsDetailDrawerOpen(true); } : undefined}
        />
      </div>

      {/* Details Drawer */}
      <Drawer
        isOpen={isDetailDrawerOpen}
        onClose={() => { setIsDetailDrawerOpen(false); setSelectedLead(null); }}
        title={selectedLead?.name || 'Lead Details'}
        subtitle={isGhlSalesExec
          ? `Phone: ${selectedLead?.phone || '—'} • ${tenant?.name}`
          : `Junk Lead • Added on ${selectedLead?.createdAt}`
        }
        width={isGhlSalesExec ? 600 : 500}
      >
        {selectedLead && (
          isGhlSalesExec ? (
            // ── GHL Sales Exec: full parity drawer ──────────────────────────────
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Re-engage action banner */}
              <div
                style={{
                  backgroundColor: '#fff7ed',
                  border: '1px solid #fed7aa',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#92400e', textTransform: 'uppercase' }}>
                      {selectedLead.status === 'Wrong Number' ? 'Wrong Number' : 'Junk Lead'}
                    </span>
                    <StatusChip status={selectedLead.status || 'Junk'} size="sm" />
                  </div>
                  <div style={{ fontSize: 13, color: '#78350f', marginTop: 4 }}>
                    {getDispositionReason(selectedLead)}
                  </div>
                </div>
                <button
                  className="btn btn-sm"
                  style={{
                    backgroundColor: '#16a34a',
                    color: '#fff',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                  disabled={reengaging}
                  onClick={() => handleReengage(selectedLead)}
                >
                  <RefreshCw size={13} />
                  Re-engage → Follow-up
                </button>
              </div>

              {/* Full GHL detail drawer content */}
              <LeadDetailDrawerContent
                contactName={selectedLead.name}
                contactPhone={selectedLead.phone}
                contactId={selectedLead.id}
                contactType="lead"
                tenantId={tenant?.id}
                tenantName={tenant?.name}
                onCall={() => initiateCall(selectedLead.name, selectedLead.phone, 'lead', selectedLead.id)}
              />
            </div>
          ) : (
            // ── Non-GHL / non-exec: original lightweight drawer ──────────────────
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '16px 0' }}>
              {/* Core Details */}
              <div className="card">
                <h4 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12, fontWeight: 700 }}>
                  Contact Details
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Phone:</span>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{selectedLead.phone}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Email:</span>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{selectedLead.email || '—'}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Location:</span>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{selectedLead.location || '—'}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Total Calls:</span>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{callsCount}</div>
                  </div>
                </div>
              </div>

              {/* Reason Details */}
              <div className="card">
                <h4 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12, fontWeight: 700 }}>
                  Reason Details
                </h4>
                <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {getDispositionReason(selectedLead)}
                </p>
              </div>

              {/* Activity History Timeline */}
              <div>
                <h4 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16, fontWeight: 700 }}>
                  Call Records / History
                </h4>
                <Timeline events={timelineEvents} />
              </div>
            </div>
          )
        )}
      </Drawer>
    </div>
  );
};
