import React, { useState, useEffect } from 'react';
import {
  Phone,
  FileText,
  Volume2,
  ChevronDown,
  ChevronUp,
  Building2,
  Calendar,
  Clock,
} from 'lucide-react';
import { CallDisposition, Consultation } from '../../types';
import { storageService } from '../../services/storageService';
import { useAuth } from '../../context/AuthContext';
import { StatusChip } from './StatusChip';

interface LeadDetailDrawerContentProps {
  /** The contact's display name */
  contactName: string;
  /** The contact's phone number (used for phone-based call matching) */
  contactPhone: string;
  /** Lead/contact record ID (used for id-based call matching) */
  contactId?: string;
  /** 'lead' | 'customer' — passed through to initiateCall */
  contactType?: string;
  /** Tenant/company ID for scoped storage lookups */
  tenantId?: string;
  /** Tenant name shown in the activity badge */
  tenantName?: string;
  /** Called when the "Call Now" button is pressed */
  onCall: () => void;
  /**
   * Optional whitelist of dispositions to include in call history.
   * When undefined or empty, ALL dispositions are shown (suitable for
   * Junk / Not Interested pages that need the full history).
   * Follow-up page passes ['Follow-up Required', 'Call Back'].
   */
  callDispositionFilter?: CallDisposition[];
  /** Optional — shown as the last row in the Lead/Investor Details card when provided */
  consultationReason?: string;
  /** Optional — past consultations for this investor when viewing from ConsultationsPage */
  consultationHistory?: Consultation[];
  /** Optional — when true, strips system-generated disposition lines from Notes & Requirements */
  hideAutoNotes?: boolean;
  /** Optional — when provided, renders only the specified sections */
  sectionsOnly?: ('callRecordings' | 'summary' | 'details' | 'consultations')[];
}

