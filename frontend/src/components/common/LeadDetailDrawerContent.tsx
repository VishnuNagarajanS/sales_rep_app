import React, { useState } from 'react';
import {
  Phone,
  FileText,
  Volume2,
  ChevronDown,
  ChevronUp,
  Building2,
} from 'lucide-react';
import { CallDisposition } from '../../types';
import { storageService } from '../../services/storageService';
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
}

export const LeadDetailDrawerContent: React.FC<LeadDetailDrawerContentProps> = ({
  contactName,
  contactPhone,
  contactId,
  tenantId,
  onCall,
  callDispositionFilter,
}) => {
  const [expandedTranscripts, setExpandedTranscripts] = useState<Record<string, boolean>>({});

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
        (c.leadId === contactId || (c as any).contactId === contactId)) ||
      ((c.contactPhone || '').replace(/\D/g, '').slice(-10) === fPhoneDigits &&
        fPhoneDigits.length > 0);

    if (!isMatch) return false;

    // When a filter is specified, only include matching dispositions
    if (callDispositionFilter && callDispositionFilter.length > 0) {
      return callDispositionFilter.includes(c.disposition as CallDisposition);
    }
    return true;
  });

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Activity Summary Badge ───────────────────────────────────────────── */}
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

      {/* ── Lead / Investor Details ──────────────────────────────────────────── */}
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
            {selectedLead.notes && (
              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }}>NOTES & REQUIREMENTS</span>
                <div style={{ backgroundColor: 'var(--bg-surface-hover)', padding: '8px 12px', borderRadius: 6, marginTop: 4 }}>
                  {selectedLead.notes}
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
          <div style={{ padding: '16px', backgroundColor: 'var(--bg-surface-hover)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
            Lead details unavailable
          </div>
        )}
      </div>

      {/* ── Call Log & Recordings ────────────────────────────────────────────── */}
      <div className="card">
        <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Phone size={16} color="var(--primary-600)" /> Call Log &amp; Recordings
        </h4>

        {selectedCalls.length === 0 ? (
          <div style={{ padding: '16px', backgroundColor: 'var(--bg-surface-hover)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
            No previous call logs recorded for this contact.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {selectedCalls.map(c => {
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
    </div>
  );
};
