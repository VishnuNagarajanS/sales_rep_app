import React, { useState, useEffect } from 'react';
import { Phone, ExternalLink, Trash2, RefreshCw } from 'lucide-react';
import { Lead, CallRecord } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { getLeads, saveLead as apiSaveLead, saveFollowup as apiSaveFollowup, getCalls } from '../../services/ghlApiService';
import { DataTable, Column, RowAction } from '../../components/common/DataTable';
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
      const [allLeads, allCalls] = await Promise.all([
        getLeads(tenant?.id),
        getCalls(tenant?.id),
      ]);
      const junkLeads = allLeads.filter(l => l.status === 'Junk');

      const scopedLeads = isExec
        ? junkLeads.filter(l =>
          (l.assignedAgentId && l.assignedAgentId === user?.id) ||
          (l.assignedAgentName && l.assignedAgentName === user?.name)
        )
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

  // Re-engage: move lead from Junk → Contacted and create a follow-up entry
  const handleReengage = (lead: Lead) => {
    if (!tenant || !user) return;
    setReengaging(true);
    try {
      // Reset lead status to Contacted
      apiSaveLead({ ...lead, status: 'Contacted' }).catch(console.error);

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
      apiSaveFollowup(newFlw).then(loadData).catch(console.error);

      setIsDetailDrawerOpen(false);
      setSelectedLead(null);
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
      key: 'reason',
      header: 'Reason',
      render: (r: Lead) => {
        const reasonText = r.customFields?.dispositionReason as string | undefined;
        if (!reasonText) return <span style={{ color: 'var(--text-muted)', fontSize: 12, fontStyle: 'italic' }}>—</span>;
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
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', textTransform: 'uppercase' }}>
                    Junk Lead
                  </div>
                  <div style={{ fontSize: 13, color: '#78350f', marginTop: 2 }}>
                    {selectedLead.customFields?.dispositionReason || 'No specific reason provided.'}
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
                  Junk Reason Details
                </h4>
                <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {selectedLead.customFields?.dispositionReason || 'No specific reason provided.'}
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