export const LeadDetailDrawerContent: React.FC<LeadDetailDrawerContentProps> = ({
  contactName,
  contactPhone,
  contactId,
  tenantId,
  onCall,
  callDispositionFilter,
  consultationReason,
  consultationHistory,
  hideAutoNotes = false,
  sectionsOnly,
}) => {
  const { user } = useAuth();
  const isSalesExecutive = user?.role?.code === 'sales_executive';

  const [expandedTranscripts, setExpandedTranscripts] = useState<Record<string, boolean>>({});
  const [callTab, setCallTab] = useState<'agent' | 'irm'>('agent');
  const [isPreviousConsultationsOpen, setIsPreviousConsultationsOpen] = useState(true);

  useEffect(() => {
    setCallTab('agent');
  }, [contactPhone, contactId]);

  // ── Lead record lookup ───────────────────────────────────────────────────────
  const selectedLead = (() => {
    const leads = storageService.getLeads(tenantId) || [];
    return leads.find(l => {
      if (contactId && contactId !== 'contact-new' && l.id === contactId) return true;
      const lPhone = (l.phone || '').replace(/\D/g, '').slice(-10);
      const fPhone = (contactPhone || '').replace(/\D/g, '').slice(-10);
      return lPhone && fPhone && lPhone === fPhone;
    }) || null;
  })();

  // ── Call history lookup ──────────────────────────────────────────────────────
  const allCalls = storageService.getCalls(tenantId) || [];
  const fPhoneDigits = (contactPhone || '').replace(/\D/g, '').slice(-10);

  const selectedCalls = allCalls.filter(c => {
    const isMatch =
      (contactId && contactId !== 'contact-new' &&
        (c.leadId === contactId || (c as any).contactId === contactId || (c as any).investorId === contactId)) ||
      ((c.contactPhone || '').replace(/\D/g, '').slice(-10) === fPhoneDigits &&
        fPhoneDigits.length > 0);

    if (!isMatch) return false;

    // When a filter is specified, only include matching dispositions
    if (callDispositionFilter && callDispositionFilter.length > 0) {
      return callDispositionFilter.includes(c.disposition as CallDisposition);
    }
    return true;
  });

  const agentCalls = selectedCalls.filter(c => !(c.notes || '').startsWith('Connected to IRM:'));
  const irmCalls = selectedCalls.filter(c => (c.notes || '').startsWith('Connected to IRM:'));
  const tabCalls = callTab === 'agent' ? agentCalls : irmCalls;

  // ── Active follow-up count ───────────────────────────────────────────────────
  const followups = storageService.getFollowups(tenantId) || [];
  const activeFollowupCount = followups.filter(f => {
    if (f.status !== 'Pending') return false;
    if (contactId && contactId !== 'contact-new' && f.contactId === contactId) return true;
    const fwPhone = (f.contactPhone || '').replace(/\D/g, '').slice(-10);
    return fwPhone && fPhoneDigits && fwPhone === fPhoneDigits;
  }).length;

  const toggleTranscript = (callId: string) => {
    setExpandedTranscripts(prev => ({ ...prev, [callId]: !prev[callId] }));
  };

  const formatDuration = (sec: number) => {
    if (!sec || sec <= 0) return '0s';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  // ── Customer Notes (from form/source) vs Agent Reason (from disposition) ───
  const customerNotes = (() => {
    if (!selectedLead) return '';
    if (selectedLead.customFields?.customerNotes && typeof selectedLead.customFields.customerNotes === 'string' && selectedLead.customFields.customerNotes.trim()) {
      return selectedLead.customFields.customerNotes.trim();
    }
    if (!selectedLead.notes) return '';
    const cleaned = selectedLead.notes
      .split(/\n\n?\[\d{1,2}\/\d{1,2}\/\d{4}[^\]]*\]\s*Not Interested Reason:?/i)[0]
      .replace(/(?:\[.*?\]\s*)?Not Interested Reason:[\s\S]*$/i, '')
      .trim();
    return cleaned;
  })();

  const agentReason = (() => {
    if (!selectedLead) return '';
    if (selectedLead.customFields?.dispositionReason && typeof selectedLead.customFields.dispositionReason === 'string' && selectedLead.customFields.dispositionReason.trim()) {
      return selectedLead.customFields.dispositionReason.trim();
    }
    if (selectedLead.notes) {
      const match = selectedLead.notes.match(/Not Interested Reason:\s*([^\n\r]+)/i);
      if (match && match[1]?.trim()) {
        return match[1].trim();
      }
    }
    const niCall = selectedCalls.find(c => c.disposition === 'Not Interested');
    if (niCall?.notes) {
      const match = niCall.notes.match(/Reason:\s*([^\n\r]+)/i);
      if (match && match[1]?.trim()) {
        return match[1].trim();
      }
      return niCall.notes.trim();
    }
    return '';
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Activity Summary Badge ───────────────────────────────────────────── */}
      {(!sectionsOnly || sectionsOnly.includes('summary')) && (
        <div
          style={{
            backgroundColor: 'var(--bg-surface-hover)',
            border: '1px solid var(--border-base)',
            borderRadius: 'var(--radius-lg)',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>
              Total Activity Summary
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, marginTop: 2, color: 'var(--primary-600)' }}>
              {selectedCalls.length} {selectedCalls.length === 1 ? 'Call Recorded' : 'Calls Recorded'}
              {activeFollowupCount > 0 && ` • ${activeFollowupCount} Active Follow-up${activeFollowupCount > 1 ? 's' : ''}`}
            </div>
          </div>
          <button className="btn btn-call btn-sm" onClick={onCall}>
            <Phone size={13} /> Call Now
          </button>
        </div>
      )}

      {/* ── Lead / Investor Details ──────────────────────────────────────────── */}
      {(!sectionsOnly || sectionsOnly.includes('details')) && (
        <div className="card">
        <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Building2 size={16} color="var(--primary-600)" /> Lead / Investor Details
        </h4>

        {selectedLead ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
            {selectedLead.name && (
              <div>
                <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }}>FULL NAME</span>
                <div style={{ fontWeight: 600 }}>{selectedLead.name}</div>
              </div>
            )}
            {selectedLead.phone && (
              <div>
                <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }}>PHONE NUMBER</span>
                <div style={{ fontWeight: 600 }}>{selectedLead.phone}</div>
              </div>
            )}
            {selectedLead.email && (
              <div>
                <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }}>EMAIL</span>
                <div style={{ fontWeight: 600 }}>{selectedLead.email}</div>
              </div>
            )}
            {selectedLead.location && (
              <div>
                <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }}>LOCATION</span>
                <div style={{ fontWeight: 600 }}>{selectedLead.location}</div>
              </div>
            )}
            {selectedLead.source && (
              <div>
                <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }}>SOURCE</span>
                <div style={{ fontWeight: 600 }}>{selectedLead.source}</div>
              </div>
            )}
            {selectedLead.status && (
              <div>
                <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }}>STATUS</span>
                <div><StatusChip status={selectedLead.status} size="sm" /></div>
              </div>
            )}
            {selectedLead.priority && (
              <div>
                <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }}>PRIORITY</span>
                <div><StatusChip status={selectedLead.priority} size="sm" /></div>
              </div>
            )}
            {selectedLead.createdAt && (
              <div>
                <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }}>INTAKE DATE</span>
                <div style={{ fontWeight: 600 }}>{selectedLead.createdAt}</div>
              </div>
            )}
            {(selectedLead as any).preferredLanguage && (
              <div>
                <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }}>PREFERRED LANGUAGE</span>
                <div style={{ fontWeight: 600 }}>{(selectedLead as any).preferredLanguage}</div>
              </div>
            )}
            {(selectedLead as any).preferredContactTime && (
              <div>
                <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }}>PREFERRED CONTACT TIME</span>
                <div style={{ fontWeight: 600 }}>{(selectedLead as any).preferredContactTime}</div>
              </div>
            )}
            {(() => {
              // Strip legacy "[date] ... Reason: ..." lines that were previously
              // appended to notes before reason was stored separately.
              const reasonLinePattern = /^\[[\d/]+\]\s.*(Reason|Wrong Number|Not Interested).*/i;

              let notesContent = '';
              if (hideAutoNotes) {
                if (
                  selectedLead.customFields?.customerNotes &&
                  typeof selectedLead.customFields.customerNotes === 'string' &&
                  selectedLead.customFields.customerNotes.trim()
                ) {
                  notesContent = selectedLead.customFields.customerNotes.trim();
                } else {
                  const autoNotePattern1 =
                    /^\[\d{1,2}\/\d{1,2}\/\d{4}\]\s*(Interested|Follow-up Required|Call Back|No Response|Converted|Not Interested|Wrong Number)/i;
                  const autoNotePattern2 = /^\[Call Disposition\s*-.*?\]:/i;

                  notesContent = (selectedLead.notes || '')
                    .split('\n')
                    .filter(line => {
                      const trimmed = line.trim();
                      if (reasonLinePattern.test(trimmed)) return false;
                      if (autoNotePattern1.test(trimmed)) return false;
                      if (autoNotePattern2.test(trimmed)) return false;
                      return true;
                    })
                    .join('\n')
                    .trim();
                }
              } else {
                notesContent = (selectedLead.notes || '')
                  .split('\n')
                  .filter(line => !reasonLinePattern.test(line.trim()))
                  .join('\n')
                  .trim();
              }

              if (!notesContent) return null;
              return (
                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }}>NOTES & REQUIREMENTS</span>
                  <div style={{ backgroundColor: 'var(--bg-surface-hover)', padding: '8px 12px', borderRadius: 6, marginTop: 4, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                    {notesContent}
                  </div>
                </div>
              );
            })()}

            {selectedLead.customFields?.dispositionReason && (
              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }}>REASON</span>
                <div style={{ backgroundColor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', padding: '8px 12px', borderRadius: 6, marginTop: 4, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                  {selectedLead.customFields.dispositionReason as string}
                </div>
              </div>
            )}
            {consultationReason && (
              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }}>REASON FOR CONSULTATION</span>
                <div style={{ backgroundColor: 'var(--bg-surface-hover)', padding: '8px 12px', borderRadius: 6, marginTop: 4 }}>
                  {consultationReason}
                </div>
              </div>
            )}

            {/* Custom Fields */}
            {(() => {
              const activeDefs = storageService
                .getCustomFieldDefinitions(tenantId)
                .filter(d => d.active !== false && (d.module === 'leads' || !d.module))
                .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

              const rows = activeDefs
                .map(def => {
                  const key = def.fieldKey || def.id;
                  if (key === 'dispositionReason' || key === 'customerNotes') return null;
                  if (isSalesExecutive && key === 'preferredAssetClass') return null;
                  const val = selectedLead.customFields?.[key];
                  if (val === undefined || val === null || val === '') return null;
                  return { id: def.id, label: def.label || key.replace(/([A-Z])/g, ' $1'), value: String(val) };
                })
                .filter(Boolean);

              if (rows.length === 0) return null;

              return (
                <div style={{ gridColumn: 'span 2', marginTop: 8 }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }}>CUSTOM ATTRIBUTES</span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
                    {rows.map(item => (
                      <div key={item!.id} style={{ backgroundColor: 'var(--bg-surface-hover)', padding: '6px 10px', borderRadius: 6 }}>
                        <span style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{item!.label}</span>
                        <div style={{ fontWeight: 600 }}>{item!.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        ) : (
          <div>
            <div style={{ padding: '16px', backgroundColor: 'var(--bg-surface-hover)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
              Lead details unavailable
            </div>
            {consultationReason && (
              <div style={{ marginTop: 12 }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }}>REASON FOR CONSULTATION</span>
                <div style={{ backgroundColor: 'var(--bg-surface-hover)', padding: '8px 12px', borderRadius: 6, marginTop: 4 }}>
                  {consultationReason}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      )}

      {/* ── Previous Consultations ─────────────────────────────────────── */}
      {(!sectionsOnly || sectionsOnly.includes('consultations')) && consultationHistory && consultationHistory.length > 0 && (
        <div className="card">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              marginBottom: isPreviousConsultationsOpen ? 12 : 0,
            }}
            onClick={() => setIsPreviousConsultationsOpen(prev => !prev)}
          >
            <h4
              style={{
                fontSize: 15,
                fontWeight: 700,
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Calendar size={16} color="var(--primary-600)" /> Previous Consultations ({consultationHistory.length})
            </h4>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ padding: '2px 6px' }}
              onClick={e => {
                e.stopPropagation();
                setIsPreviousConsultationsOpen(prev => !prev);
              }}
            >
              {isPreviousConsultationsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>

          {isPreviousConsultationsOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {consultationHistory.map(item => (
                <div
                  key={item.id}
                  style={{
                    border: '1px solid var(--border-base)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 14px',
                    backgroundColor: 'var(--bg-surface)',
                  }}
                >
                  {/* Header row: slot (scheduledAt) and StatusChip */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 10,
                          backgroundColor: 'var(--bg-surface-hover)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        <Clock size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: '-1px' }} />
                        {item.scheduledAt}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        Consultant: <strong>{item.consultantName}</strong>
                      </span>
                    </div>
                    <StatusChip status={item.status} size="sm" />
                  </div>

                  {/* Agenda / Reason */}
                  {item.agenda && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
                      <strong>Reason / Agenda:</strong> {item.agenda}
                    </div>
                  )}

                  {/* Outcome Notes (if any) */}
                  {item.outcomeNotes && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                      <strong>Outcome Notes:</strong> {item.outcomeNotes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Call Recordings ────────────────────────────────────────────── */}
      {(!sectionsOnly || sectionsOnly.includes('callRecordings')) && (
        <div className="card">
        <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Phone size={16} color="var(--primary-600)" /> Call Recordings
        </h4>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button
            type="button"
            className={`btn btn-sm ${callTab === 'agent' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setCallTab('agent')}
          >
            Connect via Agent ({agentCalls.length})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${callTab === 'irm' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setCallTab('irm')}
          >
            Connect via IRM ({irmCalls.length})
          </button>
        </div>

        {tabCalls.length === 0 ? (
          <div style={{ padding: '16px', backgroundColor: 'var(--bg-surface-hover)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
            No calls in this category yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {tabCalls.map(c => {
              const isExpanded = !!expandedTranscripts[c.id];
              return (
                <div
                  key={c.id}
                  style={{
                    border: '1px solid var(--border-base)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 14px',
                    backgroundColor: 'var(--bg-surface)',
                  }}
                >
                  {/* Call header row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 10,
                          backgroundColor: c.direction === 'inbound' ? '#dcfce7' : '#e0f2fe',
                          color: c.direction === 'inbound' ? '#15803d' : '#0369a1',
                        }}
                      >
                        {c.direction === 'inbound' ? '↙ Inbound' : '↗ Outbound'}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{c.timestamp}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>• {formatDuration(c.duration)}</span>
                    </div>
                    <StatusChip status={c.disposition} size="sm" />
                  </div>

                  {/* Notes */}
                  {c.notes && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                      <strong>Notes:</strong> {c.notes}
                    </div>
                  )}

                  {/* Reason (from Call Wrap-up & Disposition) */}
                  {(c as any).reason && (
                    <div style={{ fontSize: 12, marginTop: 6, backgroundColor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', padding: '5px 10px', borderRadius: 5 }}>
                      <strong style={{ color: 'var(--text-secondary)' }}>Reason:</strong>{' '}
                      <span style={{ color: 'var(--text-primary)' }}>{(c as any).reason}</span>
                    </div>
                  )}

                  {/* Audio Player */}
                  {c.recordingUrl && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                        <Volume2 size={12} /> Call Recording Audio
                      </div>
                      <audio controls src={c.recordingUrl} style={{ width: '100%', height: 36 }} />
                    </div>
                  )}

                  {/* Collapsible Transcription */}
                  {c.transcription && (
                    <div style={{ marginTop: 8 }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '2px 6px', fontSize: 11, gap: 4, color: 'var(--primary-600)' }}
                        onClick={() => toggleTranscript(c.id)}
                      >
                        <FileText size={12} />
                        {isExpanded ? 'Hide Transcription' : 'View Automated Transcription'}
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>

                      {isExpanded && (
                        <div
                          style={{
                            marginTop: 6,
                            padding: '10px 12px',
                            backgroundColor: 'var(--bg-surface-hover)',
                            borderRadius: 6,
                            fontSize: 12,
                            lineHeight: 1.5,
                            color: 'var(--text-primary)',
                            borderLeft: '3px solid var(--primary-600)',
                          }}
                        >
                          {c.transcription}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}
    </div>
  );
};
