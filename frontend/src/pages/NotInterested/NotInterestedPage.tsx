import React, { useState, useEffect } from 'react';
import { Phone, ExternalLink, XCircle, RefreshCw } from 'lucide-react';
import { Lead } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { storageService } from '../../services/storageService';
import { DataTable, Column, RowAction } from '../../components/common/DataTable';
import { Drawer } from '../../components/common/Drawer';
import { Timeline, TimelineEvent } from '../../components/common/Timeline';
import { LeadDetailDrawerContent } from '../../components/common/LeadDetailDrawerContent';
import './NotInterestedPage.css';

export const NotInterestedPage: React.FC = () => {
  const { tenant, user } = useAuth();
  const { initiateCall } = useCall();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [reengaging, setReengaging] = useState(false);

  const roleCode = user?.role?.code;
  const isExec = roleCode === 'sales_executive';
  const isGhlSalesExec = tenant?.slug === 'ghl' && isExec;

  const loadData = () => {
    const allLeads = storageService.getLeads(tenant?.id);
    const niLeads = allLeads.filter(l => l.status === 'Not Interested');

    const scopedLeads = isExec
      ? niLeads.filter(l =>
          (l.assignedAgentId && l.assignedAgentId === user?.id) ||
          (l.assignedAgentName && l.assignedAgentName === user?.name)
        )
      : niLeads;

    setLeads(scopedLeads);
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('nexus_storage_updated', handleUpdate);
    return () => window.removeEventListener('nexus_storage_updated', handleUpdate);
  }, [tenant?.id, user?.id, isExec]);

  // Re-engage: move lead from Not Interested → Contacted and create a follow-up entry
  const handleReengage = (lead: Lead) => {
    if (!tenant || !user) return;
    setReengaging(true);
    try {
      // Reset lead status to Contacted
      storageService.saveLead({ ...lead, status: 'Contacted' });

      // Purge any stale Pending followups for this contact, then create a fresh one
      storageService.purgeFollowupsForContact(tenant.id, lead.id, lead.phone);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      storageService.saveFollowup({
        id: `flw-${Date.now()}`,
        companyId: tenant.id,
        contactId: lead.id,
        contactName: lead.name,
        contactPhone: lead.phone,
        contactType: 'lead',
        scheduledAt: tomorrow.toISOString(),
        priority: 'High',
        status: 'Pending',
        notes: `Re-engaged from Not Interested — follow-up required with ${lead.name}.`,
        assignedAgentId: user.id,
        assignedAgentName: user.name,
      });

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

    const calls = storageService.getCalls(tenant?.id).filter(c => c.contactPhone === lead.phone || c.contactName === lead.name);

    calls.forEach(c => {
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
    ? storageService.getCalls(tenant?.id).filter(c => c.contactPhone === selectedLead.phone || c.contactName === selectedLead.name).length
    : 0;

  return (
    <div className="not-interested-page">
      <div>
        <h1 className="not-interested-title">
          <XCircle size={22} color="#f43f5e" />
          Not - Interested
        </h1>
        <p className="not-interested-subtitle">Leads who are not interested in proceeding</p>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <DataTable
          columns={columns}
          data={leads}
          keyExtractor={(r) => r.id}
          rowActions={actions}
          emptyTitle="No leads marked as Not Interested."
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
          : `Not Interested • Added on ${selectedLead?.createdAt}`
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
                  backgroundColor: '#fdf2f8',
                  border: '1px solid #f0abfc',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#9d174d', textTransform: 'uppercase' }}>
                    Not Interested
                  </div>
                  <div style={{ fontSize: 13, color: '#831843', marginTop: 2 }}>
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
                  Reason Details
                </h4>
                <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {selectedLead.customFields?.dispositionReason || 'No specific reason provided.'}
                </p>
              </div>

              {/* Activity History Timeline */}
              <div>
                <h4 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16, fontWeight: 700 }}>
                  Call History / Logs
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
