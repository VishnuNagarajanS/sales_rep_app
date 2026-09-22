import React, { useState, useEffect } from 'react';
import { Phone, ExternalLink, XCircle, RefreshCw } from 'lucide-react';
import { Lead } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { leadsApi, LeadDto } from '../../services/crmApi';
import { DataTable, Column, RowAction } from '../../components/common/DataTable';
import { Drawer } from '../../components/common/Drawer';
import { Timeline, TimelineEvent } from '../../components/common/Timeline';
import { LeadDetailDrawerContent } from '../../components/common/LeadDetailDrawerContent';
import './NotInterestedPage.css';

const mapDtoToLead = (dto: LeadDto): Lead => ({
  id: String(dto.id),
  companyId: String(dto.companyId),
  name: dto.name,
  phone: dto.phone,
  email: dto.email || '',
  location: dto.location || '',
  source: dto.source || 'Website Inbound',
  status: (dto.status as any) || 'Not Interested',
  priority: (dto.priority as any) || 'Medium',
  assignedAgentId: String(dto.assignedAgentId),
  assignedAgentName: dto.assignedAgentName || 'Agent',
  nextFollowupDate: dto.nextFollowupDate,
  createdAt: dto.createdAt ? dto.createdAt.split('T')[0] : new Date().toISOString().split('T')[0],
  notes: dto.notes || '',
  customFields: dto.customFields || {},
});

export const NotInterestedPage: React.FC = () => {
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
      const data = await leadsApi.getNotInterestedLeads();
      setLeads((data.items || []).map(mapDtoToLead));
    } catch (err: any) {
      setLoadError(err.message || 'Failed to load Not-Interested leads from PostgreSQL.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenant?.id]);

  // Re-engage: move lead from Not Interested → Contacted via API
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

  const getNotInterestedReason = (lead: Lead): string => {
    if (lead.customFields?.dispositionReason?.trim()) {
      return lead.customFields.dispositionReason.trim();
    }
    if (lead.notes) {
      const match = lead.notes.match(/Not Interested Reason:\s*([^\n]+)/i);
      if (match && match[1]?.trim()) {
        return match[1].trim();
      }
    }
    return 'No specific reason provided';
  };

  const getCustomerNotes = (lead: Lead): string => {
    if (lead.customFields?.customerNotes && typeof lead.customFields.customerNotes === 'string' && lead.customFields.customerNotes.trim()) {
      return lead.customFields.customerNotes.trim();
    }
    if (!lead.notes) return '';
    const cleaned = lead.notes
      .split(/\n\n?\[\d{1,2}\/\d{1,2}\/\d{4}[^\]]*\]\s*Not Interested Reason:?/i)[0]
      .replace(/(?:\[.*?\]\s*)?Not Interested Reason:[\s\S]*$/i, '')
      .trim();
    return cleaned;
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
        const reasonText = getNotInterestedReason(r);
        const hasReason = reasonText !== 'No specific reason provided';
        return (
          <div
            title={reasonText}
            style={{
              fontSize: 13,
              maxWidth: 280,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              color: hasReason ? 'var(--text-primary)' : 'var(--text-muted)',
              fontStyle: hasReason ? 'normal' : 'italic',
            }}
          >
            {reasonText}
          </div>
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

    return events;
  };

  const timelineEvents = selectedLead && !isGhlSalesExec ? getTimelineEvents(selectedLead) : [];
  const callsCount = 0;

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
          searchPlaceholder="Search leads by name, phone, or reason..."
          searchFilter={(item, query) => {
            const q = query.toLowerCase();
            const reason = getNotInterestedReason(item).toLowerCase();
            return (
              item.name.toLowerCase().includes(q) ||
              item.phone.toLowerCase().includes(q) ||
              item.source.toLowerCase().includes(q) ||
              reason.includes(q)
            );
          }}
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
                    {getNotInterestedReason(selectedLead)}
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

              {/* Notes & Requirements (Customer) and Reason (Agent) */}
              <div className="card">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600, letterSpacing: '0.04em' }}>
                      NOTES & REQUIREMENTS
                    </span>
                    <div
                      style={{
                        backgroundColor: 'var(--bg-surface-hover)',
                        border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
                        padding: '8px 12px',
                        borderRadius: 6,
                        marginTop: 4,
                        fontSize: 13,
                        color: 'var(--text-primary)',
                        lineHeight: 1.5,
                        wordBreak: 'break-word',
                      }}
                    >
                      {getCustomerNotes(selectedLead) || 'No notes submitted by customer.'}
                    </div>
                  </div>

                  <div>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600, letterSpacing: '0.04em' }}>
                      REASON
                    </span>
                    <div
                      style={{
                        backgroundColor: 'rgba(239, 68, 68, 0.04)',
                        border: '1px solid rgba(239, 68, 68, 0.35)',
                        padding: '8px 12px',
                        borderRadius: 6,
                        marginTop: 4,
                        fontSize: 13,
                        color: 'var(--text-primary)',
                        lineHeight: 1.5,
                        wordBreak: 'break-word',
                      }}
                    >
                      {getNotInterestedReason(selectedLead)}
                    </div>
                  </div>
                </div>
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
