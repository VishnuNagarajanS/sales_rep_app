import React, { useState, useEffect } from 'react';
import { Phone, ExternalLink, Trash2, RefreshCw } from 'lucide-react';
import { Lead } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { leadsApi, LeadDto } from '../../services/crmApi';
import { DataTable, Column, RowAction } from '../../components/common/DataTable';
import { Drawer } from '../../components/common/Drawer';
import { Timeline, TimelineEvent } from '../../components/common/Timeline';
import { LeadDetailDrawerContent } from '../../components/common/LeadDetailDrawerContent';
import './JunkPage.css';

const mapDtoToLead = (dto: LeadDto): Lead => ({
  id: String(dto.id),
  companyId: String(dto.companyId),
  name: dto.name,
  phone: dto.phone,
  email: dto.email || '',
  location: dto.location || '',
  source: dto.source || 'Website Inbound',
  status: (dto.status as any) || 'Junk',
  priority: (dto.priority as any) || 'Medium',
  assignedAgentId: String(dto.assignedAgentId),
  assignedAgentName: dto.assignedAgentName || 'Agent',
  nextFollowupDate: dto.nextFollowupDate,
  createdAt: dto.createdAt ? dto.createdAt.split('T')[0] : new Date().toISOString().split('T')[0],
  notes: dto.notes || '',
  customFields: dto.customFields || {},
});

export const JunkPage: React.FC = () => {
  const { tenant } = useAuth();
  const { initiateCall } = useCall();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [reengaging, setReengaging] = useState(false);

  const isGhlSalesExec = tenant?.slug === 'ghl';

  const loadData = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await leadsApi.getJunkLeads();
      setLeads((data.items || []).map(mapDtoToLead));
    } catch (err: any) {
      setLoadError(err.message || 'Failed to load Junk leads from PostgreSQL.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenant?.id]);

  // Re-engage: move lead from Junk → Contacted via API
  const handleReengage = async (lead: Lead) => {
    setReengaging(true);
    try {
      if (!isNaN(Number(lead.id))) {
        await leadsApi.reengageLead(Number(lead.id));
      }
      setIsDetailDrawerOpen(false);
      setSelectedLead(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to re-engage lead.');
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
    return events;
  };

  const timelineEvents = selectedLead && !isGhlSalesExec ? getTimelineEvents(selectedLead) : [];
  const callsCount = 0;

  return (
    <div className="junk-page">
      <div>
        <h1 className="junk-title">
          <Trash2 size={22} color="#64748b" />
          Junk
        </h1>
        <p className="junk-subtitle">Wrong numbers and invalid inquiries</p>
      </div>

      {loadError && (
        <div className="card" style={{ padding: '12px 16px', marginTop: 16, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '8px' }}>
          <strong>Error loading leads:</strong> {loadError}
          <button className="btn btn-sm btn-secondary" style={{ marginLeft: 12 }} onClick={loadData}>Retry</button>
        </div>
      )}

      {isLoading && (
        <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-secondary)' }}>
          Loading Junk leads from PostgreSQL database...
        </div>
      )}

      <div className="card" style={{ marginTop: 24 }}>
        <DataTable
          columns={columns}
          data={leads}
          keyExtractor={(r) => r.id}
          rowActions={actions}
          emptyTitle="No leads marked as Junk."
          searchPlaceholder="Search leads by name, phone, or reason..."
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Re-engage action banner */}
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                    Junk Lead
                  </div>
                  <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                    {selectedLead.customFields?.dispositionReason || selectedLead.notes || 'No reason provided'}
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="card" style={{ padding: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
                  Contact Information
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>Phone: </span>
                    <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{selectedLead.phone}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>Email: </span>
                    <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{selectedLead.email || '—'}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>Location: </span>
                    <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{selectedLead.location || '—'}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>Source: </span>
                    <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{selectedLead.source}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  className="btn btn-call"
                  style={{ flex: 1 }}
                  onClick={() => initiateCall(selectedLead.name, selectedLead.phone, 'lead', selectedLead.id)}
                >
                  <Phone size={14} /> Call Lead
                </button>
                <button
                  className="btn btn-secondary"
                  disabled={reengaging}
                  onClick={() => handleReengage(selectedLead)}
                >
                  <RefreshCw size={14} /> Re-engage
                </button>
              </div>

              <div>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
                  Timeline & Interactions ({callsCount} calls)
                </h3>
                <Timeline events={timelineEvents} />
              </div>
            </div>
          )
        )}
      </Drawer>
    </div>
  );
};
